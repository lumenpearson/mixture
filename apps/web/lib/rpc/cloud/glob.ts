/* ------------------------------------------------------------------ *
 * minimal glob matcher for cloud.config.json visibility rules
 *
 * Supported: `**` (any depth, including slashes), `*` (anything but a slash),
 * `?` (one character but a slash) and `{a,b}` alternatives. A pattern without
 * a slash matches against the file name at any depth (gitignore style); a
 * pattern with a slash matches against the whole repository-relative path.
 * ------------------------------------------------------------------ */

const cache = new Map<string, RegExp>()

function escapeRegExp(value: string): string {
  return value.replace(/[.+^$()|[\]\\]/g, "\\$&")
}

export function globToRegExp(pattern: string): RegExp {
  const cached = cache.get(pattern)
  if (cached) return cached

  let source = ""
  let i = 0
  while (i < pattern.length) {
    const ch = pattern[i]
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // `**/` swallows zero or more directories; a bare `**` swallows anything
        if (pattern[i + 2] === "/") {
          source += "(?:.*/)?"
          i += 3
        } else {
          source += ".*"
          i += 2
        }
        continue
      }
      source += "[^/]*"
      i += 1
      continue
    }
    if (ch === "?") {
      source += "[^/]"
      i += 1
      continue
    }
    if (ch === "{") {
      const end = pattern.indexOf("}", i)
      if (end > i) {
        const options = pattern
          .slice(i + 1, end)
          .split(",")
          .map((option) => escapeRegExp(option.trim()).replace(/\*/g, "[^/]*"))
        source += `(?:${options.join("|")})`
        i = end + 1
        continue
      }
    }
    source += escapeRegExp(ch)
    i += 1
  }

  const re = new RegExp(`^${source}$`, "i")
  cache.set(pattern, re)
  return re
}

export function normalizeCloudPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length && segment !== ".")
    .join("/")
}

export function matchGlob(pattern: string, path: string): boolean {
  const clean = normalizeCloudPath(path)
  const trimmed = pattern.trim().replace(/^\.?\//, "")
  if (!trimmed) return false
  const re = globToRegExp(trimmed)
  if (!trimmed.includes("/")) {
    const name = clean.split("/").pop() ?? clean
    return re.test(name) || re.test(clean)
  }
  return re.test(clean)
}
