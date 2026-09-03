import { describe, expect, it } from "vitest"
import { baseNameOf, joinPath, normalizeRelative, parentOf, segmentsOf } from "./paths"

describe("local paths", () => {
  it("normalises separators and dots", () => {
    expect(normalizeRelative("a\\b/./c/")).toBe("a/b/c")
    expect(normalizeRelative("/a//b")).toBe("a/b")
    expect(normalizeRelative("a/b/../c")).toBe("a/c")
    expect(() => normalizeRelative("../x")).toThrow()
  })

  it("splits and joins", () => {
    expect(segmentsOf("")).toEqual([])
    expect(segmentsOf("a/b")).toEqual(["a", "b"])
    expect(parentOf("a/b/c.txt")).toBe("a/b")
    expect(parentOf("c.txt")).toBe("")
    expect(baseNameOf("a/b/c.txt")).toBe("c.txt")
    expect(joinPath("a", "", "b/c")).toBe("a/b/c")
  })
})
