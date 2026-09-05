import { isHttpUrl } from "@/lib/media/url"
import { normalizeCloudPath } from "@/lib/rpc/cloud/glob"
import type { Insert, InsertKind, InsertSource } from "./types"

/* ------------------------------------------------------------------ *
 * insert kinds: metadata, per-kind defaults and source validation
 *
 * An insert renders either a packaged scene (the default), a live website in
 * the device frame, or a file from the cloud drive. Everything here is pure
 * and client-safe on purpose: the creation wizard needs the same rules the
 * server enforces, and a rule written twice drifts. The server calls these
 * helpers itself (lib/rpc/library.service.ts) instead of trusting the client
 * to have called them — this module is shared code, not a gate.
 * ------------------------------------------------------------------ */

export type InsertKindMeta = {
  id: InsertKind
  /** name from the shared icon library (components/screenkit/icons.tsx) */
  icon: string
}

export const INSERT_KINDS: readonly InsertKindMeta[] = [
  { id: "scene", icon: "layers" },
  { id: "site", icon: "globe" },
  { id: "file", icon: "folder" },
]

export const INSERT_KIND_IDS = INSERT_KINDS.map((kind) => kind.id)

export const isInsertKind = (value: unknown): value is InsertKind =>
  typeof value === "string" && INSERT_KIND_IDS.includes(value as InsertKind)

/** an insert without an explicit kind is a packaged scene */
export const insertKindOf = (insert: Pick<Insert, "kind">): InsertKind => insert.kind ?? "scene"

export const isSiteInsert = (insert: Pick<Insert, "kind">): boolean => insertKindOf(insert) === "site"
export const isFileInsert = (insert: Pick<Insert, "kind">): boolean => insertKindOf(insert) === "file"

/** the settings a new insert of this kind starts with */
const DEFAULT_SOURCES: Record<InsertKind, InsertSource> = {
  scene: {},
  // a site is framed whole and stays still unless the author allows scrolling
  site: { fit: "contain", zoom: 1, scroll: false },
  // a file behaves like a looping prop screen: it plays by itself, silently
  file: { fit: "contain", autoplay: true, loop: true, muted: true },
}

/** a fresh copy, safe to mutate */
export const defaultSource = (kind: InsertKind): InsertSource => ({ ...DEFAULT_SOURCES[kind] })

/** which source fields mean anything for a kind; the rest is dropped */
const SOURCE_FIELDS: Record<InsertKind, readonly (keyof InsertSource)[]> = {
  scene: ["sceneKey"],
  site: ["url", "fit", "zoom", "scroll", "background"],
  file: ["url", "path", "fit", "zoom", "autoplay", "loop", "muted", "background"],
}

export const MAX_SOURCE_URL_LENGTH = 2000
/** the same ceiling the cloud service applies to a file path */
export const MAX_SOURCE_PATH_LENGTH = 512
export const MIN_SOURCE_ZOOM = 0.25
/* the renderer clamps to this and both zoom sliders stop here; a source
   written by a non-browser client used to be accepted at 4 and then drawn at
   3, which is a validator that agrees with nothing */
export const MAX_SOURCE_ZOOM = 3

/* the background reaches an inline style on every visitor's screen, so it is
   held to the same shape as a category accent (ACCENT_RE in
   lib/rpc/library.service.ts): an accent variable, a hex literal or rgb(a) —
   never something that could smuggle in url() or a second declaration */
