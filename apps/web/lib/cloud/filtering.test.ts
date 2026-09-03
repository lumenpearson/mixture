import { EntryKind, Visibility } from "@mixture/protocol/cloud"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_FILTERS,
  countByCategory,
  filterEntries,
  filtersAreEmpty,
  matchesQuery,
  type FilterOptions,
  type FilterableEntry,
} from "./filtering"

const file = (path: string, visibility = Visibility.PRIVATE): FilterableEntry => ({
  path,
  name: path.split("/").pop() ?? path,
  kind: EntryKind.FILE,
  contentType: "application/octet-stream",
  visibility,
})

const dir = (path: string, visibility = Visibility.PRIVATE): FilterableEntry => ({
  path,
  name: path.split("/").pop() ?? path,
  kind: EntryKind.DIRECTORY,
  contentType: "inode/directory",
  visibility,
})

const options = (patch: Partial<FilterOptions> = {}): FilterOptions => ({ ...DEFAULT_FILTERS, ...patch })

const paths = (entries: FilterableEntry[]) => entries.map((entry) => entry.path)

describe("matchesQuery", () => {
  it("matches every whitespace-separated needle, in any order", () => {
    expect(matchesQuery(file("renders/ep01/lock.png"), "ep01 lock")).toBe(true)
    expect(matchesQuery(file("renders/ep01/lock.png"), "lock ep01")).toBe(true)
    expect(matchesQuery(file("renders/ep01/lock.png"), "LOCK")).toBe(true)
  })

  it("fails when one needle is missing", () => {
    expect(matchesQuery(file("renders/ep01/lock.png"), "ep01 home")).toBe(false)
  })

  it("treats an empty query as no filter", () => {
    expect(matchesQuery(file("a.png"), "   ")).toBe(true)
  })
})

describe("filterEntries", () => {
  it("returns everything under the default filters", () => {
    const entries = [dir("public"), file("a.png"), file("b.zip")]
    expect(filterEntries(entries, options())).toHaveLength(3)
    expect(filtersAreEmpty(options())).toBe(true)
  })

  it("keeps only the chosen categories, and always the folders", () => {
    const entries = [dir("public"), file("a.png"), file("b.zip"), file("c.ts")]
    expect(paths(filterEntries(entries, options({ categories: ["image"] })))).toEqual(["public", "a.png"])
    expect(paths(filterEntries(entries, options({ categories: ["image", "code"] })))).toEqual([
      "public",
      "a.png",
      "c.ts",
    ])
  })

  it("filters by visibility and treats unspecified as private", () => {
    const entries = [
      file("a.png", Visibility.PUBLIC),
      file("b.png", Visibility.PRIVATE),
      file("c.png", Visibility.HIDDEN),
      file("d.png", Visibility.UNSPECIFIED),
    ]
    expect(paths(filterEntries(entries, options({ visibility: "public" })))).toEqual(["a.png"])
    expect(paths(filterEntries(entries, options({ visibility: "private" })))).toEqual(["b.png", "d.png"])
    expect(paths(filterEntries(entries, options({ visibility: "hidden" })))).toEqual(["c.png"])
  })

  it("combines a query with a category", () => {
    const entries = [file("renders/lock.png"), file("renders/lock.zip"), file("home/lock.png")]
    expect(paths(filterEntries(entries, options({ query: "renders", categories: ["image"] })))).toEqual([
      "renders/lock.png",
    ])
  })
})

describe("countByCategory", () => {
  it("counts files and ignores folders", () => {
    const entries = [dir("public"), file("a.png"), file("b.png"), file("c.zip")]
    expect(countByCategory(entries)).toEqual({ image: 2, archive: 1 })
  })
})
