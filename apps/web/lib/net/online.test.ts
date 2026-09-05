import { describe, expect, it } from "vitest"
import {
  INITIAL_NETWORK_STATE,
  OFFLINE_PROBE_INTERVAL_MS,
  ONLINE_PROBE_INTERVAL_MS,
  PROBE_METHOD,
  probeAnswered,
  isOffline,
  nextProbeDelayMs,
  probeUrl,
  reduceNetwork,
  shouldShowOffline,
  type NetworkState,
} from "./online"

const state = (patch: Partial<NetworkState> = {}): NetworkState => ({
  ...INITIAL_NETWORK_STATE,
  ...patch,
})

describe("reduceNetwork", () => {
  it("keeps the same object when nothing changes", () => {
    const before = state()
    expect(reduceNetwork(before, { type: "browser", online: true })).toBe(before)
  })

  it("drops a stale success when the link goes down", () => {
    const before = state({ reachable: true, okAt: 100 })
    const after = reduceNetwork(before, { type: "browser", online: false })
    expect(after.browserOnline).toBe(false)
    expect(after.reachable).toBeNull()
  })

  it("records the moment of a successful probe", () => {
    const after = reduceNetwork(state({ probing: true }), { type: "probe:done", ok: true, at: 42 })
    expect(after).toMatchObject({ probing: false, reachable: true, okAt: 42 })
  })

  it("keeps the last success timestamp when a later probe fails", () => {
    const before = state({ reachable: true, okAt: 42 })
    const after = reduceNetwork(before, { type: "probe:done", ok: false, at: 99 })
    expect(after).toMatchObject({ reachable: false, okAt: 42 })
  })

  it("remembers the dismissal", () => {
    expect(reduceNetwork(state(), { type: "dismiss" }).dismissed).toBe(true)
  })
})

describe("isOffline", () => {
  it("is quiet while the browser reports a link and nothing has been probed", () => {
    expect(isOffline(state(), false)).toBe(false)
    expect(isOffline(state(), true)).toBe(false)
  })

  it("shows offline as soon as the browser loses the link, in both runtimes", () => {
    const down = state({ browserOnline: false })
    expect(isOffline(down, false)).toBe(true)
    expect(isOffline(down, true)).toBe(true)
  })

  it("treats an unreachable api as offline only in the desktop shell", () => {
    const unreachable = state({ reachable: false })
    expect(isOffline(unreachable, false)).toBe(false)
    expect(isOffline(unreachable, true)).toBe(true)
  })

  it("lets a successful probe outrank a lying navigator.onLine", () => {
    const lying = state({ browserOnline: false, reachable: true, okAt: 1 })
    expect(isOffline(lying, false)).toBe(false)
    expect(isOffline(lying, true)).toBe(false)
  })
})

describe("shouldShowOffline", () => {
  it("hides the overlay once the user continues without the network", () => {
    const down = state({ browserOnline: false })
    expect(shouldShowOffline(down, false)).toBe(true)
    expect(shouldShowOffline(reduceNetwork(down, { type: "dismiss" }), false)).toBe(false)
  })
})

describe("nextProbeDelayMs", () => {
  it("polls while offline in both runtimes", () => {
    expect(nextProbeDelayMs(true, false)).toBe(OFFLINE_PROBE_INTERVAL_MS)
    expect(nextProbeDelayMs(true, true)).toBe(OFFLINE_PROBE_INTERVAL_MS)
  })

  it("keeps polling while online only in the desktop shell", () => {
    expect(nextProbeDelayMs(false, false)).toBeNull()
    expect(nextProbeDelayMs(false, true)).toBe(ONLINE_PROBE_INTERVAL_MS)
  })
})

describe("probeUrl", () => {
  it("asks the rpc route for a method nothing implements", () => {
    expect(probeUrl("https://mixture.example/api/rpc")).toBe(
      `https://mixture.example/api/rpc/${PROBE_METHOD}`,
    )
  })

  it("does not double the separator when the base ends in a slash", () => {
    expect(probeUrl("http://localhost:3000/api/rpc/")).toBe(
      `http://localhost:3000/api/rpc/${PROBE_METHOD}`,
    )
  })

  it("stays relative when the base is empty, which is the same-origin case", () => {
    // `rpcBaseUrl()` yields an absolute url in a browser and "/api/rpc" only
    // if it were ever called without one; either way fetch resolves it
    expect(probeUrl("")).toBe(`/${PROBE_METHOD}`)
    expect(probeUrl("/api/rpc")).toBe(`/api/rpc/${PROBE_METHOD}`)
  })
})

describe("probeAnswered", () => {
  it("counts the router's own 404 as an answer and a gateway fault as none", () => {
    // the probe asks for a method nothing implements: 404 is success here
    expect(probeAnswered(404)).toBe(true)
    expect(probeAnswered(200)).toBe(true)
    expect(probeAnswered(502)).toBe(false)
    expect(probeAnswered(503)).toBe(false)
    // a rejected fetch never produces a status
    expect(probeAnswered(0)).toBe(false)
  })
})
