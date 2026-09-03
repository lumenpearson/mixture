import { describe, expect, it } from "vitest"
import { canOpenInNewTab, isActiveContentType, isHttpUrl, normalizeHttpUrl } from "./url"

describe("normalizeHttpUrl", () => {
  it("upgrades a bare host and keeps a full url", () => {
    expect(normalizeHttpUrl("example.com/x")).toBe("https://example.com/x")
    expect(normalizeHttpUrl("  https://example.com/a?b=1 ")).toBe("https://example.com/a?b=1")
    expect(normalizeHttpUrl("http://localhost:3000/x")).toBe("http://localhost:3000/x")
  })

  it("refuses every scheme but http(s)", () => {
    expect(normalizeHttpUrl("javascript:alert(1)")).toBe("")
    expect(normalizeHttpUrl("JavaScript:alert(1)")).toBe("")
    expect(normalizeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe("")
    expect(normalizeHttpUrl("blob:https://site/abc")).toBe("")
    expect(normalizeHttpUrl("file:///etc/passwd")).toBe("")
    expect(normalizeHttpUrl("")).toBe("")
    expect(normalizeHttpUrl(undefined)).toBe("")
  })
})

describe("isHttpUrl", () => {
  it("accepts absolute http(s) urls only", () => {
    expect(isHttpUrl("https://example.com")).toBe(true)
    expect(isHttpUrl("http://127.0.0.1:3000/a")).toBe(true)
    expect(isHttpUrl("example.com")).toBe(false)
    expect(isHttpUrl("javascript:alert(1)")).toBe(false)
    expect(isHttpUrl("/local/path.png")).toBe(false)
    expect(isHttpUrl(undefined)).toBe(false)
  })
})

describe("canOpenInNewTab", () => {
  it("keeps cross-origin urls openable whatever they serve", () => {
    expect(canOpenInNewTab("https://cdn.example.com/a.svg", "image/svg+xml")).toBe(true)
    expect(canOpenInNewTab("http://localhost:3000/a.pdf", "application/pdf")).toBe(true)
  })

  it("refuses a same-origin blob whose type executes script", () => {
    // an editor uploads logo.svg; the owner must not run it on this origin
    expect(canOpenInNewTab("blob:https://site/1", "image/svg+xml")).toBe(false)
    expect(canOpenInNewTab("blob:https://site/1", "text/html; charset=utf-8")).toBe(false)
    expect(canOpenInNewTab("blob:https://site/1", "application/xhtml+xml")).toBe(false)
  })

  it("allows inert blobs and refuses anything else", () => {
    expect(canOpenInNewTab("blob:https://site/1", "image/png")).toBe(true)
    expect(canOpenInNewTab("blob:https://site/1", "application/pdf")).toBe(true)
    expect(canOpenInNewTab("javascript:alert(1)", "image/png")).toBe(false)
    expect(canOpenInNewTab("/relative.png", "image/png")).toBe(false)
  })
})

describe("isActiveContentType", () => {
  it("ignores parameters and case", () => {
    expect(isActiveContentType("IMAGE/SVG+XML")).toBe(true)
    expect(isActiveContentType("text/html;charset=windows-1251")).toBe(true)
    expect(isActiveContentType("text/plain")).toBe(false)
    expect(isActiveContentType(undefined)).toBe(false)
  })
})