export const SOURCE_COLOR_RE = /^(var\(--accent-[a-z]+\)|#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i

/* a scene package key (`packages/inserts/*` manifest `key`). Existence is not
   checked here: this module stays free of the scene registry, which pulls in
   every scene component, and an unknown key resolves through the same
   id/category/fallback chain an absent one does. */
export const SCENE_KEY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

const CONTROL_CHARS = /[\x00-\x1f\x7f]/

export type SourceCheck = { ok: true } | { ok: false; field: string; message: string }

const fail = (field: string, message: string): SourceCheck => ({ ok: false, field, message })

const isSet = (value: unknown): boolean => value !== undefined && value !== null && value !== ""

/** true when anything at all was chosen for this source */
export const hasSource = (source: InsertSource | undefined): boolean =>
  source ? Object.values(source).some(isSet) : false

const isLoopbackHost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"

/**
 * This app's own origin, as far as the caller can see it: the page in the
 * browser, the configured site url on the server. A site insert framing it
 * would be genuinely same-origin with a document whose localStorage holds the
 * edit token and the user's GitHub token, and the frame keeps `allow-scripts`.
 */
function appOrigins(): string[] {
  const origins: string[] = []
  if (typeof window !== "undefined" && window.location?.origin) origins.push(window.location.origin)
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site) {
    try {
      origins.push(new URL(site).origin)
    } catch {
      // a misconfigured site url is not this function's problem
    }
  }
  return origins
}

/**
 * An https url, or http against the developer's own machine. Everything else
 * is refused: `javascript:` and `data:` parse as urls and would end up as an
 * iframe / media src, and plain http is blocked as mixed content anyway.
 */
export function checkSourceUrl(value: string | undefined, field = "source.url"): SourceCheck {
  const raw = (value ?? "").trim()
  if (!raw) return fail(field, "an https url is required")
  if (raw.length > MAX_SOURCE_URL_LENGTH) {
    return fail(field, `must be at most ${MAX_SOURCE_URL_LENGTH} characters`)
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return fail(field, "must be a valid url")
  }
  if (appOrigins().includes(parsed.origin)) {
    return fail(field, "cannot frame this app")
  }
  if (parsed.protocol === "https:") return { ok: true }
  if (parsed.protocol === "http:" && isLoopbackHost(parsed.hostname)) return { ok: true }
  return fail(field, "must be an https url")
}

/**
 * A cloud-drive path, cleaned the way the cloud service cleans one: no
 * traversal, no `.git`, no control characters — a file insert must not be
 * able to point the drive at something outside it.
 */
export function checkSourcePath(value: string | undefined, field = "source.path"): SourceCheck {
  const clean = normalizeCloudPath((value ?? "").trim())
  if (!clean) return fail(field, "a cloud path is required")
  if (clean.length > MAX_SOURCE_PATH_LENGTH) return fail(field, "path is too long")
  for (const raw of clean.split("/")) {
    // lower-cased before the comparison exactly as the cloud service's
    // `cleanPath` does; two copies of one rule that disagree on case let
    // ".GIT/config" into the library and then fail on every read
    const segment = raw.toLowerCase()
    if (segment === ".." || segment === ".git" || CONTROL_CHARS.test(segment)) {
      return fail(field, "forbidden path segment")
    }
  }
  return { ok: true }
}

/**
 * The one description of what a valid source is. Called by the server before
 * a row is written and by the wizard while the author types.
 */
export function validateSource(kind: InsertKind, source: InsertSource | undefined): SourceCheck {
  const value = source ?? {}

  /* a packaged scene draws itself: the only thing an author picks for one is
     which package draws it, and any other field would be silently ignored */
  if (kind === "scene") {
    const sceneKey = (value.sceneKey ?? "").trim()
    if (sceneKey && !SCENE_KEY_RE.test(sceneKey)) {
      return fail("source.sceneKey", "must be a scene package key")
    }
    const rest = { ...value }
    delete rest.sceneKey
    return hasSource(rest) ? fail("source", "a scene insert carries no source") : { ok: true }
  }

  if (value.fit !== undefined && value.fit !== "contain" && value.fit !== "cover") {
    return fail("source.fit", "must be contain or cover")
  }
  if (value.zoom !== undefined) {
    if (typeof value.zoom !== "number" || !Number.isFinite(value.zoom)) {
      return fail("source.zoom", "must be a number")
    }
    if (value.zoom < MIN_SOURCE_ZOOM || value.zoom > MAX_SOURCE_ZOOM) {
      return fail("source.zoom", `must be between ${MIN_SOURCE_ZOOM} and ${MAX_SOURCE_ZOOM}`)
    }
  }
  const background = (value.background ?? "").trim()
  if (background && !SOURCE_COLOR_RE.test(background)) {
    return fail("source.background", "unsupported color value")
  }

  if (kind === "site") return checkSourceUrl(value.url)

  // a file comes from the cloud drive or from a direct https url
  const path = (value.path ?? "").trim()
  const url = (value.url ?? "").trim()
  if (!path && !url) return fail("source.path", "a cloud path or an https url is required")
  if (path) {
    const check = checkSourcePath(path)
    if (!check.ok) return check
  }
  if (url) {
    const check = checkSourceUrl(url)
    if (!check.ok) return check
  }
  return { ok: true }
}

