import { describe, expect, it } from "vitest"
import { globToRegExp, matchGlob, normalizeCloudPath } from "./glob"

describe("normalizeCloudPath", () => {
  it("strips leading, trailing and duplicate separators", () => {
    expect(normalizeCloudPath("/a//b/./c/")).toBe("a/b/c")
    expect(normalizeCloudPath("a\\b")).toBe("a/b")
    expect(normalizeCloudPath("")).toBe("")
  })
})

describe("matchGlob", () => {
  it("matches a bare file pattern at any depth", () => {
    expect(matchGlob("*.png", "renders/ep01/lock.png")).toBe(true)
    expect(matchGlob("*.png", "lock.PNG")).toBe(true)
    expect(matchGlob("*.png", "renders/ep01/lock.jpg")).toBe(false)
  })

  it("matches a directory subtree with **", () => {
    expect(matchGlob("public/**", "public/a.png")).toBe(true)
    expect(matchGlob("public/**", "public/deep/er/a.png")).toBe(true)
    expect(matchGlob("public/**", "private/a.png")).toBe(false)
    expect(matchGlob("public/**", "public")).toBe(false)
  })

  it("keeps * inside one segment and ? to one character", () => {
    expect(matchGlob("renders/*/final.png", "renders/ep01/final.png")).toBe(true)
    expect(matchGlob("renders/*/final.png", "renders/ep01/x/final.png")).toBe(false)
    expect(matchGlob("renders/ep0?/**", "renders/ep07/a.png")).toBe(true)
    expect(matchGlob("renders/ep0?/**", "renders/ep12/a.png")).toBe(false)
  })

  it("supports {a,b} alternatives and escapes regex characters", () => {
    expect(matchGlob("*.{png,jpg}", "a.jpg")).toBe(true)
    expect(matchGlob("*.{png,jpg}", "a.gif")).toBe(false)
    expect(matchGlob("notes (final).txt", "notes (final).txt")).toBe(true)
    expect(globToRegExp("a.b").test("axb")).toBe(false)
  })

  it("ignores an empty pattern", () => {
    expect(matchGlob("", "anything")).toBe(false)
  })
})
