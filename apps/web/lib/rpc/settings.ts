import { Code } from "@connectrpc/connect"

/* ------------------------------------------------------------------ *
 * rpc connection settings
 *
 * The transport is not a constant. The desktop shell loads the site from a
 * remote origin and needs an absolute base url; someone debugging a handler
 * with curl needs Connect + JSON instead of binary gRPC-Web; a flaky mobile
 * network needs a retry or two. Everything the browser needs to build a
 * transport lives here — framework-free, so `client.ts`, the settings card
 * and the tests read the same object. Persisted under `screenkit-rpc-v1`.
 *
 * This module carries no credentials: tokens stay in their own localStorage
 * keys and are attached by the interceptor in `client.ts`.
 * ------------------------------------------------------------------ */

export const RPC_SETTINGS_STORAGE_KEY = "screenkit-rpc-v1"

/** gRPC-Web is the default; Connect is the same route, readable by curl */
export const RPC_PROTOCOLS = ["grpc-web", "connect"] as const
export type RpcProtocol = (typeof RPC_PROTOCOLS)[number]

/** binary protobuf is smaller and faster; json is readable in devtools */
export const RPC_FORMATS = ["binary", "json"] as const
export type RpcFormat = (typeof RPC_FORMATS)[number]

export const RPC_TIMEOUT_MIN_MS = 5_000
export const RPC_TIMEOUT_MAX_MS = 120_000
export const RPC_TIMEOUT_STEP_MS = 1_000
export const RPC_RETRIES_MAX = 5

/** mirrors `maxTimeoutMs` in `lib/rpc/router.ts`: this deployment refuses a
 *  longer deadline with invalid_argument, so the card warns above it instead
 *  of clamping — a remote host configured by the desktop shell may allow more */
export const RPC_SERVER_MAX_TIMEOUT_MS = 60_000

export type RpcSettings = {
  protocol: RpcProtocol
  format: RpcFormat
  /** per-call deadline sent to the server, 5 s … 120 s */
  timeoutMs: number
  /** extra attempts after the first failure, 0 … 5 */
  retries: number
  /** absolute origin (plus optional path prefix) or "" for the same origin */
  baseUrl: string
  /** record every call in the in-memory activity log */
  log: boolean
}

export const DEFAULT_RPC_SETTINGS: RpcSettings = {
  protocol: "grpc-web",
  format: "binary",
  timeoutMs: 30_000,
  retries: 2,
  baseUrl: "",
  // on in development so a broken handler shows up in the settings card
  // without anyone opening devtools; off in production, where the log would
  // only grow while nobody reads it
  log: process.env.NODE_ENV === "development",
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** `Number(null)` is 0 and `Number(true)` is 1; a stored non-number must fall
 *  back to the default instead of silently becoming a valid setting */
const num = (value: unknown): number =>
  typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN

/* ---------------------------- base url ---------------------------- */

export type RpcBaseUrlProblem = "invalid" | "insecure" | "credentials"

export type RpcBaseUrlCheck =
  | { ok: true; value: string }
  | { ok: false; reason: RpcBaseUrlProblem }

/**
 * validate a base url override.
 *
 * Every request carries the edit token and, in the cloud tab, a GitHub token,
 * so an override decides where those credentials are sent. Only https is
 * accepted; plain http is allowed for loopback alone, because that is the
 * desktop shell talking to `next dev` on the same machine. Embedded
 * `user:password` is refused outright — the transport would put it in the
 * request url and the log.
 */
export function checkBaseUrl(input: string): RpcBaseUrlCheck {
  const raw = input.trim()
  if (!raw) return { ok: true, value: "" }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: "invalid" }
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]"
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    return { ok: false, reason: "insecure" }
  }
  if (url.username || url.password) return { ok: false, reason: "credentials" }
  // keep an optional path prefix, drop the trailing slash, query and hash:
  // `/api/rpc` is appended to this value by the transport
  return { ok: true, value: `${url.origin}${url.pathname.replace(/\/+$/, "")}` }
}

/* --------------------------- normalization --------------------------- */

