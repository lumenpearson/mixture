import { describe, expect, it } from "vitest"
import { compareLibraryInserts } from "@/components/screenkit/library-list-settings"
import { buildCategoryDefs, INSERTS, mergeInserts, resolveInsert } from "./data"
import type { CategoryDef, Insert } from "./types"

describe("resolveInsert", () => {
  it("falls back to russian when english is missing", () => {
    const ruOnly = INSERTS.find((i) => typeof i.title.en !== "string")
    expect(ruOnly).toBeDefined()
    const resolved = resolveInsert(ruOnly!, "en")
    expect(resolved.title).toBe(ruOnly!.title.ru)
    expect(resolved.hasEnglish).toBe(false)
    expect(resolved.custom).toBe(false)
  })
})

describe("merge helpers", () => {
  it("never lets a custom row shadow a built-in id", () => {
    const clash: Insert = { ...INSERTS[0], title: { ru: "clash" }, custom: true }
    const merged = mergeInserts([clash])
    expect(merged.filter((i) => i.id === clash.id)).toHaveLength(1)
    expect(merged.find((i) => i.id === clash.id)?.title.ru).toBe(INSERTS[0].title.ru)
  })

  it("appends unknown custom categories after the built-ins", () => {
    const custom: CategoryDef = { id: "drones", accent: "a", tint: "b", label: { ru: "дроны" }, custom: true }
    const defs = buildCategoryDefs([custom, { ...custom, id: "phones" }])
    expect(defs.at(-1)?.id).toBe("drones")
    expect(defs.filter((c) => c.id === "phones")).toHaveLength(1)
  })
})

describe("compareLibraryInserts", () => {
  const a = resolveInsert({ ...INSERTS[0], id: "a", date: "2026-01-02", episode: "ep.02", scene: "sc.01" }, "ru")
  const b = resolveInsert({ ...INSERTS[0], id: "b", date: "2026-01-01", episode: "ep.10", scene: "sc.01" }, "ru")

  it("sorts by date descending by default", () => {
    expect(compareLibraryInserts(a, b, "date-desc")).toBeLessThan(0)
    expect(compareLibraryInserts(a, b, "date-asc")).toBeGreaterThan(0)
  })

  it("sorts episodes numerically, not lexically", () => {
    expect(compareLibraryInserts(a, b, "episode-asc")).toBeLessThan(0)
  })
})
