import { EntryKind, Visibility, type Entry } from "@mixture/protocol/cloud"
import { categoryFor, type FileCategory } from "./file-types"

/* ------------------------------------------------------------------ *
 * listing filters — type category, visibility and free-text search
 *
 * Filtering is client-side and cosmetic: the server has already removed
 * everything the caller may not see, so hiding a row here never widens
 * access, it only narrows what is drawn.
 * ------------------------------------------------------------------ */

export type VisibilityFilter = "all" | "private" | "public" | "hidden"

export type FilterOptions = {
  /** empty means "every category" */
  categories: readonly FileCategory[]
  visibility: VisibilityFilter
  /** matched against the name, and against the path in search-everywhere mode */
  query: string
}

export const DEFAULT_FILTERS: FilterOptions = { categories: [], visibility: "all", query: "" }

export type FilterableEntry = Pick<Entry, "name" | "path" | "kind" | "contentType" | "visibility">

const VISIBILITY_MATCH: Record<Exclude<VisibilityFilter, "all">, Visibility> = {
  private: Visibility.PRIVATE,
  public: Visibility.PUBLIC,
  hidden: Visibility.HIDDEN,
}

/** true when every needle appears in the haystack, in any order */
export function matchesQuery(entry: FilterableEntry, query: string): boolean {
  const needles = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!needles.length) return true
  const haystack = `${entry.path}`.toLowerCase()
  return needles.every((needle) => haystack.includes(needle))
}

export function matchesFilters(entry: FilterableEntry, options: FilterOptions): boolean {
  if (!matchesQuery(entry, options.query)) return false
  if (options.visibility !== "all") {
    const wanted = VISIBILITY_MATCH[options.visibility]
    // UNSPECIFIED is stored as private everywhere else, so treat it as private
    const actual = entry.visibility === Visibility.UNSPECIFIED ? Visibility.PRIVATE : entry.visibility
    if (actual !== wanted) return false
  }
  if (options.categories.length) {
    // a directory has no type of its own; it survives a category filter so the
    // tree stays walkable while a filter is on
    if (entry.kind === EntryKind.DIRECTORY) return true
    if (!options.categories.includes(categoryFor(entry.name, entry.contentType))) return false
  }
  return true
}

export function filterEntries<T extends FilterableEntry>(entries: readonly T[], options: FilterOptions): T[] {
  return entries.filter((entry) => matchesFilters(entry, options))
}

/** how many entries fall into each category (drives the filter counters) */
export function countByCategory<T extends FilterableEntry>(entries: readonly T[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of entries) {
    if (entry.kind === EntryKind.DIRECTORY) continue
    const category = categoryFor(entry.name, entry.contentType)
    counts[category] = (counts[category] ?? 0) + 1
  }
  return counts
}

export const filtersAreEmpty = (options: FilterOptions) =>
  options.categories.length === 0 && options.visibility === "all" && options.query.trim() === ""
