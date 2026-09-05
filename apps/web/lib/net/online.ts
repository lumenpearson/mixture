import { isTauriRuntime } from "@/lib/local/bridge"
import { rpcBaseUrl } from "@/lib/rpc/client"

/* ------------------------------------------------------------------ *
 * connectivity store
 *
 * `navigator.onLine` only knows whether the machine has a link; it says
 * nothing about whether our api answers. The desktop shell loads the site
 * from a remote origin, so for it an unreachable api is indistinguishable
 * from being offline — while in a browser tab a failed probe may only mean
 * the deployment is having a bad minute, and the tab is still perfectly
 * usable on the built-in library. Hence one store with two verdicts, chosen
 * by `strict` (true inside Tauri).
 *
 * Module-level and framework-free, like `lib/rpc/settings.ts`: the overlay
 * reads it through `useSyncExternalStore` and the reducer below is pure so
 * it can be tested without a dom. Nothing here is persisted — connectivity
 * is not a preference.
 * ------------------------------------------------------------------ */

/**
 * What the probe asks for: a method name the router does not have, under the
 * rpc mount point. The router answers `404 unknown rpc` without touching the
 * database or GitHub, and — unlike a static file — that answer carries the
 * cross-origin headers `lib/rpc/cors.ts` puts on this route. The desktop
 * bundle calls the api from its own local origin, so a probe at
 * `/manifest.webmanifest` would be rejected by the browser for having no
 * `Access-Control-Allow-Origin` and the shell would report "no network" while
 * the api was answering perfectly.
 */
export const PROBE_METHOD = "mixture.probe.v1.Reachability/Ping"
export const PROBE_TIMEOUT_MS = 5_000
/** while offline: often enough to feel instant, rare enough to be free */
export const OFFLINE_PROBE_INTERVAL_MS = 20_000
/** while online: desktop only, where a dead api is a dead app */
export const ONLINE_PROBE_INTERVAL_MS = 60_000

export type NetworkState = {
  /** what the browser thinks of the link */
  browserOnline: boolean
  /** last reachability verdict; null until the first probe answers */
  reachable: boolean | null
  /** a probe is in flight */
  probing: boolean
  /** unix ms of the last successful probe, 0 when there was none */
  okAt: number
  /** the user chose to keep working without the network */
  dismissed: boolean
}

export const INITIAL_NETWORK_STATE: NetworkState = {
  browserOnline: true,
  reachable: null,
  probing: false,
  okAt: 0,
  dismissed: false,
}

export type NetworkEvent =
  | { type: "browser"; online: boolean }
  | { type: "probe:start" }
  | { type: "probe:done"; ok: boolean; at: number }
  | { type: "dismiss" }

const same = (a: NetworkState, b: NetworkState): boolean =>
  a.browserOnline === b.browserOnline &&
  a.reachable === b.reachable &&
  a.probing === b.probing &&
  a.okAt === b.okAt &&
  a.dismissed === b.dismissed

/**
 * the whole decision surface, as one pure function.
 *
 * A disconnect clears `reachable`: a probe that succeeded a minute ago must
 * not outrank the link dropping now. The opposite direction is deliberate —
 * a fresh successful probe does outrank `navigator.onLine === false`, which
 * is exactly the case the retry button exists for (webviews and vpns lie
 * about the link more often than the api lies about being up).
 */
export function reduceNetwork(state: NetworkState, event: NetworkEvent): NetworkState {
  const next = ((): NetworkState => {
    switch (event.type) {
      case "browser":
        return event.online
          ? { ...state, browserOnline: true }
          : { ...state, browserOnline: false, reachable: null }
      case "probe:start":
        return { ...state, probing: true }
      case "probe:done":
        return event.ok
          ? { ...state, probing: false, reachable: true, okAt: event.at }
          : { ...state, probing: false, reachable: false }
      case "dismiss":
        return { ...state, dismissed: true }
    }
  })()
  // a snapshot that did not change must stay the same object, or every
  // subscriber re-renders on each probe tick
  return same(state, next) ? state : next
}

