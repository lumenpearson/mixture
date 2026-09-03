/* ------------------------------------------------------------------ *
 * media kinds
 *
 * Pure helpers shared by the cloud manager, the file inserts and the
 * creation wizard: what a file is (by extension or content type), how to
 * decode text in the encodings the crew actually meets (windows-1251 exports
 * from old editing software, koi8-r subtitles, utf-16 from windows tools),
 * and small formatters. No React, no DOM beyond TextDecoder.
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
  rs: "code", go: "code", java: "code", kt: "code", swift: "code", c: "code", h: "code", cpp: "code",
  hpp: "code", sql: "code", proto: "code",
  zip: "archive", gz: "archive", tgz: "archive", tar: "archive", rar: "archive", "7z": "archive", bz2: "archive",
  ttf: "font", otf: "font", woff: "font", woff2: "font",
}

const EXT_TYPE: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon", heic: "image/heic",
  tif: "image/tiff", tiff: "image/tiff",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v", mkv: "video/x-matroska",
  avi: "video/x-msvideo", ogv: "video/ogg",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac",
  aac: "audio/aac", opus: "audio/opus",
  pdf: "application/pdf",
  txt: "text/plain", log: "text/plain", srt: "text/plain", vtt: "text/vtt", csv: "text/csv", tsv: "text/tab-separated-values",
  md: "text/markdown", mdx: "text/markdown", markdown: "text/markdown",
  json: "application/json", js: "text/javascript", mjs: "text/javascript", cjs: "text/javascript", ts: "text/plain",
  tsx: "text/plain", jsx: "text/plain", css: "text/css", html: "text/html", htm: "text/html", xml: "application/xml",
  yml: "text/yaml", yaml: "text/yaml", toml: "text/plain", sh: "text/x-shellscript", py: "text/x-python",
  zip: "application/zip", gz: "application/gzip", tgz: "application/gzip", tar: "application/x-tar",
  rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
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

/**
 * classify a file. the content type wins when it is specific; the extension
 * decides for generic types (octet-stream) and when the type is missing.
 */
export function mediaKindOf(name: string, contentType?: string): MediaKind {
  const type = (contentType ?? "").toLowerCase().split(";")[0].trim()
  const byExt = EXT_KIND[extensionOf(name)]
  if (byExt && (type === "" || type === "application/octet-stream")) return byExt
  if (type.startsWith("image/")) return "image"
  if (type.startsWith("video/")) return "video"
  if (type.startsWith("audio/")) return "audio"
  if (type === "application/pdf") return "pdf"
  if (type === "text/markdown") return "markdown"
  if (type === "application/json" || type === "application/xml" || type === "text/javascript" || type === "text/css" || type === "text/html")
    return "code"
  if (type.startsWith("text/")) return byExt ?? "text"
  if (type.startsWith("font/")) return "font"
  if (type.includes("zip") || type.includes("tar") || type.includes("compressed") || type.includes("rar")) return "archive"
  return byExt ?? "other"
}

/** kinds rendered as text in the previewer */
export const isTextual = (kind: MediaKind) => kind === "text" || kind === "code" || kind === "markdown"

/* ------------------------------ encodings ------------------------------ */

export const TEXT_ENCODINGS = [
  "utf-8",
  "windows-1251",
  "koi8-r",
  "ibm866",
  "utf-16le",
  "utf-16be",
  "iso-8859-1",
  "windows-1252",
] as const

export type TextEncoding = (typeof TEXT_ENCODINGS)[number]

export const isTextEncoding = (value: string): value is TextEncoding =>
  (TEXT_ENCODINGS as readonly string[]).includes(value)

/** decode bytes in the given encoding; never throws (replacement characters instead) */
export function decodeText(bytes: Uint8Array, encoding: TextEncoding = "utf-8"): string {
  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return new TextDecoder("utf-8").decode(bytes)
  }
}

/** a rough binary check on the first kilobytes: nul bytes and too many controls */
export function looksBinary(bytes: Uint8Array, sample = 4096): boolean {
  const n = Math.min(bytes.length, sample)
  if (n === 0) return false
  let controls = 0
  for (let i = 0; i < n; i += 1) {
    const b = bytes[i]
    if (b === 0) return true
    if (b < 7 || (b > 13 && b < 32)) controls += 1
  }
  return controls / n > 0.1
}

/**
 * guess the encoding of a text file: byte-order marks first, strict utf-8
 * second, and windows-1251 as the fallback (the encoding of every russian
 * text file that is not utf-8).
 */
export function guessEncoding(bytes: Uint8Array): TextEncoding {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8"
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le"
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be"
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, Math.min(bytes.length, 65536)))
    return "utf-8"
  } catch {
    return "windows-1251"
  }
}

/* ------------------------------ formatters ------------------------------ */

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "—"
  if (size < 1024) return `${size} b`
  const units = ["kb", "mb", "gb", "tb"]
  let value = size / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1).replace(/\.0$/, "") : Math.round(value)} ${units[unit]}`
}

/** m:ss or h:mm:ss */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`
}

/** the accent token a kind is drawn with (icons, chips, the wizard cards) */
export function accentForKind(kind: MediaKind): string {
  switch (kind) {
    case "image":
      return "var(--accent-cyan)"
    case "video":
      return "var(--accent-purple)"
    case "audio":
      return "var(--accent-orange)"
    case "pdf":
      return "var(--accent-red)"
    case "text":
    case "markdown":
      return "var(--accent-green)"
    case "code":
      return "var(--accent-blue)"
    case "archive":
    case "font":
      return "var(--accent-grey)"
    case "folder":
      return "var(--accent-blue)"
    default:
      return "var(--accent-grey)"
  }
}
