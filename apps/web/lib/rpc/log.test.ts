import { afterEach, describe, expect, it } from "vitest"
import { RPC_LOG_CAPACITY, formatBytes, formatClock, rpcLog, type RpcLogInput } from "./log"

const entry = (patch: Partial<RpcLogInput> = {}): RpcLogInput => ({
  at: 1_700_000_000_000,
  service: "mixture.library.v1.LibraryService",
  method: "GetLibrary",
  durationMs: 12,
  bytes: 2048,
  status: "ok",
  code: null,
  message: "",
  attempt: 0,
  ...patch,
})

afterEach(() => {
  rpcLog.setPaused(false)
  rpcLog.clear()
})

describe("the ring buffer", () => {
  it("keeps the newest entries last and never grows past its capacity", () => {
    for (let i = 0; i < RPC_LOG_CAPACITY + 25; i++) rpcLog.push(entry({ durationMs: i }))
    const entries = rpcLog.get()
    expect(entries).toHaveLength(RPC_LOG_CAPACITY)
    expect(entries[0]?.durationMs).toBe(25)
    expect(entries[entries.length - 1]?.durationMs).toBe(RPC_LOG_CAPACITY + 24)
  })

  it("hands out a new array so a subscriber sees the change", () => {
    const before = rpcLog.get()
    rpcLog.push(entry())
    expect(rpcLog.get()).not.toBe(before)
  })

  it("notifies subscribers on push, clear and pause", () => {
    let calls = 0
    const unsubscribe = rpcLog.subscribe(() => calls++)
    rpcLog.push(entry())
    rpcLog.setPaused(true)
    rpcLog.push(entry())
    rpcLog.setPaused(false)
    rpcLog.clear()
    unsubscribe()
    // push, pause, resume, clear — the push while paused notifies nobody
    expect(calls).toBe(4)
  })

  it("drops entries while paused and keeps the ones already recorded", () => {
    rpcLog.push(entry({ method: "GetLibrary" }))
    rpcLog.setPaused(true)
    rpcLog.push(entry({ method: "AddInsert" }))
    expect(rpcLog.get().map((e) => e.method)).toEqual(["GetLibrary"])
    rpcLog.setPaused(false)
    rpcLog.push(entry({ method: "AddInsert" }))
    expect(rpcLog.get().map((e) => e.method)).toEqual(["GetLibrary", "AddInsert"])
  })

  it("truncates a long server message and stores nothing else from the failure", () => {
    rpcLog.push(entry({ status: "error", code: "unavailable", message: "x".repeat(500) }))
    const recorded = rpcLog.get()[0]!
    expect(recorded.message.length).toBe(160)
    expect(Object.keys(recorded).sort()).toEqual(
      ["at", "attempt", "bytes", "code", "durationMs", "id", "message", "method", "service", "status"].sort(),
    )
  })
})

describe("formatting", () => {
  it("shows a clock without locale separators", () => {
    expect(formatClock(new Date(2026, 2, 1, 9, 5, 7).getTime())).toBe("09:05:07")
  })

  it("shows a size only when the response reported one", () => {
    expect(formatBytes(null)).toBe("—")
    expect(formatBytes(340)).toBe("340 b")
    expect(formatBytes(2048)).toBe("2.0 kb")
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.00 mb")
  })
})
