import { describe, expect, it } from "vitest"
import {
  APPEARANCE_BOOT_SCRIPT,
  DEFAULT_SCALE,
  GRADIENT_KEY,
  PALETTE_KEY,
  RAIL_LAYOUT_KEY,
  SCALE_KEY,
  SCALE_VALUE,
} from "./appearance"
import {
  applyGlassToDocument,
  DEFAULT_GLASS,
  GLASS_KEY,
  LEGACY_GLOW_KEY,
  normalizeGlassSettings,
  type GlassSettings,
} from "./glass"

/* ------------------------------------------------------------------ *
 * The boot script is a hand-written string that has to agree with
 * `applyGlassToDocument` and the providers. Rather than eyeballing it, run it:
 * the script only ever touches `window`, so a plain object stands in for the
 * browser and the assertions compare its output with the same helpers the
 * providers use. A clamp or a key that drifts fails here.
 * ------------------------------------------------------------------ */

type Recorded = {
  attributes: Map<string, string>
  properties: Map<string, string>
  removed: string[]
}

function runBootScript(stored: Record<string, string>, broken = false): Recorded {
  const attributes = new Map<string, string>()
  const properties = new Map<string, string>()
  const removed: string[] = []
  const documentElement = {
    attributes,
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value)
    },
    removeAttribute: (name: string) => {
      removed.push(name)
      attributes.delete(name)
    },
    style: {
      setProperty: (name: string, value: string) => {
        properties.set(name, value)
      },
    },
  }
  const win = {
    document: { documentElement },
    localStorage: {
      getItem: (key: string) => {
        if (broken) throw new Error("storage is blocked in private mode")
        return stored[key] ?? null
      },
    },
  }
  new Function("window", APPEARANCE_BOOT_SCRIPT)(win)
  return { attributes, properties, removed }
}

/** what `applyGlassToDocument` would write for the same settings */
function expectedGlass(settings: GlassSettings) {
  const attributes = new Map<string, string>()
  const properties = new Map<string, string>()
  applyGlassToDocument(settings, {
    setAttribute: (name, value) => attributes.set(name, value),
    style: { setProperty: (name, value) => properties.set(name, value) },
  })
  return { attributes, properties }
}

describe("APPEARANCE_BOOT_SCRIPT", () => {
  it("paints the defaults when nothing has been stored yet", () => {
    const { attributes, properties } = runBootScript({})
    expect(attributes.get("data-palette")).toBe("cobalt")
    expect(attributes.get("data-gradients")).toBe("soft")
    expect(properties.get("--app-scale")).toBe(String(SCALE_VALUE[DEFAULT_SCALE]))
    expect(attributes.get("data-glass")).toBe("on")
    expect(attributes.has("data-rail")).toBe(false)
  })

  it("writes exactly what applyGlassToDocument writes for stored settings", () => {
    const stored = {
      enabled: true,
      blur: 22,
      alpha: 0.58,
      saturate: 1.4,
      borderGlow: 0.62,
      glowColor: "neutral",
      noise: true,
      targets: { cards: false, menus: false },
    }
    const { attributes, properties } = runBootScript({ [GLASS_KEY]: JSON.stringify(stored) })
    const expected = expectedGlass(normalizeGlassSettings(stored))
    for (const [name, value] of expected.attributes) {
      expect([name, attributes.get(name)]).toEqual([name, value])
    }
    for (const [name, value] of expected.properties) {
      expect([name, properties.get(name)]).toEqual([name, value])
    }
  })

  it("applies the same clamps as normalizeGlassSettings", () => {
    const out_of_range = { blur: 900, alpha: 0.01, saturate: 9, borderGlow: -3 }
    const { properties } = runBootScript({ [GLASS_KEY]: JSON.stringify(out_of_range) })
    const expected = expectedGlass(normalizeGlassSettings(out_of_range))
    expect(properties.get("--glass-blur")).toBe(expected.properties.get("--glass-blur"))
    expect(properties.get("--glass-alpha")).toBe(expected.properties.get("--glass-alpha"))
    expect(properties.get("--glass-saturate")).toBe(expected.properties.get("--glass-saturate"))
    expect(properties.get("--glass-border-glow")).toBe(
      expected.properties.get("--glass-border-glow"),
    )
  })

  it("rejects a stored glow colour that is not one of the three", () => {
    const { properties } = runBootScript({
      [GLASS_KEY]: JSON.stringify({ glowColor: "constructor" }),
    })
    expect(properties.get("--glass-glow-color")).toBe("var(--ring)")
  })

  it("honours the pre-glass boolean flag before the provider migrates it", () => {
    expect(runBootScript({ [LEGACY_GLOW_KEY]: "off" }).attributes.get("data-glass")).toBe("off")
    expect(runBootScript({ [LEGACY_GLOW_KEY]: "on" }).attributes.get("data-glass")).toBe("on")
  })

  it("keeps a hidden rail hidden through the first paint", () => {
    const hidden = runBootScript({
      [RAIL_LAYOUT_KEY]: JSON.stringify({ side: "left", railVisible: false }),
    })
    expect(hidden.attributes.get("data-rail")).toBe("hidden")

    const visible = runBootScript({
      [RAIL_LAYOUT_KEY]: JSON.stringify({ side: "left", railVisible: true }),
    })
    expect(visible.attributes.has("data-rail")).toBe(false)
  })

  it("falls back to the defaults on unknown or corrupt stored values", () => {
    const { attributes, properties } = runBootScript({
      [PALETTE_KEY]: "octarine",
      [GRADIENT_KEY]: "",
      [SCALE_KEY]: "enormous",
      [GLASS_KEY]: "{ not json",
      [RAIL_LAYOUT_KEY]: "[]",
    })
    expect(attributes.get("data-palette")).toBe("cobalt")
    expect(attributes.get("data-gradients")).toBe("soft")
    expect(properties.get("--app-scale")).toBe(String(SCALE_VALUE[DEFAULT_SCALE]))
    expect(attributes.get("data-glass")).toBe(DEFAULT_GLASS.enabled ? "on" : "off")
    expect(attributes.has("data-rail")).toBe(false)
  })

  it("ignores the pre-glass flag when the glass payload is present but corrupt", () => {
    /* `readGlassSettings` consults `screenkit-glow` only when GLASS_KEY is
       absent — a payload that fails to parse falls back to the defaults. The
       boot script used to treat "unparseable" as "absent", so a truncated
       payload next to a legacy "off" painted opaque for one frame and then
       turned translucent on hydration: the exact flash this script exists to
       prevent. */
    const { attributes } = runBootScript({
      [GLASS_KEY]: "{ not json",
      [LEGACY_GLOW_KEY]: "off",
    })
    expect(attributes.get("data-glass")).toBe(DEFAULT_GLASS.enabled ? "on" : "off")
  })

  it("does not throw when localStorage itself is unavailable", () => {
    expect(() => runBootScript({}, true)).not.toThrow()
  })

  it("carries no raw '<' that could close the script element", () => {
    expect(APPEARANCE_BOOT_SCRIPT).not.toContain("<")
  })
})
