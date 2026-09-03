import { describe, expect, it } from "vitest"
import {
  applyGlassToDocument,
  DEFAULT_GLASS,
  GLASS_ALPHA_MIN,
  GLASS_KEY,
  GLASS_PRESET_VALUES,
  LEGACY_GLOW_KEY,
  matchGlassPreset,
  normalizeGlassSettings,
  normalizeGlassTargets,
  readGlassSettings,
  writeGlassSettings,
  type GlassRoot,
  type StorageLike,
} from "./glass"

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

function fakeRoot() {
  const attributes = new Map<string, string>()
  const properties = new Map<string, string>()
  const root: GlassRoot & { attributes: Map<string, string>; properties: Map<string, string> } = {
    attributes,
    properties,
    setAttribute: (name, value) => {
      attributes.set(name, value)
    },
    style: {
      setProperty: (name, value) => {
        properties.set(name, value)
      },
    },
  }
  return root
}

describe("normalizeGlassSettings", () => {
  it("clamps every numeric field into its slider range", () => {
    const settings = normalizeGlassSettings({
      blur: 999,
      alpha: 0,
      saturate: -4,
      borderGlow: 12,
    })
    expect(settings.blur).toBe(32)
    expect(settings.alpha).toBe(GLASS_ALPHA_MIN)
    expect(settings.saturate).toBe(0.8)
    expect(settings.borderGlow).toBe(1)
  })

  it("refuses values of the wrong shape and falls back to the defaults", () => {
    const settings = normalizeGlassSettings({
      enabled: "yes",
      blur: "14",
      alpha: Number.NaN,
      glowColor: "chartreuse",
      noise: 1,
    })
    expect(settings).toEqual(DEFAULT_GLASS)
  })

  it("keeps a stored value that is already legal", () => {
    const stored = { ...DEFAULT_GLASS, blur: 3, glowColor: "neutral" as const, noise: true }
    expect(normalizeGlassSettings(stored)).toEqual(stored)
  })

  it("treats a missing, null or non-object payload as the defaults", () => {
    expect(normalizeGlassSettings(undefined)).toEqual(DEFAULT_GLASS)
    expect(normalizeGlassSettings(null)).toEqual(DEFAULT_GLASS)
    expect(normalizeGlassSettings("off")).toEqual(DEFAULT_GLASS)
  })
})

describe("normalizeGlassTargets", () => {
  it("fills in the targets a stored object does not mention", () => {
    expect(normalizeGlassTargets({ cards: false })).toEqual({
      panels: true,
      cards: false,
      rail: true,
      menus: true,
      dialogs: true,
    })
  })

  it("ignores keys that are not booleans and keys it does not know", () => {
    expect(normalizeGlassTargets({ panels: "off", nonsense: true })).toEqual({
      panels: true,
      cards: true,
      rail: true,
      menus: true,
      dialogs: true,
    })
  })
})

describe("matchGlassPreset", () => {
  it("names the preset the values come from", () => {
    expect(matchGlassPreset({ ...DEFAULT_GLASS, ...GLASS_PRESET_VALUES.vivid })).toBe("vivid")
    expect(matchGlassPreset(DEFAULT_GLASS)).toBe("glass")
  })

  it("reports the master switch before anything else", () => {
    expect(matchGlassPreset({ ...DEFAULT_GLASS, enabled: false })).toBe("off")
  })

  it("returns null once a single value has been hand-tuned", () => {
    expect(matchGlassPreset({ ...DEFAULT_GLASS, blur: DEFAULT_GLASS.blur + 1 })).toBeNull()
  })
})

describe("readGlassSettings", () => {
  it("reads and normalizes the stored settings", () => {
    const store = fakeStorage({ [GLASS_KEY]: JSON.stringify({ blur: 40, noise: true }) })
    const settings = readGlassSettings(store)
    expect(settings.blur).toBe(32)
    expect(settings.noise).toBe(true)
  })

  it("survives a corrupt payload", () => {
    expect(readGlassSettings(fakeStorage({ [GLASS_KEY]: "{not json" }))).toEqual(DEFAULT_GLASS)
  })

  it("migrates the pre-glass boolean, persists the result and drops the old key", () => {
    const store = fakeStorage({ [LEGACY_GLOW_KEY]: "off" })
    expect(readGlassSettings(store).enabled).toBe(false)
    expect(store.map.has(LEGACY_GLOW_KEY)).toBe(false)
    // persisted, so clearing nothing and reloading keeps the user's choice
    expect(readGlassSettings(store).enabled).toBe(false)
  })

  it("migrates the enabled case of the same flag", () => {
    const store = fakeStorage({ [LEGACY_GLOW_KEY]: "on" })
    expect(readGlassSettings(store)).toEqual(DEFAULT_GLASS)
    expect(store.map.has(LEGACY_GLOW_KEY)).toBe(false)
  })

  it("falls back to the defaults with no storage at all", () => {
    expect(readGlassSettings(null)).toEqual(DEFAULT_GLASS)
  })
})

describe("writeGlassSettings", () => {
  it("drops the superseded glow flag so it cannot come back", () => {
    const store = fakeStorage({ [LEGACY_GLOW_KEY]: "off" })
    writeGlassSettings(DEFAULT_GLASS, store)
    expect(JSON.parse(store.map.get(GLASS_KEY) ?? "null")).toEqual(DEFAULT_GLASS)
    expect(store.map.has(LEGACY_GLOW_KEY)).toBe(false)
  })
})

describe("applyGlassToDocument", () => {
  it("writes every attribute and custom property glass.css selects on", () => {
    const root = fakeRoot()
    applyGlassToDocument(
      { ...DEFAULT_GLASS, enabled: true, targets: { ...DEFAULT_GLASS.targets, cards: false } },
      root,
    )
    expect(root.attributes.get("data-glass")).toBe("on")
    expect(root.attributes.get("data-glass-cards")).toBe("off")
    expect(root.attributes.get("data-glass-panels")).toBe("on")
    expect(root.properties.get("--glass-blur")).toBe("14px")
    expect(root.properties.get("--glass-glow-color")).toBe("var(--ring)")
    expect(root.properties.get("--glass-noise-image")).toBe("none")
  })

  it("turns the master switch off without dropping the target attributes", () => {
    const root = fakeRoot()
    applyGlassToDocument({ ...DEFAULT_GLASS, enabled: false }, root)
    expect(root.attributes.get("data-glass")).toBe("off")
    expect(root.attributes.get("data-glass-rail")).toBe("on")
  })
})
