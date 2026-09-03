import { describe, expect, it } from "vitest"
import {
  baseName,
  extensionOf,
  formatBytes,
  joinPath,
  normalizePath,
  parentPath,
  pathProblem,
  stemOf,
  uniqueName,
} from "./paths"

describe("normalizePath", () => {
  it("collapses separators and drops '.' segments", () => {
    expect(normalizePath("/a//b/./c/")).toBe("a/b/c")
    expect(normalizePath("a\\b")).toBe("a/b")
    expect(normalizePath("")).toBe("")
  })
})

describe("joinPath / parentPath / baseName", () => {
  it("joins around an empty root", () => {
    expect(joinPath("", "a.png")).toBe("a.png")
    expect(joinPath("renders", "ep01", "a.png")).toBe("renders/ep01/a.png")
  })

  it("walks back up", () => {
    expect(parentPath("renders/ep01/a.png")).toBe("renders/ep01")
    expect(parentPath("a.png")).toBe("")
    expect(baseName("renders/ep01/a.png")).toBe("a.png")
  })
})

describe("extensionOf / stemOf", () => {
  it("reads the extension case-insensitively", () => {
    expect(extensionOf("LOCK.PNG")).toBe("png")
    expect(stemOf("renders/lock.screen.png")).toBe("lock.screen")
  })

  it("treats dotfiles and trailing dots as extensionless", () => {
    expect(extensionOf(".gitkeep")).toBe("")
    expect(extensionOf("readme")).toBe("")
    expect(extensionOf("weird.")).toBe("")
    expect(stemOf(".gitkeep")).toBe(".gitkeep")
  })
})

describe("pathProblem", () => {
  it("accepts an ordinary repository path", () => {
    expect(pathProblem("renders/ep01/lock.png")).toBeNull()
  })

  // the negative half of the server's rule: a direct browser upload never
  // reaches cloud/service.ts, so these must be refused before the request
  it("refuses traversal, .git, control characters, over-long paths and the config", () => {
    expect(pathProblem("../secrets.txt")).toBe("forbidden-segment")
    expect(pathProblem("a/../../b")).toBe("forbidden-segment")
    expect(pathProblem(".git/config")).toBe("forbidden-segment")
    expect(pathProblem("a/\u0007b.png")).toBe("forbidden-segment")
    expect(pathProblem(`${"x".repeat(513)}.png`)).toBe("too-long")
    expect(pathProblem("cloud.config.json")).toBe("config-file")
    expect(pathProblem("")).toBe("empty")
    expect(pathProblem("///")).toBe("empty")
  })

  it("still allows a file named like the config inside a folder", () => {
    expect(pathProblem("backup/cloud.config.json")).toBeNull()
  })
})

describe("uniqueName", () => {
  it("returns the name when nothing takes it", () => {
    expect(uniqueName("a.png", ["b.png"])).toBe("a.png")
  })

  it("adds and then numbers a copy suffix, ignoring case", () => {
    expect(uniqueName("a.png", ["A.PNG"])).toBe("a (copy).png")
    expect(uniqueName("a.png", ["a.png", "a (copy).png"])).toBe("a (copy 2).png")
    expect(uniqueName("readme", ["readme"])).toBe("readme (copy)")
  })
})

describe("formatBytes", () => {
  it("scales through the units", () => {
    expect(formatBytes(512)).toBe("512 b")
    expect(formatBytes(1536)).toBe("1.50 kb")
    expect(formatBytes(20 * 1024 * 1024)).toBe("20.0 mb")
    expect(formatBytes(BigInt(3 * 1024 * 1024 * 1024))).toBe("3.00 gb")
  })

  it("does not pretend to know a negative size", () => {
    expect(formatBytes(-1)).toBe("—")
  })
})
