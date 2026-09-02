import { describe, expect, it } from "vitest"
import type { Insert } from "@/lib/screenkit/types"
import {
  aspectFromPb,
  categoryFromPb,
  categoryToPb,
  deviceFromPb,
  insertFromPb,
  insertToPb,
  libraryFromPb,
  libraryToPb,
  statusFromPb,
  textFromPb,
  textToPb,
} from "./codec"
import { AspectRatio, DeviceType, InsertStatus } from "@mixture/protocol/common"

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
