import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  type LucideIcon,
} from "lucide-react"
import { extensionOf } from "./paths"

/* ------------------------------------------------------------------ *
 * file-type registry — extension → category → icon + accent token
 *
 * One table drives the listing icon, its colour, the type filter and the
 * "kind" sort. Colours are accent tokens (`var(--accent-*)`) rather than
 * literals so a category follows the active palette; the user may remap a
 * category to another accent or turn colours off entirely in cloud settings.
 * ------------------------------------------------------------------ */

export const FILE_CATEGORIES = ["image", "video", "audio", "document", "archive", "code", "other"] as const

export type FileCategory = (typeof FILE_CATEGORIES)[number]

/** i18n key for a category label */
export const CATEGORY_LABEL_KEY: Record<FileCategory, string> = {
  image: "cloudfm.type.image",
  video: "cloudfm.type.video",
  audio: "cloudfm.type.audio",
  document: "cloudfm.type.document",
  archive: "cloudfm.type.archive",
  code: "cloudfm.type.code",
  other: "cloudfm.type.other",
}

const EXTENSIONS: Record<FileCategory, string[]> = {
  image: [
    "png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "tif", "tiff",
    "heic", "heif", "ico", "psd", "ai", "raw", "dng", "cr2", "nef",
  ],
  video: ["mp4", "webm", "mov", "mkv", "avi", "m4v", "mpg", "mpeg", "wmv", "flv", "prores", "mxf"],
  audio: ["mp3", "wav", "ogg", "flac", "aac", "m4a", "opus", "aif", "aiff", "wma", "mid", "midi"],
  document: [
    "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "markdown", "csv", "tsv",
    "xls", "xlsx", "ods", "ppt", "pptx", "odp", "epub", "pages", "numbers", "key",
  ],
  archive: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "iso", "dmg"],
  code: [
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "jsonc", "yaml", "yml", "toml",
    "html", "htm", "css", "scss", "sass", "less", "sh", "bash", "zsh", "fish",
    "py", "rb", "go", "rs", "c", "h", "cpp", "hpp", "cs", "java", "kt", "swift",
    "php", "sql", "graphql", "gql", "proto", "xml", "vue", "svelte", "lock", "env", "ini", "conf",
  ],
  other: [],
}

const BY_EXTENSION: ReadonlyMap<string, FileCategory> = new Map(
  (Object.keys(EXTENSIONS) as FileCategory[]).flatMap((category) =>
    EXTENSIONS[category].map((extension) => [extension, category] as const),
  ),
)

/** MIME prefixes are the fallback when the name carries no known extension */
function categoryFromContentType(contentType: string): FileCategory | null {
  const type = contentType.toLowerCase()
  if (type.startsWith("image/")) return "image"
  if (type.startsWith("video/")) return "video"
  if (type.startsWith("audio/")) return "audio"
  if (type === "application/pdf" || type.startsWith("text/")) return "document"
  if (type === "application/zip" || type === "application/x-tar") return "archive"
  if (type === "application/json" || type.includes("javascript") || type.includes("typescript")) return "code"
  return null
}

/** the category of a file name, refined by its content type when known */
export function categoryFor(name: string, contentType = ""): FileCategory {
  const byExtension = BY_EXTENSION.get(extensionOf(name))
  if (byExtension) return byExtension
  return categoryFromContentType(contentType) ?? "other"
}

/** every extension the registry maps to a category (for tooling and tests) */
export function extensionsOf(category: FileCategory): readonly string[] {
  return EXTENSIONS[category]
}

const ICONS: Record<FileCategory, LucideIcon> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  archive: FileArchive,
  code: FileCode,
  other: FileIcon,
}

export const FOLDER_ICON: LucideIcon = Folder
export const FOLDER_ACCENT = "var(--accent-orange)"

export const DEFAULT_CATEGORY_ACCENTS: Record<FileCategory, string> = {
  image: "var(--accent-purple)",
  video: "var(--accent-blue)",
  audio: "var(--accent-cyan)",
  document: "var(--accent-green)",
  archive: "var(--accent-orange)",
  code: "var(--accent-red)",
  other: "var(--accent-grey)",
}

/** the accents a category may be remapped to in cloud settings */
export const ACCENT_CHOICES = [
  "var(--accent-blue)",
  "var(--accent-cyan)",
  "var(--accent-purple)",
  "var(--accent-red)",
  "var(--accent-orange)",
  "var(--accent-green)",
  "var(--accent-grey)",
] as const

export const iconForCategory = (category: FileCategory): LucideIcon => ICONS[category]

/** the accent of a category under a (possibly partial) user remap */
export function accentForCategory(
  category: FileCategory,
  overrides?: Partial<Record<FileCategory, string>>,
): string {
  const override = overrides?.[category]
  return override && ACCENT_CHOICES.includes(override as (typeof ACCENT_CHOICES)[number])
    ? override
    : DEFAULT_CATEGORY_ACCENTS[category]
}
