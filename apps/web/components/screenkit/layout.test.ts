import { RAIL_LAYOUT_KEY } from "@/lib/screenkit/appearance"
import type { StorageLike } from "@/lib/screenkit/glass"
import { describe, expect, it } from "vitest"
import { DEFAULT_LAYOUT, readLayout, writeLayout } from "./layout"

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  const store: StorageLike & { map: Map<string, string> } = {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
  return store
}

describe("readLayout", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(readLayout(fakeStorage())).toEqual(DEFAULT_LAYOUT)
  })

  it("reads a complete stored value back", () => {
    const stored = { side: "right" as const, railVisible: false, autoHideOnScroll: true }
    expect(readLayout(fakeStorage({ [RAIL_LAYOUT_KEY]: JSON.stringify(stored) }))).toEqual(stored)
  })

  it("fills in fields the stored object is missing", () => {
    const store = fakeStorage({ [RAIL_LAYOUT_KEY]: JSON.stringify({ side: "right" }) })
    expect(readLayout(store)).toEqual({
      side: "right",
      railVisible: DEFAULT_LAYOUT.railVisible,
      autoHideOnScroll: DEFAULT_LAYOUT.autoHideOnScroll,
    })
  })

  it("refuses a side it does not know and values of the wrong type", () => {
    const store = fakeStorage({
      [RAIL_LAYOUT_KEY]: JSON.stringify({
        side: "top",
        railVisible: "no",
        autoHideOnScroll: 1,
      }),
    })
    expect(readLayout(store)).toEqual(DEFAULT_LAYOUT)
  })

  it("survives a corrupt payload and a missing storage", () => {
    expect(readLayout(fakeStorage({ [RAIL_LAYOUT_KEY]: "{" }))).toEqual(DEFAULT_LAYOUT)
    expect(readLayout(null)).toEqual(DEFAULT_LAYOUT)
  })
})

describe("writeLayout", () => {
  it("round-trips through readLayout", () => {
    const store = fakeStorage()
    const value = { side: "right" as const, railVisible: false, autoHideOnScroll: true }
    writeLayout(value, store)
    expect(readLayout(store)).toEqual(value)
  })
})
