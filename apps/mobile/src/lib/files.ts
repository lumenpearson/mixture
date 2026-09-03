import type { Palette } from "@/theme/tokens"

/* ------------------------------------------------------------------ *
 * media kinds
 *
 * The android half of apps/web/lib/media/kinds.ts: the same buckets and
 * the same accent per bucket, trimmed to the extensions a file manager
 * on a phone actually shows. Pure functions, no react.
 * ------------------------------------------------------------------ */

export type MediaKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "code"
  | "markdown"
  | "archive"
  | "font"
  | "folder"
  | "other"

const EXT_KIND: Record<string, MediaKind> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", avif: "image",
  svg: "image", bmp: "image", ico: "image", heic: "image", tif: "image", tiff: "image",
  mp4: "video", webm: "video", mov: "video", m4v: "video", mkv: "video", avi: "video", ogv: "video",
  mp3: "audio", wav: "audio", ogg: "audio", oga: "audio", m4a: "audio", flac: "audio", aac: "audio", opus: "audio",
  pdf: "pdf",
  txt: "text", log: "text", srt: "text", vtt: "text", csv: "text", tsv: "text", ini: "text", cfg: "text", env: "text",
  md: "markdown", mdx: "markdown", markdown: "markdown",
  json: "code", js: "code", mjs: "code", cjs: "code", ts: "code", tsx: "code", jsx: "code", css: "code",
  html: "code", htm: "code", xml: "code", yml: "code", yaml: "code", toml: "code", sh: "code", py: "code",
  sql: "code", proto: "code",
  zip: "archive", gz: "archive", tgz: "archive", tar: "archive", rar: "archive", "7z": "archive", bz2: "archive",
  ttf: "font", otf: "font", woff: "font", woff2: "font",
}

const EXT_TYPE: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", svg: "image/svg+xml", heic: "image/heic",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mkv: "video/x-matroska",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac",
  pdf: "application/pdf",
  txt: "text/plain", srt: "text/plain", vtt: "text/vtt", csv: "text/csv",
  md: "text/markdown", json: "application/json", html: "text/html", xml: "application/xml",
  yml: "text/yaml", yaml: "text/yaml",
  zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
}

/** lower-case extension without the dot, "" when there is none */
export function extensionOf(name: string): string {
  const base = name.split("/").pop() ?? name
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return ""
  return base.slice(dot + 1).toLowerCase()
}

/** a content type for a file name, octet-stream when unknown */
export function contentTypeOf(name: string): string {
  return EXT_TYPE[extensionOf(name)] ?? "application/octet-stream"
}

/** classify a file: a specific content type wins, the extension decides otherwise */
export function mediaKindOf(name: string, contentType?: string): MediaKind {
  const type = (contentType ?? "").toLowerCase().split(";")[0].trim()
  const byExt = EXT_KIND[extensionOf(name)]
  if (byExt && (type === "" || type === "application/octet-stream")) return byExt
  if (type.startsWith("image/")) return "image"
  if (type.startsWith("video/")) return "video"
  if (type.startsWith("audio/")) return "audio"
  if (type === "application/pdf") return "pdf"
  return byExt ?? "other"
}

/** the accent a kind is drawn with, mirroring `accentForKind` on the web */
export function accentForKind(kind: MediaKind, palette: Palette): string {
  switch (kind) {
    case "image":
      return palette.accentPurple
    case "video":
      return palette.accentCyan
    case "audio":
      return palette.accentBlue
    case "pdf":
      return palette.accentRed
    case "markdown":
    case "text":
      return palette.accentGreen
    case "code":
      return palette.accentOrange
    case "folder":
      return palette.accentBlue
    default:
      return palette.accentGrey
  }
}

/** the @expo/vector-icons (material community) glyph for a kind */
export function iconForKind(kind: MediaKind): string {
  switch (kind) {
    case "image":
      return "image-outline"
    case "video":
      return "play-circle-outline"
    case "audio":
      return "music-note-outline"
    case "pdf":
      return "file-pdf-box"
    case "markdown":
    case "text":
      return "text-box-outline"
    case "code":
      return "code-braces"
    case "archive":
      return "folder-zip-outline"
    case "font":
      return "format-font"
    case "folder":
      return "folder-outline"
    default:
      return "file-outline"
  }
}

const UNITS = ["b", "kb", "mb", "gb", "tb"]

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 b"
  const index = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${index === 0 ? value : value.toFixed(value >= 10 ? 0 : 1)} ${UNITS[index]}`
}

/** the parent of a posix path, "" at the root */
export function parentOf(path: string): string {
  const trimmed = path.replace(/\/+$/, "")
  const slash = trimmed.lastIndexOf("/")
  return slash <= 0 ? "" : trimmed.slice(0, slash)
}

export const joinPath = (base: string, name: string) => (base ? `${base}/${name}` : name)

const FORBIDDEN_SEGMENTS = new Set([".", "..", ".git"])

/**
 * refuse the paths the cloud service refuses, before any request goes out.
 * A control character would travel into a git path, and the two escapes the
 * server rejects are `..` and the git directory itself.
 */
export function isSafeCloudPath(path: string): boolean {
  if (!path || path.length > 512) return false
  if (path.startsWith("/") || path.endsWith("/")) return false
  for (let index = 0; index < path.length; index += 1) {
    if (path.charCodeAt(index) < 0x20) return false
  }
  return path.split("/").every((segment) => segment.length > 0 && !FORBIDDEN_SEGMENTS.has(segment))
}

/** the upload cap of the vercel request body */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
