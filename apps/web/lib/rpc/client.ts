import {
  Code,
  ConnectError,
  createClient,
  type Client,
  type Interceptor,
  type Transport,
} from "@connectrpc/connect"
import { createConnectTransport, createGrpcWebTransport } from "@connectrpc/connect-web"
import { ChangelogService } from "@mixture/protocol/changelog"
import { CloudService } from "@mixture/protocol/cloud"
import { LibraryService } from "@mixture/protocol/library"
import { CLOUD_KEY_HEADER, CLOUD_TOKEN_HEADER, EDIT_TOKEN_HEADER, RPC_BASE_PATH } from "./headers"
import { rpcLog } from "./log"
import { decideRetry, rpcSettingsStore, type RpcSettings } from "./settings"

/* ------------------------------------------------------------------ *
 * browser-side RPC clients
 *
 * Protocol, wire format, deadline, retries and the base url come from
 * `settings.ts`; the transport is rebuilt whenever they change, while the
 * service clients stay the same objects because they talk to a thin
 * delegating transport.
 *
 * Credentials the user pastes into the UI live in localStorage and are
 * attached per request by the interceptor; nothing is stored server-side.
 * ------------------------------------------------------------------ */

export const EDIT_TOKEN_STORAGE_KEY = "mixture-edit-token"
export const CLOUD_TOKEN_STORAGE_KEY = "mixture-cloud-token"
export const CLOUD_KEY_STORAGE_KEY = "mixture-cloud-key"

