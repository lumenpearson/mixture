import { LocalAccessError } from "./bridge"

/* posix path helpers for root-relative local paths.
 *
 * `normalizeRelative` is the web half of `relative_parts` in
 * apps/desktop/src-tauri/src/local.rs; the two are documented as mirrors, so
 * they reject the same segments. `..` escapes the root outright. A ':' (a
 * windows drive letter or an NTFS alternate data stream) and control
 * characters reach outside the granted folder once the desktop shell joins
 * them onto a native path — on the web they cannot, but a name that browses
 * here and fails on the desktop is worse than a name refused in both. Listing
 * stays lenient: `joinRelative` concatenates without validating, so one
 * oddly named file does not make its whole folder unreadable. */

/** a segment that must never be joined onto a native path */
const FORBIDDEN_SEGMENT = /[:\p{Cc}]/u

export function normalizeRelative(path: string): string {
  const parts: string[] = []
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      if (parts.length === 0) throw new LocalAccessError("path", "path escapes the root")
      parts.pop()
      continue
    }
    if (FORBIDDEN_SEGMENT.test(part)) throw new LocalAccessError("path", "path contains a forbidden character")
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

/** `join_relative` in local.rs: attach a directory entry's name to its parent
 *  without judging it, so a listing survives a name the bridge would refuse */
export const joinRelative = (parent: string, name: string): string => (parent ? `${parent}/${name}` : name)

/** true when `path` is `ancestor` itself or sits inside it (the root contains
 *  everything); a folder must not be moved into its own subtree */
export const isWithin = (path: string, ancestor: string): boolean => {
  const inside = normalizeRelative(path)
  const outside = normalizeRelative(ancestor)
  return outside === "" || inside === outside || inside.startsWith(`${outside}/`)
}
