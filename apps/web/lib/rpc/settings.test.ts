import { Code } from "@connectrpc/connect"
import { ChangelogService } from "@mixture/protocol/changelog"
import { CloudService } from "@mixture/protocol/cloud"
import { LibraryService } from "@mixture/protocol/library"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_RPC_SETTINGS,
  RPC_MUTATING_METHODS,
  RPC_REPLAYABLE_METHODS,
  RPC_RETRIES_MAX,
  RPC_RETRY_BASE_MS,
  RPC_RETRY_CEILING_MS,
  RPC_RETRYABLE_CODES,
  RPC_TIMEOUT_MAX_MS,
  RPC_TIMEOUT_MIN_MS,
  checkBaseUrl,
  decideRetry,
  isReplayableMethod,
  isRetryableCode,
  normalizeRpcSettings,
  retryDelayMs,
} from "./settings"

describe("defaults", () => {
  it("ships binary grpc-web, a 30 s deadline and two retries", () => {
    expect(DEFAULT_RPC_SETTINGS).toEqual({
      protocol: "grpc-web",
      format: "binary",
      timeoutMs: 30_000,
      retries: 2,
      baseUrl: "",
      // vitest runs with NODE_ENV=test, so the development-only log is off
      log: false,
    })
  })
})

describe("settings validation", () => {
  it("falls back to the defaults for an empty or foreign value", () => {
    expect(normalizeRpcSettings(undefined)).toEqual(DEFAULT_RPC_SETTINGS)
    expect(normalizeRpcSettings("grpc")).toEqual(DEFAULT_RPC_SETTINGS)
    expect(normalizeRpcSettings({})).toEqual(DEFAULT_RPC_SETTINGS)
  })

  it("keeps only known protocols and formats", () => {
    expect(normalizeRpcSettings({ protocol: "connect", format: "json" })).toMatchObject({
      protocol: "connect",
      format: "json",
    })
    expect(normalizeRpcSettings({ protocol: "grpc", format: "xml" })).toMatchObject({
      protocol: "grpc-web",
      format: "binary",
    })
  })

  it("clamps the deadline to 5 s … 120 s and rounds it", () => {
    expect(normalizeRpcSettings({ timeoutMs: 10 }).timeoutMs).toBe(RPC_TIMEOUT_MIN_MS)
    expect(normalizeRpcSettings({ timeoutMs: 10_000_000 }).timeoutMs).toBe(RPC_TIMEOUT_MAX_MS)
    expect(normalizeRpcSettings({ timeoutMs: 7_500.6 }).timeoutMs).toBe(7_501)
    expect(normalizeRpcSettings({ timeoutMs: "soon" }).timeoutMs).toBe(DEFAULT_RPC_SETTINGS.timeoutMs)
    expect(normalizeRpcSettings({ timeoutMs: Number.NaN }).timeoutMs).toBe(DEFAULT_RPC_SETTINGS.timeoutMs)
  })

  it("clamps the retry count to 0 … 5", () => {
    expect(normalizeRpcSettings({ retries: -3 }).retries).toBe(0)
    expect(normalizeRpcSettings({ retries: 99 }).retries).toBe(RPC_RETRIES_MAX)
    expect(normalizeRpcSettings({ retries: 0 }).retries).toBe(0)
    expect(normalizeRpcSettings({ retries: null }).retries).toBe(DEFAULT_RPC_SETTINGS.retries)
  })

  it("takes the log flag only as a boolean", () => {
    expect(normalizeRpcSettings({ log: true }).log).toBe(true)
    expect(normalizeRpcSettings({ log: "yes" }).log).toBe(DEFAULT_RPC_SETTINGS.log)
  })
})

describe("base url validation", () => {
  it("treats an empty override as the same origin", () => {
    expect(checkBaseUrl("")).toEqual({ ok: true, value: "" })
    expect(checkBaseUrl("   ")).toEqual({ ok: true, value: "" })
  })

  it("accepts an https origin and normalizes it", () => {
    expect(checkBaseUrl("https://mixture.example")).toEqual({ ok: true, value: "https://mixture.example" })
    expect(checkBaseUrl(" https://mixture.example/ ")).toEqual({ ok: true, value: "https://mixture.example" })
    expect(checkBaseUrl("https://mixture.example:8443/edge/")).toEqual({
      ok: true,
      value: "https://mixture.example:8443/edge",
    })
    expect(checkBaseUrl("https://mixture.example/?a=1#b")).toEqual({ ok: true, value: "https://mixture.example" })
  })

  it("rejects plain http to a remote host — the request carries the edit token", () => {
    expect(checkBaseUrl("http://mixture.example")).toEqual({ ok: false, reason: "insecure" })
    expect(checkBaseUrl("http://10.0.0.5:3000")).toEqual({ ok: false, reason: "insecure" })
  })

  it("allows plain http on loopback, where the desktop shell talks to next dev", () => {
    expect(checkBaseUrl("http://localhost:3000")).toEqual({ ok: true, value: "http://localhost:3000" })
    expect(checkBaseUrl("http://127.0.0.1:3000")).toEqual({ ok: true, value: "http://127.0.0.1:3000" })
  })

  it("rejects a non-http scheme and anything that is not a url", () => {
    expect(checkBaseUrl("javascript:fetch('/api/rpc')")).toEqual({ ok: false, reason: "insecure" })
    expect(checkBaseUrl("ws://mixture.example")).toEqual({ ok: false, reason: "insecure" })
    expect(checkBaseUrl("mixture.example")).toEqual({ ok: false, reason: "invalid" })
    expect(checkBaseUrl("/api/rpc")).toEqual({ ok: false, reason: "invalid" })
  })

  it("rejects credentials embedded in the url", () => {
    expect(checkBaseUrl("https://user:secret@mixture.example")).toEqual({ ok: false, reason: "credentials" })
    expect(checkBaseUrl("https://user@mixture.example")).toEqual({ ok: false, reason: "credentials" })
  })

  it("drops a rejected override instead of storing it", () => {
    expect(normalizeRpcSettings({ baseUrl: "http://mixture.example" }).baseUrl).toBe("")
    expect(normalizeRpcSettings({ baseUrl: 42 }).baseUrl).toBe("")
    expect(normalizeRpcSettings({ baseUrl: "https://mixture.example/" }).baseUrl).toBe("https://mixture.example")
  })
})