/**
 * is the app cut off?
 *
 * `strict` is the desktop shell: there the remote api is the app, so a
 * failed probe alone counts as offline. In a browser tab only the link
 * matters — the tab was served from the same origin it is probing and stays
 * usable on the built-in library either way.
 */
export function isOffline(state: NetworkState, strict: boolean): boolean {
  if (state.reachable === true) return false
  if (!state.browserOnline) return true
  return strict ? state.reachable === false : false
}

/** offline verdict plus the user's choice to ignore it */
export function shouldShowOffline(state: NetworkState, strict: boolean): boolean {
  return !state.dismissed && isOffline(state, strict)
}

/**
 * when to probe again, or null to stop until something happens. While
 * offline everyone polls; while online only the desktop shell does, because
 * a browser tab learns about a dead link from the `offline` event for free.
 */
export function nextProbeDelayMs(offline: boolean, tauri: boolean): number | null {
  if (offline) return OFFLINE_PROBE_INTERVAL_MS
  return tauri ? ONLINE_PROBE_INTERVAL_MS : null
}

/** the probe target: the rpc mount point plus a method nothing implements */
export function probeUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "")
  return `${trimmed}/${PROBE_METHOD}`
}

/**
 * Did the server answer at all? A 404 is the expected answer and means the
 * route is alive; a gateway 5xx means the deployment is not. A rejected fetch
 * never reaches here — that is the offline case.
 */
export const probeAnswered = (status: number): boolean => status > 0 && status < 500

/* ------------------------------ the store ------------------------------ */

type Listener = () => void

let state: NetworkState = INITIAL_NETWORK_STATE
const listeners = new Set<Listener>()

let watchers = 0
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: AbortController | null = null

function dispatch(event: NetworkEvent) {
  const next = reduceNetwork(state, event)
  if (next === state) return
  state = next
  listeners.forEach((listener) => listener())
  schedule()
}

function schedule() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (watchers === 0) return
  const tauri = isTauriRuntime()
  const delay = nextProbeDelayMs(isOffline(state, tauri), tauri)
  if (delay == null) return
  timer = setTimeout(() => {
    timer = null
    void probe()
  }, delay)
}

/** one HEAD request with a hard deadline; never throws */
async function probe(): Promise<boolean> {
  if (typeof fetch !== "function") return false
  // a probe started by the retry button supersedes the scheduled one
  inflight?.abort()
  const controller = new AbortController()
  inflight = controller
  const deadline = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  dispatch({ type: "probe:start" })
  try {
    const response = await fetch(probeUrl(rpcBaseUrl()), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
    const ok = probeAnswered(response.status)
    dispatch({ type: "probe:done", ok, at: Date.now() })
    return ok
  } catch {
    dispatch({ type: "probe:done", ok: false, at: Date.now() })
    return false
  } finally {
    clearTimeout(deadline)
    if (inflight === controller) inflight = null
  }
}

const onBrowserOnline = () => {
  dispatch({ type: "browser", online: true })
  void probe()
}

const onBrowserOffline = () => dispatch({ type: "browser", online: false })

/**
 * start watching. Reference-counted so React's double-invoked effects in
 * development do not attach two sets of listeners; the returned function
 * detaches this watcher.
 */
function start(): () => void {
  if (typeof window === "undefined") return () => {}
  watchers += 1
  if (watchers === 1) {
    window.addEventListener("online", onBrowserOnline)
    window.addEventListener("offline", onBrowserOffline)
    dispatch({ type: "browser", online: navigator.onLine !== false })
    void probe()
    schedule()
  }
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    watchers -= 1
    if (watchers > 0) return
    window.removeEventListener("online", onBrowserOnline)
    window.removeEventListener("offline", onBrowserOffline)
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    inflight?.abort()
    inflight = null
  }
}

export const networkStore = {
  get: (): NetworkState => state,
  /** the value used during server rendering and hydration */
  getServer: (): NetworkState => INITIAL_NETWORK_STATE,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  start,
  /** probe right now (the retry button) */
  probeNow: (): Promise<boolean> => probe(),
  dismiss: () => dispatch({ type: "dismiss" }),
}
