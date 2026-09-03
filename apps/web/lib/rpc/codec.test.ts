import { describe, expect, it } from "vitest"
import type { Insert, InsertSource } from "@/lib/screenkit/types"
import {
  aspectFromPb,
  categoryFromPb,
  categoryToPb,
  deviceFromPb,
  insertFromPb,
  insertToPb,
  kindFromPb,
  kindToPb,
  libraryFromPb,
  libraryToPb,
  sourceFromPb,
  sourceToPb,
  statusFromPb,
  textFromPb,
  textToPb,
} from "./codec"
import { AspectRatio, DeviceType, InsertStatus } from "@mixture/protocol/common"
import { InsertKind } from "@mixture/protocol/library"

const insert: Insert = {
  id: "gs-test",
  date: "2026-03-01",
  episode: "ep.01",
  scene: "sc.02",
  category: "phones",
  device: "tablet",
  aspect: "16:10",
  status: "needs review",
  title: { ru: "заголовок", en: "title" },
  description: { ru: "описание" },
  prompt: { ru: "промпт", en: "" },
  shortPrompt: { ru: "короткий" },
  negativePrompt: { ru: "негатив" },
  technicalNotes: { ru: ["a", "b"], en: ["c"] },
  custom: true,
  kind: "scene",
}

describe("localized text", () => {
  it("keeps the difference between a missing and an empty english string", () => {
    expect(textFromPb(textToPb({ ru: "x" }))).toEqual({ ru: "x" })
    expect(textFromPb(textToPb({ ru: "x", en: "" }))).toEqual({ ru: "x", en: "" })
    expect(textFromPb(undefined)).toEqual({ ru: "" })
  })
})

describe("enums", () => {
  it("maps every domain value both ways", () => {
    expect(deviceFromPb(DeviceType.CCTV)).toBe("cctv")
    expect(aspectFromPb(AspectRatio.ASPECT_RATIO_4_3)).toBe("4:3")
    expect(statusFromPb(InsertStatus.NEEDS_REVIEW)).toBe("needs review")
    expect(deviceFromPb(DeviceType.UNSPECIFIED)).toBeNull()
    expect(statusFromPb(99 as InsertStatus)).toBeNull()
  })
})

describe("insert kinds", () => {
  it("maps every kind both ways", () => {
    for (const kind of ["scene", "site", "file"] as const) {
      expect(kindFromPb(kindToPb(kind))).toBe(kind)
    }
    expect(kindFromPb(InsertKind.UNSPECIFIED)).toBeNull()
    expect(kindFromPb(99 as InsertKind)).toBeNull()
  })

  it("reads an insert without a kind as a scene", () => {
    const legacy = { ...insert, kind: undefined }
    const decoded = insertFromPb(insertToPb(legacy))
    expect(decoded.kind).toBe("scene")
    expect(decoded.source).toBeUndefined()
  })

  it("round-trips a site source", () => {
    const source: InsertSource = {
      url: "https://example.com/board",
      fit: "cover",
      zoom: 1.5,
      scroll: true,
      background: "#0b0f17",
    }
    expect(sourceFromPb(sourceToPb(source))).toEqual(source)
    const site = { ...insert, kind: "site" as const, source }
    expect(insertFromPb(insertToPb(site))).toEqual(site)
  })

  it("keeps a flag the author switched off apart from one never set", () => {
    // the file defaults are all `true`, so an explicit `false` has to survive
    expect(sourceFromPb(sourceToPb({ autoplay: false, loop: false, muted: false }))).toEqual({
      autoplay: false,
      loop: false,
      muted: false,
    })
    expect(sourceFromPb(sourceToPb({ path: "clips/hall.mp4" }))).toEqual({ path: "clips/hall.mp4" })
  })

  it("decodes an empty or missing source as {}", () => {
    expect(sourceFromPb(sourceToPb({}))).toEqual({})
    expect(sourceFromPb(undefined)).toEqual({})
  })
})

describe("insert + library", () => {
  it("round-trips an insert", () => {
    expect(insertFromPb(insertToPb(insert))).toEqual(insert)
  })

  it("drops the custom flag for built-ins", () => {
    const builtIn = { ...insert, custom: undefined }
    expect(insertFromPb(insertToPb(builtIn)).custom).toBeUndefined()
  })

  it("round-trips a category with and without icon", () => {
    const def = { id: "drones", accent: "var(--accent-blue)", tint: "rgba(0,0,0,0.1)", label: { ru: "дроны", en: "drones" }, icon: "radar", custom: true }
    expect(categoryFromPb(categoryToPb(def))).toEqual(def)
    const bare = { id: "phones", accent: "a", tint: "b", label: { ru: "телефоны" } }
    expect(categoryFromPb(categoryToPb(bare))).toEqual({ ...bare, icon: undefined, custom: undefined })
  })

  it("round-trips the library flags", () => {
    const data = { categories: [], inserts: [insert], persistent: true, editLocked: true }
    expect(libraryFromPb(libraryToPb(data))).toEqual(data)
    expect(libraryFromPb(undefined)).toEqual({ categories: [], inserts: [], persistent: false, editLocked: false })
  })
})
