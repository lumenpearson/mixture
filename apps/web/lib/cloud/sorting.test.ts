import { EntryKind } from "@mixture/protocol/cloud"
import { describe, expect, it } from "vitest"
import { sortEntries, type SortableEntry, type SortOptions } from "./sorting"

const file = (name: string, size = 0, path = name): SortableEntry => ({
  name,
  path,
  kind: EntryKind.FILE,
  size: BigInt(size),
  contentType: "application/octet-stream",
})

const dir = (name: string): SortableEntry => ({
  name,
  path: name,
  kind: EntryKind.DIRECTORY,
  size: BigInt(0),
  contentType: "inode/directory",
})

const options = (patch: Partial<SortOptions> = {}): SortOptions => ({
  key: "name",
  direction: "asc",
  foldersFirst: true,
  ...patch,
})

const names = (entries: SortableEntry[]) => entries.map((entry) => entry.name)

describe("sortEntries", () => {
  it("does not mutate its input", () => {
    const input = [file("b.png"), file("a.png")]
    const copy = [...input]
    sortEntries(input, options())
    expect(input).toEqual(copy)
  })

  it("sorts by name, numerically and case-insensitively", () => {
    const input = [file("ep10.png"), file("EP2.png"), file("ep1.png")]
    expect(names(sortEntries(input, options()))).toEqual(["ep1.png", "EP2.png", "ep10.png"])
    expect(names(sortEntries(input, options({ direction: "desc" })))).toEqual(["ep10.png", "EP2.png", "ep1.png"])
  })

  it("keeps folders above files in both directions", () => {
    const input = [file("a.png"), dir("zz"), file("b.png")]
    expect(names(sortEntries(input, options()))).toEqual(["zz", "a.png", "b.png"])
    expect(names(sortEntries(input, options({ direction: "desc" })))).toEqual(["zz", "b.png", "a.png"])
  })

  it("mixes folders into the order when folders-first is off", () => {
    const input = [file("a.png"), dir("zz"), file("b.png")]
    expect(names(sortEntries(input, options({ foldersFirst: false })))).toEqual(["a.png", "b.png", "zz"])
  })

  it("sorts by size, smallest first", () => {
    const input = [file("big.png", 900), file("small.png", 10), file("mid.png", 100)]
    expect(names(sortEntries(input, options({ key: "size" })))).toEqual(["small.png", "mid.png", "big.png"])
    expect(names(sortEntries(input, options({ key: "size", direction: "desc" })))).toEqual([
      "big.png",
      "mid.png",
      "small.png",
    ])
  })

  it("sorts by extension and falls back to the name inside one extension", () => {
    const input = [file("b.png"), file("a.zip"), file("a.png")]
    expect(names(sortEntries(input, options({ key: "type" })))).toEqual(["a.png", "b.png", "a.zip"])
  })

  it("sorts by kind in registry order: images before documents before code", () => {
    const input = [file("notes.md"), file("scene.ts"), file("lock.png")]
    expect(names(sortEntries(input, options({ key: "kind" })))).toEqual(["lock.png", "notes.md", "scene.ts"])
  })

  it("is total: equal keys still get a stable, name-based order", () => {
    const input = [file("b.png", 5), file("a.png", 5)]
    expect(names(sortEntries(input, options({ key: "size" })))).toEqual(["a.png", "b.png"])
  })
})
