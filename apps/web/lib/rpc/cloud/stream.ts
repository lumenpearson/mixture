import { createHmac, timingSafeEqual } from "node:crypto"
import { normalizeCloudPath } from "./glob"

/* ------------------------------------------------------------------ *
 * stream tickets — signed, short-lived permission to read one file
 *
 * A <video> or <audio> element fetches its own bytes and cannot attach the
 * `x-mixture-cloud-token` / `x-mixture-cloud-key` headers the RPCs identify a
 * caller by, so the permission has to travel inside the url. CloudService
 * resolves the caller's role and the file's visibility exactly like ReadFile
 * and then signs a ticket; `/api/cloud/stream` verifies the signature and
 * serves the bytes with the server token.
 *
 * Everything here is pure (hmac and string work only, no IO), so it is unit
 * tested offline like `glob.ts` and `config.ts`.
 *
 * Rules the shape follows:
 * - the ticket carries a path, an expiry and the blob sha, never a token or
 *   an access key: the url ends up in the DOM, in `document.referrer` on any
 *   navigation the page makes, and possibly in a screenshot;
 * - the sha is signed and travels as `v`, so the route can verify a ticket
 *   without asking GitHub anything first — an invalid ticket must not be able
 *   to spend our rate limit;
 * - the signature is compared with `timingSafeEqual`, because a byte-by-byte
 *   compare over an attacker-controlled url leaks the expected digest.
 * ------------------------------------------------------------------ */

/** where the streaming route is mounted (same origin as the app) */
export const STREAM_ROUTE = "/api/cloud/stream"

/** a ticket is worth ten minutes: long enough to watch a scene, short enough
 *  that a leaked url ages out before it is useful */
export const STREAM_TICKET_TTL_MS = 10 * 60_000

/** the largest file the route will stream; GitHub itself refuses raw content
 *  above this, and it bounds what one request can cost us */
export const STREAM_MAX_BYTES = 100 * 1024 * 1024

/** domain label so a key derived from the repository token cannot be replayed
 *  as the token itself, and so a future ticket format can change the label */
const SECRET_LABEL = "mixture-cloud-stream-v1"

const MAX_PATH_LENGTH = 512
const CONTROL_CHARS = /[\x00-\x1f\x7f]/

export type StreamTicket = {
  /** repository-relative posix path */
  path: string
  /** unix milliseconds after which the ticket is refused */
  expires: number
  /** blob sha the ticket was minted for; part of the signed message */
  sha: string
}

export type SignedTicket = StreamTicket & { signature: string }

export type TicketVerdict =
  | { ok: true; ticket: StreamTicket }
  | { ok: false; reason: "malformed" | "signature" | "expired" }

/**
 * The hmac key for stream tickets, or null when the server has nothing to
 * sign with. `MIXTURE_STREAM_SECRET` is the explicit setting; otherwise the
 * key is derived from the cloud repository token, which every deployment that
 * can stream at all already has. Deriving (rather than using the token as the
 * key) keeps the token out of the signing material, so a signature can never
 * be a distinguisher for it.
 */
export function streamSecret(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = (env.MIXTURE_STREAM_SECRET ?? "").trim()
  if (explicit) return explicit
  const token = (env.MIXTURE_CLOUD_GITHUB_TOKEN ?? "").trim()
  if (!token) return null
  return createHmac("sha256", SECRET_LABEL).update(token).digest("hex")
}

/** the signed message: path, expiry and blob sha, separated by a character no
 *  repository path may contain */
const message = (ticket: StreamTicket) => `${ticket.path}|${ticket.expires}|${ticket.sha}`

export function signTicket(ticket: StreamTicket, secret: string): string {
  return createHmac("sha256", secret).update(message(ticket)).digest("hex")
}

/** constant-time comparison of two hex digests; false (never a throw) when the
 *  lengths differ, so a short signature cannot crash the route */
export function timingSafeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  if (left.length !== right.length || left.length === 0) return false
  return timingSafeEqual(left, right)
}

/** the same path rules the RPCs enforce, applied again on the way back in: a
 *  signed ticket is still input, and nothing but a normalised repository path
 *  may reach the GitHub url builder */
