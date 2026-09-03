/* posix path helpers for root-relative local paths */

export function normalizeRelative(path: string): string {
  const parts: string[] = []
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      if (parts.length === 0) throw new Error("path escapes the root")
      parts.pop()
      continue
    }
    parts.push(part)
  }
  return parts.join("/")
}

export const segmentsOf = (path: string): string[] => (path ? normalizeRelative(path).split("/") : [])

export const parentOf = (path: string): string => {
  const parts = segmentsOf(path)
  parts.pop()
  return parts.join("/")
}

export const baseNameOf = (path: string): string => segmentsOf(path).pop() ?? ""

export const joinPath = (...parts: string[]): string => normalizeRelative(parts.filter(Boolean).join("/"))
