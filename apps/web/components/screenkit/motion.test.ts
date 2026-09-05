import { afterEach, describe, expect, it } from "vitest"
import { defaultScrollFeature } from "./motion"

/* `defaultScrollFeature` is the only device heuristic in motion.tsx: smooth
   scrolling is pleasant with a wheel and fights touch momentum, so it defaults
   off on touch-first / narrow viewports. Node has no window; each case builds
   the one it needs. */

type FakeWindow = {
  matchMedia?: (query: string) => { matches: boolean }
  innerWidth: number
}

function withWindow(fake: FakeWindow | null) {
  const global = globalThis as { window?: unknown }
  if (fake === null) delete global.window
  else global.window = fake
}

function windowWith({ coarse, width }: { coarse: boolean; width: number }): FakeWindow {
  return {
    innerWidth: width,
    matchMedia: (query: string) => ({
      matches: query === "(pointer: coarse)" ? coarse : false,
    }),
  }
}

afterEach(() => {
  withWindow(null)
})

describe("defaultScrollFeature", () => {
  it("is on for a wide desktop with a fine pointer", () => {
    withWindow(windowWith({ coarse: false, width: 1440 }))
    expect(defaultScrollFeature()).toBe(true)
  })

  it("is off on a coarse pointer, however wide the screen", () => {
    withWindow(windowWith({ coarse: true, width: 1920 }))
    expect(defaultScrollFeature()).toBe(false)
  })

  it("is off on a narrow viewport, however precise the pointer", () => {
    withWindow(windowWith({ coarse: false, width: 390 }))
    expect(defaultScrollFeature()).toBe(false)
  })

  it("treats the 1024px boundary as desktop", () => {
    withWindow(windowWith({ coarse: false, width: 1023 }))
    expect(defaultScrollFeature()).toBe(false)
    withWindow(windowWith({ coarse: false, width: 1024 }))
    expect(defaultScrollFeature()).toBe(true)
  })

  it("falls back to on when there is no window or no matchMedia", () => {
    withWindow(null)
    expect(defaultScrollFeature()).toBe(true)
    withWindow({ innerWidth: 1440 })
    expect(defaultScrollFeature()).toBe(true)
  })
})
