import { describe, expect, it } from "vitest"
import { emptyDraft, isDraftStarted, normalizeHttpUrl, suggestSlug, validateStep } from "./draft"

const defaults = { category: "phones", device: "phone" as const, aspect: "9:16" as const }

describe("wizard draft", () => {
  it("knows when a draft is untouched", () => {
    const draft = emptyDraft(defaults)
    expect(isDraftStarted(draft, defaults)).toBe(false)
    expect(isDraftStarted({ ...draft, titleRu: "x" }, defaults)).toBe(true)
    expect(isDraftStarted({ ...draft, source: { url: "a" } }, defaults)).toBe(true)
  })

  it("validates the source by kind", () => {
    const draft = emptyDraft(defaults)
    expect(validateStep(draft, "source")).toBeNull()
    expect(validateStep({ ...draft, kind: "site" }, "source")).toBe("wizard.error.url")
    expect(validateStep({ ...draft, kind: "site", source: { url: "example.com" } }, "source")).toBeNull()
    expect(validateStep({ ...draft, kind: "file" }, "source")).toBe("wizard.error.file")
    expect(validateStep({ ...draft, kind: "file", source: { path: "a.png" } }, "source")).toBeNull()
  })

  it("validates identity and review", () => {
    const draft = emptyDraft(defaults)
    expect(validateStep(draft, "identity")).toBe("wizard.error.title")
    expect(validateStep({ ...draft, titleRu: "t", date: "" }, "identity")).toBe("wizard.error.date")
    expect(validateStep({ ...draft, titleRu: "t" }, "review")).toBeNull()
  })

  it("normalises urls and suggests slugs", () => {
    expect(normalizeHttpUrl("example.com/x")).toBe("https://example.com/x")
    expect(normalizeHttpUrl("javascript:alert(1)")).toBe("")
    expect(normalizeHttpUrl("")).toBe("")
    expect(suggestSlug("Экран блокировки — эп. 1")).toBe("ekran-blokirovki-ep-1")
  })
})
