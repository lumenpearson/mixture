import { describe, expect, it } from "vitest"
import { emptyDraft, isDraftStarted, parseDraft, suggestSlug, validateStep } from "./draft"

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

  it("suggests a slug from a russian title", () => {
    expect(suggestSlug("Экран блокировки — эп. 1")).toBe("ekran-blokirovki-ep-1")
  })
})

describe("parseDraft", () => {
  it("survives a draft with only a version and a title", () => {
    // used to reach the dialog and throw on Object.keys(draft.source)
    const draft = parseDraft({ version: 1, titleRu: "x" }, defaults)
    expect(draft).not.toBeNull()
    expect(draft?.source).toEqual({})
    expect(isDraftStarted(draft as NonNullable<typeof draft>, defaults)).toBe(true)
    expect(draft?.step).toBe("kind")
    expect(draft?.kind).toBe("scene")
    expect(draft?.technicalNotesEn).toBe("")
  })

  it("refuses anything that is not a version 1 object", () => {
    expect(parseDraft(null, defaults)).toBeNull()
    expect(parseDraft("draft", defaults)).toBeNull()
    expect(parseDraft([], defaults)).toBeNull()
    expect(parseDraft({ titleRu: "x" }, defaults)).toBeNull()
    expect(parseDraft({ version: 2, titleRu: "x" }, defaults)).toBeNull()
  })

  it("replaces values of the wrong type and unknown members of a union", () => {
    const draft = parseDraft(
      {
        version: 1,
        step: "nowhere",
        kind: "widget",
        device: "toaster",
        aspect: "3:1",
        status: "burning",
        titleRu: 42,
        slug: { evil: true },
        source: "not an object",
        updatedAt: "yesterday",
      },
      defaults,
    )
    expect(draft).toMatchObject({
      step: "kind",
      kind: "scene",
      device: "phone",
      aspect: "9:16",
      status: "draft",
      titleRu: "",
      slug: "",
      source: {},
    })
    expect(typeof draft?.updatedAt).toBe("number")
  })

  it("keeps a half-typed url but drops the fields parseInsertSource refuses", () => {
    const draft = parseDraft(
      { version: 1, titleRu: "x", kind: "site", step: "source", source: { url: "exampl", zoom: "big", scroll: true } },
      defaults,
    )
    expect(draft?.source).toEqual({ url: "exampl", scroll: true })
    expect(draft?.step).toBe("source")
    expect(draft?.kind).toBe("site")
  })
})
