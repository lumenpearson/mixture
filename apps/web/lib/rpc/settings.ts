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
  baseUrl: buildBaseUrl(),
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

/**
 * the api this build was compiled against.
 *
 * `next build` inlines NEXT_PUBLIC_MIXTURE_API_URL. The web build leaves it
 * unset, so the default stays `""` — "the origin this page was served from",
 * which is exactly right for a page the deployment served. The desktop bundle
 * is a static export loaded from disk over `tauri://localhost`, an origin with
 * no api behind it, so its export is built with the deployment's origin here
 * and every transport it creates carries an absolute base url.
 *
 * A function declaration rather than a const so `DEFAULT_RPC_SETTINGS` above
 * can call it: declarations hoist, `const` initialisers do not.
 */
function buildBaseUrl(): string {
  const check = checkBaseUrl(process.env.NEXT_PUBLIC_MIXTURE_API_URL ?? "")
  return check.ok ? check.value : ""
}

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
    // a rejected or cleared override falls back to the url this build was
    // compiled against, never to the previous value: an unusable url must not
    // keep sending tokens anywhere. On the web that fallback is `""` — the
    // same origin, as before — and in the desktop bundle it is the api,
    // because there `""` would mean tauri://localhost and nothing answers there
    baseUrl: (baseUrl.ok && baseUrl.value) || DEFAULT_RPC_SETTINGS.baseUrl,
    log: typeof raw.log === "boolean" ? raw.log : DEFAULT_RPC_SETTINGS.log,
  }
}

/* ---------------------------- retry policy ---------------------------- */

/**
 * which rpcs may be replayed after a transient failure.
 *
 * A retry is only safe when a second attempt cannot change the world twice.
 * `AddInsert` derives a fresh id per attempt (`uniqueId` in
 * `library.service.ts`), so replaying it after the row was already committed
 * — a gateway 502/504 can arrive long after the write finished — inserts a
 * second copy under `<slug>-2` and the user sees no error at all. The cloud
 * mutations commit to GitHub the same way: replaying a `MoveEntry` that
 * already succeeded answers `not_found` for an operation that worked.
 *
 * The decision is an explicit per-method list, not a guess from the verb: the
 * proto carries no idempotency level, and inferring one from a name would put
 * the safety of a mutation in the hands of whoever names the next rpc. The key
 * is `<service type name>/<method name>` — exactly the pair the interceptor
 * reads off the request.
 */
export const RPC_REPLAYABLE_METHODS: readonly string[] = [
  "mixture.library.v1.LibraryService/GetLibrary",
  "mixture.changelog.v1.ChangelogService/GetChangelog",
  "mixture.cloud.v1.CloudService/GetStatus",
  "mixture.cloud.v1.CloudService/ListEntries",
  "mixture.cloud.v1.CloudService/GetTree",
  "mixture.cloud.v1.CloudService/StatEntry",
  "mixture.cloud.v1.CloudService/ReadFile",
  "mixture.cloud.v1.CloudService/CreateStreamTicket",
  "mixture.cloud.v1.CloudService/GetConfig",
]

/**
 * the other half of the same decision: every rpc that writes. Nothing reads
 * this list at runtime — it exists so that adding an rpc without classifying
 * it is a test failure rather than a silent replay (`settings.test.ts` walks
 * the generated service descriptors and asserts the two lists together cover
 * every method exactly once).
 */
export const RPC_MUTATING_METHODS: readonly string[] = [
  "mixture.library.v1.LibraryService/AddCategory",
  "mixture.library.v1.LibraryService/AddInsert",
  "mixture.library.v1.LibraryService/DeleteInsert",
  "mixture.library.v1.LibraryService/DeleteCategory",
  "mixture.library.v1.LibraryService/ResetLibrary",
  "mixture.cloud.v1.CloudService/InitRepository",
  "mixture.cloud.v1.CloudService/WriteFile",
  "mixture.cloud.v1.CloudService/DeleteEntry",
  "mixture.cloud.v1.CloudService/MoveEntry",
  "mixture.cloud.v1.CloudService/CreateDirectory",
  "mixture.cloud.v1.CloudService/UpdateConfig",
]

const replayableMethods = new Set(RPC_REPLAYABLE_METHODS)

/** may a failed call of this method be sent again? Unknown methods may not. */
export function isReplayableMethod(service: string, method: string): boolean {
  return replayableMethods.has(`${service}/${method}`)
}

/**
 * codes worth another attempt. A dropped connection and a server fault are
 * transient; a Vercel gateway 502/503/504 arrives as `unavailable`.
 *
 * `deadline_exceeded` is deliberately absent. The deadline is the budget for
 * the whole call, not for one attempt: connect links the transport's timeout
 * signal into `req.signal` once per unary call, so by the time the rejection
 * reaches the interceptor that signal is already aborted and the replay would
 * die before it reached the wire. Listing the code would only buy a sleep and
 * the same failure.
 *
 * `permission_denied`, `invalid_argument`, `failed_precondition`, `not_found`
 * and `unauthenticated` are answers, not failures: repeating them cannot
 * change the outcome and only multiplies the load and the GitHub rate-limit
 * spend.
 */
export const RPC_RETRYABLE_CODES: readonly Code[] = [Code.Unavailable, Code.Internal]

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
  /**
   * whether sending this call a second time is safe — `isReplayableMethod`
   * for the method that failed. Required rather than optional: a caller that
   * forgets it must not fall into replaying a mutation.
   */
  replayable: boolean
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
  const { code, replayable, attempt, retries, stream = false, aborted = false, random } = input
  if (stream || aborted) return { retry: false, delayMs: 0 }
  // a mutation is never replayed, however transient the failure looks: the
  // server may have committed it and answered through a gateway that gave up
  if (!replayable) return { retry: false, delayMs: 0 }
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
