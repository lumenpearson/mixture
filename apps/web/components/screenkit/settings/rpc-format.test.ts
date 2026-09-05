import { describe, expect, it } from "vitest"
import { fill, recentCalls } from "./rpc-format"

describe("fill", () => {
  it("substitutes every placeholder", () => {
    expect(fill("ответ за {ms} мс · {count} вставок", { ms: 42, count: 7 })).toBe("ответ за 42 мс · 7 вставок")
  })

  it("keeps an unknown placeholder visible instead of blanking it", () => {
    expect(fill("attempt {n}", {})).toBe("attempt {n}")
  })

  it("leaves a string without placeholders untouched", () => {
    expect(fill("copy curl", { ms: 1 })).toBe("copy curl")
  })
})

describe("recentCalls", () => {
  it("returns the newest entries first", () => {
    expect(recentCalls([1, 2, 3, 4, 5], 3)).toEqual([5, 4, 3])
  })

  it("returns everything when there are fewer entries than the limit", () => {
    expect(recentCalls([1, 2], 40)).toEqual([2, 1])
  })

  it("returns nothing for a non-positive limit", () => {
    // `slice(-0)` copies the whole array, so the guard is not decorative
    expect(recentCalls([1, 2, 3], 0)).toEqual([])
  })

  it("does not mutate the source array", () => {
    const entries = [1, 2, 3]
    recentCalls(entries, 2)
    expect(entries).toEqual([1, 2, 3])
  })
})
