import { describe, expect, it } from "vitest"
import {
  ACCENT_CHOICES,
  CATEGORY_LABEL_KEY,
  DEFAULT_CATEGORY_ACCENTS,
  FILE_CATEGORIES,
  accentForCategory,
  categoryFor,
  extensionsOf,
  iconForCategory,
} from "./file-types"

describe("categoryFor", () => {
  it("classifies by extension", () => {
    expect(categoryFor("lock.PNG")).toBe("image")
    expect(categoryFor("scene.mov")).toBe("video")
    expect(categoryFor("call.m4a")).toBe("audio")
    expect(categoryFor("brief.pdf")).toBe("document")
    expect(categoryFor("dump.tar.gz")).toBe("archive")
    expect(categoryFor("scene.tsx")).toBe("code")
  })

  it("falls back to other for an unknown extension", () => {
    expect(categoryFor("mystery.qqq")).toBe("other")
    expect(categoryFor("noextension")).toBe("other")
  })

  it("uses the content type only when the extension says nothing", () => {
    expect(categoryFor("blob", "image/png")).toBe("image")
    expect(categoryFor("blob", "audio/mpeg")).toBe("audio")
    // a known extension outranks a wrong content type
    expect(categoryFor("lock.png", "application/octet-stream")).toBe("image")
    expect(categoryFor("blob", "application/octet-stream")).toBe("other")
  })
})

describe("the registry", () => {
  it("maps every category to a label, an icon and a default accent", () => {
    for (const category of FILE_CATEGORIES) {
      expect(CATEGORY_LABEL_KEY[category]).toMatch(/^cloudfm\.type\./)
      expect(typeof iconForCategory(category)).not.toBe("undefined")
      expect(DEFAULT_CATEGORY_ACCENTS[category]).toMatch(/^var\(--accent-[a-z]+\)$/)
    }
  })

  it("never puts one extension in two categories", () => {
    const seen = new Map<string, string>()
    for (const category of FILE_CATEGORIES) {
      for (const extension of extensionsOf(category)) {
        expect(seen.get(extension), `${extension} is claimed twice`).toBeUndefined()
        seen.set(extension, category)
      }
    }
  })
})

describe("accentForCategory", () => {
  it("honours an override drawn from the offered accents", () => {
    expect(accentForCategory("image", { image: "var(--accent-green)" })).toBe("var(--accent-green)")
    expect(ACCENT_CHOICES).toContain("var(--accent-green)")
  })

  // the settings are user-writable localStorage: an arbitrary string must not
  // reach a style attribute
  it("ignores an override that is not an accent token", () => {
    expect(accentForCategory("image", { image: "red; background: url(x)" })).toBe(DEFAULT_CATEGORY_ACCENTS.image)
    expect(accentForCategory("image", {})).toBe(DEFAULT_CATEGORY_ACCENTS.image)
    expect(accentForCategory("image")).toBe(DEFAULT_CATEGORY_ACCENTS.image)
  })
})