function safePath(raw: string): string | null {
  const path = normalizeCloudPath(raw)
  if (!path || path !== raw.trim() || path.length > MAX_PATH_LENGTH) return null
  for (const segment of path.split("/")) {
    if (segment === ".." || segment === ".git" || CONTROL_CHARS.test(segment)) return null
  }
  return path
}

/** `/api/cloud/stream?p=<path>&e=<expires>&v=<sha>&s=<signature>` */
export function buildStreamUrl(ticket: StreamTicket, secret: string): string {
  const params = new URLSearchParams({
    p: ticket.path,
    e: String(ticket.expires),
    v: ticket.sha,
    s: signTicket(ticket, secret),
  })
  return `${STREAM_ROUTE}?${params.toString()}`
}

/** read a ticket out of a query string without trusting any of it yet */
export function parseStreamParams(params: URLSearchParams): SignedTicket | null {
  const rawPath = params.get("p") ?? ""
  const rawExpires = params.get("e") ?? ""
  const sha = (params.get("v") ?? "").trim()
  const signature = (params.get("s") ?? "").trim()
  const path = safePath(rawPath)
  const expires = Number(rawExpires)
  if (!path || !signature || !/^[0-9a-f]+$/i.test(signature)) return null
  if (!/^[0-9a-f]{0,64}$/i.test(sha)) return null
  if (!Number.isSafeInteger(expires) || expires <= 0) return null
  return { path, expires, sha, signature }
}

/** the same, from a url (absolute or app-relative) — used by tests and callers
 *  that only kept the string */
export function parseStreamUrl(url: string): SignedTicket | null {
  try {
    const parsed = new URL(url, "http://cloud.invalid")
    if (parsed.pathname !== STREAM_ROUTE) return null
    return parseStreamParams(parsed.searchParams)
  } catch {
    return null
  }
}

/**
 * Verify a ticket: signature first, expiry second. Both answers are the same
 * 403 to the caller — the route must not say whether a url was forged or
 * merely stale, because that difference is an oracle over the secret.
 */
export function verifyStreamTicket(
  ticket: SignedTicket | null,
  secret: string,
  now: number = Date.now(),
): TicketVerdict {
  if (!ticket) return { ok: false, reason: "malformed" }
  const expected = signTicket({ path: ticket.path, expires: ticket.expires, sha: ticket.sha }, secret)
  if (!timingSafeCompare(expected, ticket.signature)) return { ok: false, reason: "signature" }
  if (ticket.expires <= now) return { ok: false, reason: "expired" }
  return { ok: true, ticket: { path: ticket.path, expires: ticket.expires, sha: ticket.sha } }
}

/* --------------------------- response shaping --------------------------- */

export type ByteRange = { start: number; end: number }

/**
 * Parse a `Range` header against a known size. Returns null when the request
 * asks for the whole file (or asks in a way we do not serve: multiple ranges,
 * a unit other than bytes), and "unsatisfiable" when the window starts past
 * the end — that one is a 416, not a silent full body.
 */
export function parseByteRange(
  header: string | null | undefined,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (!header || !Number.isFinite(size) || size <= 0) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return null

  if (!rawStart) {
    // suffix form: the last N bytes
    const length = Number(rawEnd)
    if (!Number.isSafeInteger(length) || length <= 0) return "unsatisfiable"
    return { start: Math.max(0, size - length), end: size - 1 }
  }

  const start = Number(rawStart)
  if (!Number.isSafeInteger(start) || start < 0) return null
  if (start >= size) return "unsatisfiable"
  const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1
  if (!Number.isSafeInteger(end) || end < start) return "unsatisfiable"
  return { start, end }
}

/** types a browser would execute in *our* origin if we served them inline.
 *  The drive is user content and the app's origin holds the visitor's GitHub
 *  token in localStorage, so these are handed back as opaque bytes instead. */
const ACTIVE_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
  "text/xml",
  "application/xml",
])

export function safeStreamContentType(contentType: string): string {
  const base = (contentType.split(";")[0] ?? "").trim().toLowerCase()
  if (!base) return "application/octet-stream"
  return ACTIVE_CONTENT_TYPES.has(base) ? "application/octet-stream" : base
}

/** `inline` with both the ascii and the utf-8 spelling of the file name */
export function inlineDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "file"
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}
