/* ------------------------------------------------------------------ *
 * cloud paths — the browser-side half of the server's path rules
 *
 * `lib/rpc/cloud/service.ts` validates every path again before it reaches
 * GitHub, so nothing here is a security boundary on its own. The copy exists
 * because a large upload made with the caller's own GitHub token goes to
 * api.github.com directly and never passes through the server: that request
 * must refuse the same paths the server would refuse.
 * ------------------------------------------------------------------ */

/** the config file is edited through UpdateConfig only, never as a file */
export const CLOUD_CONFIG_FILE = "cloud.config.json"
export const CLOUD_KEEP_FILE = ".gitkeep"

export const MAX_PATH_LENGTH = 512

/* matching control characters is the point: a name carrying one is refused */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/

export function normalizePath(input: string): string {
  return input
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join("/")
}

export function joinPath(base: string, ...rest: string[]): string {
  return normalizePath([base, ...rest].filter(Boolean).join("/"))
}

export function parentPath(path: string): string {
  const clean = normalizePath(path)
  const cut = clean.lastIndexOf("/")
  return cut === -1 ? "" : clean.slice(0, cut)
}

export function baseName(path: string): string {
  const clean = normalizePath(path)
  return clean.split("/").pop() ?? clean
}

/** the lower-case extension without the dot; "" when the name carries none */
export function extensionOf(name: string): string {
  const base = baseName(name)
  const cut = base.lastIndexOf(".")
  if (cut <= 0 || cut === base.length - 1) return ""
  return base.slice(cut + 1).toLowerCase()
}

/** the name without its extension */
export function stemOf(name: string): string {
  const base = baseName(name)
  const ext = extensionOf(base)
  return ext ? base.slice(0, base.length - ext.length - 1) : base
}

export type PathProblem = "empty" | "too-long" | "forbidden-segment" | "config-file"

/** null when the path is acceptable, otherwise why it is not */
export function pathProblem(input: string): PathProblem | null {
  const path = normalizePath(input)
  if (!path) return "empty"
  if (path.length > MAX_PATH_LENGTH) return "too-long"
  for (const segment of path.split("/")) {
    if (segment === ".." || segment === ".git" || CONTROL_CHARS.test(segment)) return "forbidden-segment"
  }
  if (path === CLOUD_CONFIG_FILE) return "config-file"
  return null
}

export const isValidPath = (input: string) => pathProblem(input) === null

/** "a.png" next to an existing "a.png" becomes "a (copy).png", then "a (copy 2).png" */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const existing = new Set([...taken].map((value) => value.toLowerCase()))
  if (!existing.has(name.toLowerCase())) return name
  const ext = extensionOf(name)
  const stem = stemOf(name)
  const suffix = ext ? `.${ext}` : ""
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? `${stem} (copy)${suffix}` : `${stem} (copy ${n})${suffix}`
    if (!existing.has(candidate.toLowerCase())) return candidate
  }
  return `${stem} (${Date.now()})${suffix}`
}

const UNITS = ["b", "kb", "mb", "gb", "tb"]

export function formatBytes(value: bigint | number): string {
  let size = Number(value)
  if (!Number.isFinite(size) || size < 0) return "—"
  let unit = 0
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024
    unit += 1
  }
  const digits = unit === 0 ? 0 : size < 10 ? 2 : 1
  return `${size.toFixed(digits)} ${UNITS[unit]}`
}