/** validate a stored or foreign object into settings, field by field */
export function normalizeRpcSettings(input: unknown): RpcSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const oneOf = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
    (values as readonly string[]).includes(String(value)) ? (value as T) : fallback
  const timeout = num(raw.timeoutMs)
  const retries = num(raw.retries)
  const baseUrl = checkBaseUrl(typeof raw.baseUrl === "string" ? raw.baseUrl : "")
  return {
    protocol: oneOf(raw.protocol, RPC_PROTOCOLS, DEFAULT_RPC_SETTINGS.protocol),
    format: oneOf(raw.format, RPC_FORMATS, DEFAULT_RPC_SETTINGS.format),
    timeoutMs: Number.isFinite(timeout)
      ? clamp(Math.round(timeout), RPC_TIMEOUT_MIN_MS, RPC_TIMEOUT_MAX_MS)
      : DEFAULT_RPC_SETTINGS.timeoutMs,
    retries: Number.isFinite(retries) ? clamp(Math.round(retries), 0, RPC_RETRIES_MAX) : DEFAULT_RPC_SETTINGS.retries,
    // a rejected override falls back to the same origin rather than to the
    // previous value: an unusable url must never keep sending tokens anywhere
    baseUrl: baseUrl.ok ? baseUrl.value : "",
    log: typeof raw.log === "boolean" ? raw.log : DEFAULT_RPC_SETTINGS.log,
  }
}

/* ---------------------------- retry policy ---------------------------- */

/**
 * codes worth another attempt. A dropped connection, an expired deadline and
 * a server fault are transient. `permission_denied`, `invalid_argument`,
 * `failed_precondition`, `not_found` and `unauthenticated` are answers, not
 * failures: repeating them cannot change the outcome and only multiplies the
 * load and the GitHub rate-limit spend.
 */
export const RPC_RETRYABLE_CODES: readonly Code[] = [Code.Unavailable, Code.DeadlineExceeded, Code.Internal]

/** first backoff step; doubles per attempt up to the ceiling */
export const RPC_RETRY_BASE_MS = 250
export const RPC_RETRY_CEILING_MS = 4_000

export function isRetryableCode(code: unknown): boolean {
  return typeof code === "number" && RPC_RETRYABLE_CODES.includes(code as Code)
}

/**
 * how long to wait before attempt `attempt + 1`, with equal jitter: half the
 * exponential window plus a random half. Without the jitter a page that fired
 * several calls at once would retry them all in the same millisecond.
 */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const window = Math.min(RPC_RETRY_CEILING_MS, RPC_RETRY_BASE_MS * 2 ** Math.max(0, attempt))
  return Math.round(window / 2 + random() * (window / 2))
}

export type RetryInput = {
  /** the Connect code of the failure, if it has one */
  code: unknown
  /** zero-based index of the attempt that just failed */
  attempt: number
  /** how many extra attempts the settings allow */
  retries: number
  /** streaming calls are never replayed: their request iterable is consumed */
  stream?: boolean
  /** the caller aborted; a retry would be work nobody waits for */
  aborted?: boolean
  random?: () => number
}

export type RetryDecision = { retry: boolean; delayMs: number }

/** the single place that decides whether a failed unary call is tried again */
export function decideRetry(input: RetryInput): RetryDecision {
  const { code, attempt, retries, stream = false, aborted = false, random } = input
  if (stream || aborted) return { retry: false, delayMs: 0 }
  if (attempt >= Math.min(retries, RPC_RETRIES_MAX)) return { retry: false, delayMs: 0 }
  if (!isRetryableCode(code)) return { retry: false, delayMs: 0 }
  return { retry: true, delayMs: retryDelayMs(attempt, random) }
}

/* ------------------------------ the store ------------------------------ */

type Listener = () => void

let state: RpcSettings = DEFAULT_RPC_SETTINGS
let loaded = false
let version = 0
const listeners = new Set<Listener>()

function load(): RpcSettings {
  if (loaded) return state
  loaded = true
  if (typeof window === "undefined") return state
  try {
    const raw = window.localStorage.getItem(RPC_SETTINGS_STORAGE_KEY)
    if (raw) state = normalizeRpcSettings(JSON.parse(raw))
  } catch {
    state = DEFAULT_RPC_SETTINGS
  }
  return state
}

function persist() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(RPC_SETTINGS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage may be full or blocked; the in-memory value still applies
  }
}

function commit(next: RpcSettings) {
  state = next
  version += 1
  persist()
  listeners.forEach((listener) => listener())
}

export const rpcSettingsStore = {
  get: (): RpcSettings => load(),
  /** the value used during server rendering and hydration */
  getServer: (): RpcSettings => DEFAULT_RPC_SETTINGS,
  /**
   * bumped on every change. `client.ts` compares it against the version the
   * live transport was built with, so a setting takes effect on the next call
   * without anyone remembering to call `resetTransport()`.
   */
  version: (): number => version,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  update(patch: Partial<RpcSettings>) {
    commit(normalizeRpcSettings({ ...load(), ...patch }))
  },
  reset() {
    commit(DEFAULT_RPC_SETTINGS)
  },
}