describe("which methods may be replayed", () => {
  const SERVICES = [LibraryService, ChangelogService, CloudService]
  const declared = SERVICES.flatMap((service) => service.methods.map((method) => `${service.typeName}/${method.name}`))

  it("classifies every rpc of every service exactly once", () => {
    const classified = [...RPC_REPLAYABLE_METHODS, ...RPC_MUTATING_METHODS]
    // a new rpc must be put on one of the two lists before it can be called:
    // an unclassified method is never replayed, but silence is not a decision
    expect([...declared].sort()).toEqual([...classified].sort())
  })

  it("names only rpcs that exist", () => {
    const known = new Set(declared)
    expect([...RPC_REPLAYABLE_METHODS, ...RPC_MUTATING_METHODS].filter((name) => !known.has(name))).toEqual([])
  })

  it("replays reads and refuses every mutation", () => {
    for (const name of RPC_REPLAYABLE_METHODS) {
      const [service, method] = name.split("/") as [string, string]
      expect(isReplayableMethod(service, method)).toBe(true)
    }
    for (const name of RPC_MUTATING_METHODS) {
      const [service, method] = name.split("/") as [string, string]
      expect(isReplayableMethod(service, method)).toBe(false)
    }
  })

  it("refuses a method or a service it has never heard of", () => {
    expect(isReplayableMethod("mixture.library.v1.LibraryService", "GetEverything")).toBe(false)
    expect(isReplayableMethod("evil.v1.Service", "GetLibrary")).toBe(false)
    // the pair is matched as a whole: a read of one service is not a read of another
    expect(isReplayableMethod("mixture.cloud.v1.CloudService", "GetLibrary")).toBe(false)
  })
})

describe("retry decision", () => {
  const retryable = [Code.Unavailable, Code.Internal]
  const final = [
    Code.PermissionDenied,
    Code.InvalidArgument,
    Code.FailedPrecondition,
    Code.NotFound,
    Code.Unauthenticated,
    Code.AlreadyExists,
    Code.ResourceExhausted,
    Code.Canceled,
    Code.Unknown,
    // the deadline is the budget of the whole call, so its own signal has
    // already aborted the request by the time this code arrives
    Code.DeadlineExceeded,
  ]

  it("retries a lost connection and a server fault", () => {
    for (const code of retryable) {
      expect(isRetryableCode(code)).toBe(true)
      expect(decideRetry({ code, replayable: true, attempt: 0, retries: 2, random: () => 0 }).retry).toBe(true)
    }
  })

  it("never retries a permission, validation or deadline answer", () => {
    for (const code of final) {
      expect(isRetryableCode(code)).toBe(false)
      expect(decideRetry({ code, replayable: true, attempt: 0, retries: 5, random: () => 0 })).toEqual({
        retry: false,
        delayMs: 0,
      })
    }
    expect(RPC_RETRYABLE_CODES).not.toContain(Code.DeadlineExceeded)
  })

  it("ignores a code it does not recognise", () => {
    expect(isRetryableCode(undefined)).toBe(false)
    expect(isRetryableCode("unavailable")).toBe(false)
    expect(decideRetry({ code: 999, replayable: true, attempt: 0, retries: 2 }).retry).toBe(false)
  })

  it("stops after the configured number of extra attempts", () => {
    const attempts = [0, 1, 2].map(
      (attempt) => decideRetry({ code: Code.Unavailable, replayable: true, attempt, retries: 2, random: () => 0 }).retry,
    )
    expect(attempts).toEqual([true, true, false])
    expect(decideRetry({ code: Code.Unavailable, replayable: true, attempt: 0, retries: 0 }).retry).toBe(false)
    expect(decideRetry({ code: Code.Unavailable, replayable: true, attempt: 5, retries: 99 }).retry).toBe(false)
  })

  it("does not replay a stream or a call the caller aborted", () => {
    expect(decideRetry({ code: Code.Unavailable, replayable: true, attempt: 0, retries: 3, stream: true }).retry).toBe(false)
    expect(decideRetry({ code: Code.Unavailable, replayable: true, attempt: 0, retries: 3, aborted: true }).retry).toBe(false)
  })

  it("does not replay a mutation, however transient the failure looks", () => {
    for (const code of retryable) {
      expect(decideRetry({ code, replayable: false, attempt: 0, retries: 5, random: () => 0 })).toEqual({
        retry: false,
        delayMs: 0,
      })
    }
  })

  it("backs off exponentially and jitters inside the window", () => {
    expect(retryDelayMs(0, () => 0)).toBe(RPC_RETRY_BASE_MS / 2)
    expect(retryDelayMs(0, () => 1)).toBe(RPC_RETRY_BASE_MS)
    expect(retryDelayMs(1, () => 0)).toBe(RPC_RETRY_BASE_MS)
    expect(retryDelayMs(2, () => 1)).toBe(RPC_RETRY_BASE_MS * 4)
    // the ceiling holds however many attempts are allowed
    expect(retryDelayMs(20, () => 1)).toBe(RPC_RETRY_CEILING_MS)
    expect(retryDelayMs(20, () => 0)).toBe(RPC_RETRY_CEILING_MS / 2)
  })
})
