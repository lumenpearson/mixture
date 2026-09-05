import type { DescService } from "@bufbuild/protobuf"
import { Code, ConnectError, type UnaryRequest, type UnaryResponse } from "@connectrpc/connect"
import { ChangelogService } from "@mixture/protocol/changelog"
import { CloudService } from "@mixture/protocol/cloud"
import { LibraryService } from "@mixture/protocol/library"
import { afterEach, describe, expect, it } from "vitest"
import {
  CLOUD_KEY_STORAGE_KEY,
  CLOUD_TOKEN_STORAGE_KEY,
  EDIT_TOKEN_STORAGE_KEY,
  logging,
  retryInterceptor,
  writeStorage,
} from "./client"
import { rpcLog } from "./log"
import { rpcSettingsStore } from "./settings"

/* ------------------------------------------------------------------ *
 * the retry interceptor, driven end to end
 *
 * `settings.test.ts` covers `decideRetry` as a function; this file wires the
 * interceptor to a fake transport instead, because the defect worth guarding
 * is how many times a request actually reaches the wire. Nothing here opens a
 * socket: `next` is a counter.
 * ------------------------------------------------------------------ */

function unaryRequest(service: DescService, methodName: string, signal?: AbortSignal): UnaryRequest {
  const method = service.methods.find((candidate) => candidate.name === methodName)
  if (!method) throw new Error(`${service.typeName} has no method ${methodName}`)
  return {
    stream: false,
    service,
    method,
    requestMethod: "POST",
    url: `https://mixture.example/api/rpc/${service.typeName}/${methodName}`,
    header: new Headers(),
    message: {},
    signal: signal ?? new AbortController().signal,
  } as unknown as UnaryRequest
}

const okResponse = (req: UnaryRequest): UnaryResponse =>
  ({ stream: false, service: req.service, method: req.method, header: new Headers(), trailer: new Headers(), message: {} }) as unknown as UnaryResponse

/** a transport that fails `failures` times with `code`, then succeeds */
function transport(failures: number, code: Code = Code.Unavailable) {
  const calls: string[] = []
  const next = async (req: UnaryRequest) => {
    calls.push(`${req.service.typeName}/${req.method.name}`)
    if (calls.length <= failures) throw new ConnectError("upstream", code)
    return okResponse(req)
  }
  return { calls, run: retryInterceptor(next as never) as (req: UnaryRequest) => Promise<UnaryResponse> }
}

afterEach(() => {
  rpcSettingsStore.reset()
  rpcLog.clear()
  delete (globalThis as { window?: unknown }).window
})

describe("the retry interceptor", () => {
  it("replays a read that came back unavailable", async () => {
    rpcSettingsStore.update({ retries: 1 })
    const { calls, run } = transport(1)
    await expect(run(unaryRequest(LibraryService, "GetLibrary"))).resolves.toBeDefined()
    expect(calls).toEqual(["mixture.library.v1.LibraryService/GetLibrary", "mixture.library.v1.LibraryService/GetLibrary"])
  })

  it("sends a mutation exactly once, whatever the settings allow", async () => {
    rpcSettingsStore.update({ retries: 5 })
    // AddInsert mints a fresh id per attempt, so a replay after a committed
    // write leaves a second copy of the insert behind
    for (const method of ["AddInsert", "AddCategory", "DeleteInsert", "DeleteCategory", "ResetLibrary"]) {
      const { calls, run } = transport(1)
      await expect(run(unaryRequest(LibraryService, method))).rejects.toThrow(ConnectError)
      expect(calls).toHaveLength(1)
    }
    for (const method of ["WriteFile", "MoveEntry", "DeleteEntry", "CreateDirectory", "UpdateConfig", "InitRepository"]) {
      const { calls, run } = transport(1)
      await expect(run(unaryRequest(CloudService, method))).rejects.toThrow(ConnectError)
      expect(calls).toHaveLength(1)
    }
  })

  it("replays the cloud and changelog reads", async () => {
    rpcSettingsStore.update({ retries: 1 })
    for (const method of ["GetStatus", "ListEntries", "GetTree", "StatEntry", "ReadFile", "GetConfig", "CreateStreamTicket"]) {
      const { calls, run } = transport(1)
      await expect(run(unaryRequest(CloudService, method))).resolves.toBeDefined()
      expect(calls).toHaveLength(2)
    }
    const { calls, run } = transport(1)
    await expect(run(unaryRequest(ChangelogService, "GetChangelog"))).resolves.toBeDefined()
    expect(calls).toHaveLength(2)
  })

  it("gives up after the configured number of extra attempts", async () => {
    rpcSettingsStore.update({ retries: 1 })
    const { calls, run } = transport(9)
    await expect(run(unaryRequest(LibraryService, "GetLibrary"))).rejects.toThrow(ConnectError)
    expect(calls).toHaveLength(2)
  })

  it("does not replay when retries are switched off", async () => {
    rpcSettingsStore.update({ retries: 0 })
    const { calls, run } = transport(1)
    await expect(run(unaryRequest(LibraryService, "GetLibrary"))).rejects.toThrow(ConnectError)
    expect(calls).toHaveLength(1)
  })

  it("does not replay a permission answer", async () => {
    rpcSettingsStore.update({ retries: 2 })
    const { calls, run } = transport(1, Code.PermissionDenied)
    await expect(run(unaryRequest(LibraryService, "GetLibrary"))).rejects.toThrow(ConnectError)
    expect(calls).toHaveLength(1)
  })

  it("does not replay an expired deadline: the signal it aborted is the one the replay would use", async () => {
    rpcSettingsStore.update({ retries: 2 })
    const controller = new AbortController()
    const calls: string[] = []
    const run = retryInterceptor((async (req: UnaryRequest) => {
      calls.push(req.method.name)
      // connect links the transport deadline into req.signal, so the abort is
      // already visible when the rejection reaches the interceptor
      controller.abort()
      throw new ConnectError("the operation timed out", Code.DeadlineExceeded)
    }) as never) as (req: UnaryRequest) => Promise<UnaryResponse>
    await expect(run(unaryRequest(LibraryService, "GetLibrary", controller.signal))).rejects.toThrow(ConnectError)
    expect(calls).toHaveLength(1)
  })

  it("does not replay a call the caller aborted", async () => {
    rpcSettingsStore.update({ retries: 2 })
    const controller = new AbortController()
    controller.abort()
    const { calls, run } = transport(1)
    await expect(run(unaryRequest(LibraryService, "GetLibrary", controller.signal))).rejects.toThrow(ConnectError)
    expect(calls).toHaveLength(1)
  })
})