function readStorage(key: string): string {
  if (typeof window === "undefined") return ""
  try {
    return window.localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

export function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return
  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const getEditToken = () => readStorage(EDIT_TOKEN_STORAGE_KEY)
export const getCloudToken = () => readStorage(CLOUD_TOKEN_STORAGE_KEY)
export const getCloudKey = () => readStorage(CLOUD_KEY_STORAGE_KEY)

const credentials: Interceptor = (next) => async (req) => {
  const edit = getEditToken()
  const token = getCloudToken()
  const key = getCloudKey()
  if (edit) req.header.set(EDIT_TOKEN_HEADER, edit)
  if (token) req.header.set(CLOUD_TOKEN_HEADER, token)
  if (key) req.header.set(CLOUD_KEY_HEADER, key)
  return next(req)
}

/* ------------------------------ retries ------------------------------ */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** which attempt a request is on, so the log can show `#2` for a retry */
const attemptOf = new WeakMap<object, number>()

/**
 * replay a failed unary call while `settings.retries` allows it. Only a
 * transient code is retried (see `decideRetry`); a permission or validation
 * answer is final. Streaming calls are passed through untouched — their
 * request iterable is already consumed by the first attempt.
 */
const retry: Interceptor = (next) => async (req) => {
  const { retries } = rpcSettingsStore.get()
  if (req.stream || retries <= 0) return next(req)
  for (let attempt = 0; ; attempt++) {
    attemptOf.set(req, attempt)
    try {
      return await next(req)
    } catch (error) {
      const decision = decideRetry({
        code: ConnectError.from(error).code,
        attempt,
        retries,
        aborted: req.signal.aborted,
      })
      if (!decision.retry) throw error
      await sleep(decision.delayMs)
    }
  }
}

/* ------------------------------ logging ------------------------------ */

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()

/** `PermissionDenied` → `permission_denied`, the spelling used on the wire */
function codeLabel(code: Code): string {
  const name = Code[code] as string | undefined
  if (!name) return "unknown"
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
}

function responseBytes(header: Headers): number | null {
  const raw = header.get("content-length")
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/**
 * record one entry per attempt. Placed innermost so the duration is the wire
 * time of a single request rather than the sum of the backoff sleeps. Only
 * metadata is written; see `log.ts` for what is deliberately left out.
 */
const logging: Interceptor = (next) => async (req) => {
  if (!rpcSettingsStore.get().log) return next(req)
  const started = now()
  const attempt = attemptOf.get(req) ?? 0
  const common = {
    service: req.service.typeName,
    method: req.method.name,
    attempt,
  }
  try {
    const response = await next(req)
    rpcLog.push({
      ...common,
      at: Date.now(),
      durationMs: Math.round(now() - started),
      bytes: responseBytes(response.header),
      status: "ok",
      code: null,
      message: "",
    })
    return response
  } catch (error) {
    const failure = ConnectError.from(error)
    rpcLog.push({
      ...common,
      at: Date.now(),
      durationMs: Math.round(now() - started),
      bytes: null,
      status: "error",
      code: codeLabel(failure.code),
      message: failure.rawMessage,
    })
    throw error
  }
}

/* ----------------------------- the transport ----------------------------- */

/** where the RPC route lives for the given settings */
export function rpcBaseUrl(settings: RpcSettings = rpcSettingsStore.get()): string {
  if (settings.baseUrl) return `${settings.baseUrl}${RPC_BASE_PATH}`
  if (typeof window !== "undefined") return `${window.location.origin}${RPC_BASE_PATH}`
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  return `${site.replace(/\/$/, "")}${RPC_BASE_PATH}`
}

function build(settings: RpcSettings): Transport {
  const options = {
    baseUrl: rpcBaseUrl(settings),
    useBinaryFormat: settings.format === "binary",
    // outermost first: credentials are set once, the retry replays the call,
    // and the log sees each individual attempt
    interceptors: [credentials, retry, logging],
    defaultTimeoutMs: settings.timeoutMs,
  }
  return settings.protocol === "connect" ? createConnectTransport(options) : createGrpcWebTransport(options)
}

let transport: Transport | null = null
let builtForVersion = -1

/** drop the live transport; the next call builds one from current settings */
export function resetTransport() {
  transport = null
  builtForVersion = -1
}

function activeTransport(): Transport {
  const version = rpcSettingsStore.version()
  if (!transport || builtForVersion !== version) {
    transport = build(rpcSettingsStore.get())
    builtForVersion = version
  }
  return transport
}

/**
 * a stable Transport that forwards to whichever transport the settings
 * currently describe. The service clients below are created once and keep
 * working after a protocol or base-url change.
 */
const delegating: Transport = {
  unary: (method, signal, timeoutMs, header, input, contextValues) =>
    activeTransport().unary(method, signal, timeoutMs, header, input, contextValues),
  stream: (method, signal, timeoutMs, header, input, contextValues) =>
    activeTransport().stream(method, signal, timeoutMs, header, input, contextValues),
}

export function rpcTransport(): Transport {
  return delegating
}

let library: Client<typeof LibraryService> | null = null
let changelog: Client<typeof ChangelogService> | null = null
let cloud: Client<typeof CloudService> | null = null

export function libraryClient() {
  if (!library) library = createClient(LibraryService, rpcTransport())
  return library
}

export function changelogClient() {
  if (!changelog) changelog = createClient(ChangelogService, rpcTransport())
  return changelog
}

export function cloudClient() {
  if (!cloud) cloud = createClient(CloudService, rpcTransport())
  return cloud
}

/**
 * the same call as the browser makes, spelled for a terminal.
 *
 * curl cannot speak binary gRPC-Web, so the command always uses Connect +
 * JSON — which is exactly what the "connect / json" setting switches the
 * browser to. No credential header is included: the command is meant to be
 * pasted into an issue.
 */
export function rpcCurlCommand(
  fullMethod = `${LibraryService.typeName}/GetLibrary`,
  settings: RpcSettings = rpcSettingsStore.get(),
): string {
  return [
    "curl -sS \\",
    "  -H 'content-type: application/json' \\",
    "  -H 'connect-protocol-version: 1' \\",
    `  -H 'connect-timeout-ms: ${settings.timeoutMs}' \\`,
    "  -d '{}' \\",
    `  '${rpcBaseUrl(settings)}/${fullMethod}'`,
  ].join("\n")
}

/** a short human-readable message for any RPC failure */
export function rpcErrorMessage(error: unknown, fallback = "request failed"): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    // ConnectError messages carry the code in brackets: "[permission_denied] …"
    return error.message.replace(/^\[[a-z_]+\]\s*/i, "") || fallback
  }
  return fallback
}
