import { describe, expect, it } from "vitest"
import {
  DEFAULT_DESKTOP_SETTINGS,
  TITLEBAR_COMPACT_HEIGHT_PX,
  TITLEBAR_HEIGHT_PX,
  minSizeOf,
  normalizeDesktopSettings,
  titlebarHeight,
} from "./desktop-settings"

describe("normalizeDesktopSettings", () => {
  it("returns the defaults for anything that is not an object", () => {
    for (const input of [undefined, null, 7, "x", []]) {
      expect(normalizeDesktopSettings(input)).toEqual(DEFAULT_DESKTOP_SETTINGS)
    }
  })

  it("keeps the documented defaults", () => {
    expect(DEFAULT_DESKTOP_SETTINGS).toMatchObject({
      bar: true,
      controlsSide: "right",
      clock: false,
      sectionTitle: true,
      compact: false,
      alwaysOnTop: false,
      startMaximized: false,
      rememberBounds: true,
    })
  })

  it("accepts a full valid object unchanged", () => {
    const input = {
      ...DEFAULT_DESKTOP_SETTINGS,
      alwaysOnTop: true,
      compact: true,
      controlsSide: "left" as const,
      minSize: "1280x800" as const,
    }
    expect(normalizeDesktopSettings(input)).toEqual(input)
  })

  // the geometry moved to tauri-plugin-window-state; a settings record left
  // over from a build that stored it must not carry the field back in
  it("drops the geometry an older build persisted", () => {
    const result = normalizeDesktopSettings({
      ...DEFAULT_DESKTOP_SETTINGS,
      bounds: { width: 1000, height: 700, x: 12, y: 34 },
    })
    expect(result).toEqual(DEFAULT_DESKTOP_SETTINGS)
    expect("bounds" in result).toBe(false)
  })

  it("falls back per field instead of discarding the whole record", () => {
    const result = normalizeDesktopSettings({
      alwaysOnTop: "yes",
      controlsSide: "top",
      minSize: "1x1",
      clock: true,
    })
    expect(result.alwaysOnTop).toBe(false)
    expect(result.controlsSide).toBe("right")
    expect(result.minSize).toBe(DEFAULT_DESKTOP_SETTINGS.minSize)
    expect(result.clock).toBe(true)
  })
})

describe("minSizeOf", () => {
  it("has no minimum for the none preset", () => {
    expect(minSizeOf("none")).toBeNull()
  })

  it("reads the size out of the preset id", () => {
    expect(minSizeOf("960x640")).toEqual({ width: 960, height: 640 })
  })
})

describe("titlebarHeight", () => {
  it("is zero while the bar is switched off", () => {
    expect(titlebarHeight({ ...DEFAULT_DESKTOP_SETTINGS, bar: false })).toBe(0)
    expect(titlebarHeight({ ...DEFAULT_DESKTOP_SETTINGS, bar: false, compact: true })).toBe(0)
  })

  it("switches between the full and the compact height", () => {
    expect(titlebarHeight(DEFAULT_DESKTOP_SETTINGS)).toBe(TITLEBAR_HEIGHT_PX)
    expect(titlebarHeight({ ...DEFAULT_DESKTOP_SETTINGS, compact: true })).toBe(TITLEBAR_COMPACT_HEIGHT_PX)
  })
})
