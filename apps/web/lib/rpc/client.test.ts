import type { DescService } from "@bufbuild/protobuf"
import { Code, ConnectError, type UnaryRequest, type UnaryResponse } from "@connectrpc/connect"
import { ChangelogService } from "@mixture/protocol/changelog"
import { CloudService } from "@mixture/protocol/cloud"
import { LibraryService } from "@mixture/protocol/library"
import { afterEach, describe, expect, it } from "vitest"
import { retryInterceptor } from "./client"
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
