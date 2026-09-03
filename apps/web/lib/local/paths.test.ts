import { describe, expect, it } from "vitest"
import { LocalAccessError } from "./bridge"
import { baseNameOf, isWithin, joinPath, joinRelative, normalizeRelative, parentOf, segmentsOf } from "./paths"

describe("local paths", () => {
  it("normalises separators and dots", () => {
    expect(normalizeRelative("a\\b/./c/")).toBe("a/b/c")
    expect(normalizeRelative("/a//b")).toBe("a/b")
    expect(normalizeRelative("a/b/../c")).toBe("a/c")
    expect(() => normalizeRelative("../x")).toThrow(LocalAccessError)
  })

  it("splits and joins", () => {
    expect(segmentsOf("")).toEqual([])
    expect(segmentsOf("a/b")).toEqual(["a", "b"])
    expect(parentOf("a/b/c.txt")).toBe("a/b")
    expect(parentOf("c.txt")).toBe("")
    expect(baseNameOf("a/b/c.txt")).toBe("c.txt")
    expect(joinPath("a", "", "b/c")).toBe("a/b/c")
  })

  // relative_parts in apps/desktop/src-tauri/src/local.rs rejects the same
  // two shapes; a name accepted here and refused there would browse on the
  // web and fail in the desktop shell
  it("rejects a drive letter, an alternate data stream and control characters", () => {
    expect(() => normalizeRelative("C:/x")).toThrow(LocalAccessError)
    expect(() => normalizeRelative("a/b:stream")).toThrow(LocalAccessError)
    expect(() => normalizeRelative("a/b\u0000c")).toThrow(LocalAccessError)
    expect(() => normalizeRelative("a/\u001bc")).toThrow(LocalAccessError)
    expect(() => normalizeRelative("a/b\nc")).toThrow(LocalAccessError)
  })

  it("reports a forbidden path as a translatable code", () => {
    expect(() => normalizeRelative("C:/x")).toThrow(expect.objectContaining({ code: "path" }))
    expect(() => normalizeRelative("../x")).toThrow(expect.objectContaining({ code: "path" }))
  })

  it("keeps ordinary punctuation", () => {
    expect(normalizeRelative("кадры/шот-01 (v2).mov")).toBe("кадры/шот-01 (v2).mov")
    expect(normalizeRelative("a/b.c@d#e")).toBe("a/b.c@d#e")
  })

  it("joins a listed child without judging its name", () => {
    expect(joinRelative("", "a.txt")).toBe("a.txt")
    expect(joinRelative("shots", "c:stream.txt")).toBe("shots/c:stream.txt")
  })

  it("knows when a path sits inside another", () => {
    expect(isWithin("shots/raw", "shots")).toBe(true)
    expect(isWithin("shots", "shots")).toBe(true)
    expect(isWithin("shots-raw", "shots")).toBe(false)
    expect(isWithin("other", "shots")).toBe(false)
    // the root contains everything
    expect(isWithin("shots", "")).toBe(true)
  })
})