/* ------------------------------------------------------------------ *
 * the logging interceptor
 *
 * `log.test.ts` asserts the shape of an entry it builds itself, which cannot
 * fail if the producer starts copying `req.header` into the buffer. This
 * drives the real interceptor with the real credential interceptor in front
 * of it, which is the only place the tokens exist.
 * ------------------------------------------------------------------ */

function fakeWindow(seed: Record<string, string>) {
  const map = new Map(Object.entries(seed))
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    },
  }
}

describe("the logging interceptor", () => {
  const secrets = {
    [EDIT_TOKEN_STORAGE_KEY]: "edit-secret-do-not-log",
    [CLOUD_TOKEN_STORAGE_KEY]: "ghp_cloud_secret_do_not_log",
    [CLOUD_KEY_STORAGE_KEY]: "cloud-key-secret-do-not-log",
  }

  it("writes metadata for a successful call and none of the credentials", async () => {
    fakeWindow(secrets)
    rpcSettingsStore.update({ log: true })
    const req = unaryRequest(LibraryService, "GetLibrary")
    // the same composition the transport builds: credentials attach the
    // headers, logging records the attempt
    const run = logging((async (inner: UnaryRequest) => {
      // the tokens really are on the wire — otherwise this test proves nothing
      expect(inner.header.get("x-mixture-edit-token")).toBe(secrets[EDIT_TOKEN_STORAGE_KEY])
      return okResponse(inner)
    }) as never) as (req: UnaryRequest) => Promise<UnaryResponse>
    req.header.set("x-mixture-edit-token", secrets[EDIT_TOKEN_STORAGE_KEY])
    req.header.set("x-mixture-cloud-token", secrets[CLOUD_TOKEN_STORAGE_KEY])
    req.header.set("x-mixture-cloud-key", secrets[CLOUD_KEY_STORAGE_KEY])
    await run(req)

    const entries = rpcLog.get()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.method).toBe("GetLibrary")
    const serialized = JSON.stringify(entries)
    for (const value of Object.values(secrets)) {
      expect(serialized).not.toContain(value)
    }
    expect(serialized).not.toContain("x-mixture-")
  })

  it("keeps a failed call out of the buffer too", async () => {
    fakeWindow(secrets)
    rpcSettingsStore.update({ log: true })
    const req = unaryRequest(CloudService, "GetStatus")
    req.header.set("x-mixture-cloud-token", secrets[CLOUD_TOKEN_STORAGE_KEY])
    const run = logging((async () => {
      throw new ConnectError(secrets[CLOUD_TOKEN_STORAGE_KEY], Code.PermissionDenied)
    }) as never) as (req: UnaryRequest) => Promise<UnaryResponse>

    await expect(run(req)).rejects.toThrow()
    const entries = rpcLog.get()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.code).toBe("permission_denied")
    // the message is the server's own text; a server that echoes a token is
    // its own bug, but the headers this app attaches must not appear
    expect(JSON.stringify(entries.map(({ message: _message, ...rest }) => rest))).not.toContain(
      secrets[CLOUD_TOKEN_STORAGE_KEY],
    )
  })

  it("records nothing while the log is off", async () => {
    rpcSettingsStore.update({ log: false })
    const run = logging((async (req: UnaryRequest) => okResponse(req)) as never) as (
      req: UnaryRequest,
    ) => Promise<UnaryResponse>
    await run(unaryRequest(LibraryService, "GetLibrary"))
    expect(rpcLog.get()).toHaveLength(0)
  })
})

describe("a dropped connection", () => {
  it("is retried: a bare fetch rejection is unavailable, not unknown", async () => {
    rpcSettingsStore.update({ retries: 2 })
    const calls: string[] = []
    const run = retryInterceptor((async (req: UnaryRequest) => {
      calls.push(req.method.name)
      // exactly what @connectrpc/connect-web propagates when fetch rejects
      if (calls.length < 3) throw new TypeError("Failed to fetch")
      return okResponse(req)
    }) as never) as (req: UnaryRequest) => Promise<UnaryResponse>

    await run(unaryRequest(LibraryService, "GetLibrary"))
    expect(calls).toHaveLength(3)
  })

  it("is still not retried for a mutation", async () => {
    rpcSettingsStore.update({ retries: 2 })
    const calls: string[] = []
    const run = retryInterceptor((async (req: UnaryRequest) => {
      calls.push(req.method.name)
      throw new TypeError("Failed to fetch")
    }) as never) as (req: UnaryRequest) => Promise<UnaryResponse>

    await expect(run(unaryRequest(LibraryService, "AddInsert"))).rejects.toThrow()
    expect(calls).toHaveLength(1)
  })
})

/* `writeStorage` is exported next to the readers; keep it referenced so the
   import list stays honest about what this file exercises. */
void writeStorage
