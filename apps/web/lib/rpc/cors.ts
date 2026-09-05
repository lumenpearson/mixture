import { CLOUD_KEY_HEADER, CLOUD_TOKEN_HEADER, EDIT_TOKEN_HEADER } from "./headers"

/* ------------------------------------------------------------------ *
 * cross-origin access to /api/rpc
 *
 * The browser transport is same-origin in the deployed web app, so none of
 * this applies there. Two clients are not: the desktop bundle, which serves
 * the interface from its own local protocol and calls the deployed api, and
 * anyone who points the «адрес сервера» field in the transport settings at
 * another deployment. Both send `x-grpc-web`, `connect-protocol-version` and
 * the credential headers, every one of which forces a preflight.
 *
 * The allow-list is explicit and never `*`: the credential interceptor
 * attaches the edit token and the user's GitHub token to every request, so an
 * origin on this list is an origin that may receive them.
 * ------------------------------------------------------------------ */

/**
 * Where the desktop bundle runs. Tauri serves the local page from
 * `tauri://localhost` on macOS and Linux and from `http://tauri.localhost` on
 * Windows (the custom protocol is mapped onto http there); the https spelling
 * is accepted because the windows webview uses it when the app is built with
 * `dangerousUseHttpScheme` off.
 */
export const DESKTOP_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
] as const

/** exactly what the connect and gRPC-Web clients send, plus our three credentials */
export const ALLOWED_REQUEST_HEADERS = [
  "content-type",
  "connect-protocol-version",
  "connect-timeout-ms",
  "connect-content-encoding",
  "connect-accept-encoding",
  "x-grpc-web",
  "x-user-agent",
  "grpc-timeout",
  EDIT_TOKEN_HEADER,
  CLOUD_TOKEN_HEADER,
  CLOUD_KEY_HEADER,
]

/** a gRPC-Web client reads the status out of the response headers, not the body */
export const EXPOSED_RESPONSE_HEADERS = [
  "grpc-status",
  "grpc-message",
  "grpc-status-details-bin",
  "connect-content-encoding",
]

const MAX_AGE_SECONDS = 600

/** `https://example.com/path/` → `https://example.com`; anything unparseable is dropped */
function toOrigin(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

/* read through an index signature rather than named fields: the repo declares
   its own ProcessEnv, and a narrower shape here would not accept it */
type Env = Record<string, string | undefined>

/**
 * The desktop origins, plus the deployment's own site url, plus whatever
 * `MIXTURE_RPC_ALLOWED_ORIGINS` lists (comma-separated). Duplicates and
 * unparseable entries are dropped.
 */
export function allowedOrigins(env: Env = process.env): string[] {
  const listed = (env["MIXTURE_RPC_ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map(toOrigin)
    .filter((origin): origin is string => origin !== null)
  const site = toOrigin(env["NEXT_PUBLIC_SITE_URL"] ?? "")
  return [...new Set([...DESKTOP_ORIGINS, ...(site ? [site] : []), ...listed])]
}

/**
 * The headers that let `origin` talk to this route, or null when it may not.
 * A request with no `Origin` header is same-origin (or not a browser) and
 * needs nothing.
 */
export function corsHeaders(origin: string | null, env: Env = process.env): Record<string, string> | null {
  if (!origin) return null
  // `tauri://localhost` has no parseable origin in every runtime, so compare
  // the raw header against the list rather than round-tripping through URL
  if (!allowedOrigins(env).includes(origin)) return null
  return {
    "Access-Control-Allow-Origin": origin,
    // the answer depends on the request's origin, so a shared cache must not
    // hand one origin's response to another
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS.join(", "),
    "Access-Control-Expose-Headers": EXPOSED_RESPONSE_HEADERS.join(", "),
    "Access-Control-Max-Age": String(MAX_AGE_SECONDS),
  }
}

/** answer a preflight: 204 for an allowed origin, 403 for anything else */
export function preflight(request: Request, env: Env = process.env): Response {
  const headers = corsHeaders(request.headers.get("origin"), env)
  if (!headers) {
    return new Response(null, { status: 403, headers: { Vary: "Origin", "Cache-Control": "no-store" } })
  }
  return new Response(null, { status: 204, headers })
}

/** mirror the allow-list onto a real answer, so the browser hands it to the client */
export function withCors(response: Response, request: Request, env: Env = process.env): Response {
  const headers = corsHeaders(request.headers.get("origin"), env)
  if (!headers) {
    response.headers.append("Vary", "Origin")
    return response
  }
  for (const [name, value] of Object.entries(headers)) {
    if (name === "Vary") response.headers.append(name, value)
    else response.headers.set(name, value)
  }
  return response
}