/**
 * The source as it should be stored: trimmed, path-normalized, without empty
 * strings and without the fields that mean nothing for this kind. Validate
 * before normalizing — normalizing a scene source empties it.
 */
export function normalizeSource(kind: InsertKind, source: InsertSource | undefined): InsertSource {
  const value = source ?? {}
  const allowed = SOURCE_FIELDS[kind]
  const out: InsertSource = {}
  if (allowed.includes("url")) {
    const url = (value.url ?? "").trim()
    if (url) out.url = url
  }
  if (allowed.includes("path")) {
    const path = normalizeCloudPath((value.path ?? "").trim())
    if (path) out.path = path
  }
  if (allowed.includes("fit") && (value.fit === "contain" || value.fit === "cover")) out.fit = value.fit
  if (allowed.includes("zoom") && typeof value.zoom === "number" && Number.isFinite(value.zoom)) {
    out.zoom = value.zoom
  }
  if (allowed.includes("scroll") && typeof value.scroll === "boolean") out.scroll = value.scroll
  if (allowed.includes("autoplay") && typeof value.autoplay === "boolean") out.autoplay = value.autoplay
  if (allowed.includes("loop") && typeof value.loop === "boolean") out.loop = value.loop
  if (allowed.includes("muted") && typeof value.muted === "boolean") out.muted = value.muted
  if (allowed.includes("background")) {
    const background = (value.background ?? "").trim()
    if (background) out.background = background
  }
  if (allowed.includes("sceneKey")) {
    const sceneKey = (value.sceneKey ?? "").trim()
    if (sceneKey) out.sceneKey = sceneKey
  }
  return out
}

/** a kind read back from an unstructured store (a database column, a draft) */
export const parseInsertKind = (value: unknown): InsertKind => (isInsertKind(value) ? value : "scene")

/**
 * A source read back from the `source` jsonb column: only the known fields
 * with the right types survive, and an empty result is `undefined` so scene
 * rows stay sourceless. The url is held to the same scheme rule as on the
 * way in — a row that never passed `validateSource` (a restored backup, a
 * direct sql write) must not put `javascript:` in front of a visitor.
 */
export function parseInsertSource(value: unknown): InsertSource | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const out: InsertSource = {}
  if (typeof raw.url === "string" && isHttpUrl(raw.url)) out.url = raw.url
  if (typeof raw.path === "string" && raw.path) out.path = raw.path
  if (raw.fit === "contain" || raw.fit === "cover") out.fit = raw.fit
  if (typeof raw.zoom === "number" && Number.isFinite(raw.zoom)) out.zoom = raw.zoom
  if (typeof raw.scroll === "boolean") out.scroll = raw.scroll
  if (typeof raw.autoplay === "boolean") out.autoplay = raw.autoplay
  if (typeof raw.loop === "boolean") out.loop = raw.loop
  if (typeof raw.muted === "boolean") out.muted = raw.muted
  /* held to the same rule as on the way in: this value reaches an inline
     `style` on every visitor's screen, and a row that never passed
     `validateSource` (a restored backup, a direct sql write) must not be able
     to put `url(https://tracker.example/p.gif)` there */
  if (typeof raw.background === "string" && SOURCE_COLOR_RE.test(raw.background.trim())) {
    out.background = raw.background.trim()
  }
  if (typeof raw.sceneKey === "string" && SCENE_KEY_RE.test(raw.sceneKey.trim())) {
    out.sceneKey = raw.sceneKey.trim()
  }
  return Object.keys(out).length ? out : undefined
}
