import { EntryKind, type Entry } from "@mixture/protocol/cloud"
import { categoryFor, FILE_CATEGORIES, type FileCategory } from "./file-types"
import { extensionOf } from "./paths"

/* ------------------------------------------------------------------ *
 * listing order
 *
 * Pure and total: the same input always yields the same order, and every
 * comparison falls back to the name so two entries never compare equal by
 * accident (which would let the browser reorder them between renders).
 * ------------------------------------------------------------------ */

export const SORT_KEYS = ["name", "size", "type", "kind"] as const
export type SortKey = (typeof SORT_KEYS)[number]
export type SortDirection = "asc" | "desc"

export type SortOptions = {
  key: SortKey
  direction: SortDirection
  /** keep directories above files regardless of the key */
  foldersFirst: boolean
}

export const DEFAULT_SORT: SortOptions = { key: "name", direction: "asc", foldersFirst: true }

/** the fields the order depends on — anything shaped like this can be sorted */
export type SortableEntry = Pick<Entry, "name" | "path" | "kind" | "size" | "contentType">

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })

const CATEGORY_RANK: Record<FileCategory, number> = FILE_CATEGORIES.reduce(
  (acc, category, index) => ({ ...acc, [category]: index }),
  {} as Record<FileCategory, number>,
)

const byName = (a: SortableEntry, b: SortableEntry) =>
  collator.compare(a.name, b.name) || collator.compare(a.path, b.path)

function compareBy(key: SortKey, a: SortableEntry, b: SortableEntry): number {
  if (key === "size") {
    // directories carry no size of their own; they sort as zero
    const delta = Number(a.size ?? 0) - Number(b.size ?? 0)
    return delta || byName(a, b)
  }
  if (key === "type") {
    return collator.compare(extensionOf(a.name), extensionOf(b.name)) || byName(a, b)
  }
  if (key === "kind") {
    const rank =
      CATEGORY_RANK[categoryFor(a.name, a.contentType)] - CATEGORY_RANK[categoryFor(b.name, b.contentType)]
    return rank || byName(a, b)
  }
  return byName(a, b)
}

/** a new array; the input is never mutated */
export function sortEntries<T extends SortableEntry>(entries: readonly T[], options: SortOptions): T[] {
  const factor = options.direction === "desc" ? -1 : 1
  return [...entries].sort((a, b) => {
    if (options.foldersFirst && a.kind !== b.kind) {
      // folders-first is a grouping, not a sort key: the direction toggle must
      // not push directories below files
      return a.kind === EntryKind.DIRECTORY ? -1 : 1
    }
    return factor * compareBy(options.key, a, b)
  })
}
