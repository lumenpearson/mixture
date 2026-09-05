/* ------------------------------------------------------------------ *
 * url rules of the media layer
 *
 * One description of what a screen may point at. A site insert, a file
 * insert and the creation wizard all ask the same two questions: is this an
 * http(s) url at all, and may this url become a top-level document. The
 * write-time gate in lib/screenkit/insert-kinds.ts is not enough on its own —
 * a per-browser override, a restored backup row or a draft never passes
 * through it, and the answer must be the same everywhere.
 * ------------------------------------------------------------------ */

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

const schemeOf = (value: string): string => (value.match(SCHEME_RE)?.[0] ?? "").toLowerCase()

/** an absolute http(s) url, exactly as typed; bare hosts do not qualify */
export function isHttpUrl(value: string | undefined): boolean {
  const raw = (value ?? "").trim()
  if (!raw) return false
  try {
    const { protocol } = new URL(raw)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/**
 * accept bare hosts ("example.com") and refuse anything but http(s); "" when
 * invalid. `javascript:` and `data:` parse as urls and would otherwise end up
 * as an iframe or media src.
 */
export function normalizeHttpUrl(value: string | undefined): string {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  const withScheme = SCHEME_RE.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(withScheme)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

/* content types whose document executes script in the origin that served it.
   The type declared on a blob is what the browser applies when the blob url
   becomes a document, so an uploaded `logo.svg` is an active document. */
const ACTIVE_CONTENT_TYPES = new Set([
  "image/svg+xml",
  "image/svg",
  "text/html",
  "application/xhtml+xml",
  "text/xml",
  "application/xml",
  "application/xhtml",
])

export const isActiveContentType = (contentType: string | undefined): boolean =>
  ACTIVE_CONTENT_TYPES.has((contentType ?? "").toLowerCase().split(";")[0].trim())

/**
 * May this url be handed to a top-level navigation ("open in a new tab")?
 *
 * A blob: url is same-origin with the workspace: opening one loads its bytes
 * as a document of this origin, with access to `mixture-edit-token`,
 * `mixture-cloud-token` and `mixture-cloud-key` in localStorage. Cloud files
 * are uploaded by editors, so an active type on a blob is refused and the
 * caller offers a download instead. An http(s) url is somebody else's origin
 * and stays openable; every other scheme is refused outright.
 */
export function canOpenInNewTab(url: string, contentType?: string): boolean {
  const scheme = schemeOf(url)
  if (scheme === "http:" || scheme === "https:") return true
  if (scheme === "blob:") return !isActiveContentType(contentType)
  return false
}
