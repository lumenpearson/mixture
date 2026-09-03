/* ------------------------------------------------------------------ *
 * glass-muted-glow — the settings domain
 *
 * The pure half of `components/screenkit/theme.tsx`'s GlassProvider: the
 * shape stored under `screenkit-glass-v1`, its clamps, the presets, and the
 * `<html>` attributes / custom properties `app/glass.css` reads.
 *
 * It lives in lib rather than in the provider for two reasons: it is
 * testable without react, and the pre-hydration script in
 * `lib/screenkit/appearance.ts` (a server module) needs the same keys,
 * defaults and bounds instead of restating them in a string.
 * ------------------------------------------------------------------ */

export const GLASS_PRESETS = ["off", "muted", "glass", "vivid"] as const
export type GlassPreset = (typeof GLASS_PRESETS)[number]

export const GLASS_GLOW_COLORS = ["accent", "neutral", "category"] as const
export type GlassGlowColor = (typeof GLASS_GLOW_COLORS)[number]

export const GLASS_TARGET_KEYS = ["panels", "cards", "rail", "menus", "dialogs"] as const
export type GlassTargetKey = (typeof GLASS_TARGET_KEYS)[number]
export type GlassTargets = Record<GlassTargetKey, boolean>

export type GlassSettings = {
  enabled: boolean
  blur: number
  alpha: number
  saturate: number
  borderGlow: number
  glowColor: GlassGlowColor
  noise: boolean
  targets: GlassTargets
}

export const GLASS_KEY = "screenkit-glass-v1"
/** pre-glass boolean flag; consumed once, then dropped (see readGlassSettings) */
export const LEGACY_GLOW_KEY = "screenkit-glow"

/**
 * Translucency never drops below this. Text sits on top of these surfaces and
 * the backdrop can be anything (a bright insert on the preview stage, a photo
 * in the cloud grid), so a surface thin enough to read the backdrop through is
 * a contrast failure, not a taste. `glass.css` floors the effective value at
 * the same number (`--glass-alpha-floor`), and the light scheme floors it
 * higher still, because white-ish glass reads thinner.
 */
export const GLASS_ALPHA_MIN = 0.5

/** slider ranges and the clamps `normalizeGlassSettings` applies — one source
 *  so the controls, the stored value and the boot script cannot drift apart */
export const GLASS_BOUNDS = {
  blur: [0, 32],
  alpha: [GLASS_ALPHA_MIN, 1],
  saturate: [0.8, 2],
  borderGlow: [0, 1],
} as const satisfies Record<"blur" | "alpha" | "saturate" | "borderGlow", readonly [number, number]>

export type GlassBoundKey = keyof typeof GLASS_BOUNDS

const DEFAULT_GLASS_TARGETS: GlassTargets = {
  panels: true,
  cards: true,
  rail: true,
  menus: true,
  dialogs: true,
}

export const DEFAULT_GLASS: GlassSettings = {
  enabled: true,
  blur: 14,
  alpha: 0.72,
  saturate: 1.15,
  borderGlow: 0.35,
  glowColor: "accent",
  noise: false,
  targets: DEFAULT_GLASS_TARGETS,
}

export type GlassPresetValues = Pick<
  GlassSettings,
  "blur" | "alpha" | "saturate" | "borderGlow" | "glowColor" | "noise"
>

/** numeric/colour presets; target toggles are a separate control and are
 *  left untouched when a preset is picked. */
export const GLASS_PRESET_VALUES: Record<Exclude<GlassPreset, "off">, GlassPresetValues> = {
  muted: { blur: 8, alpha: 0.85, saturate: 1.05, borderGlow: 0.18, glowColor: "neutral", noise: false },
  glass: { blur: 14, alpha: 0.72, saturate: 1.15, borderGlow: 0.35, glowColor: "accent", noise: false },
  vivid: { blur: 22, alpha: 0.58, saturate: 1.4, borderGlow: 0.62, glowColor: "accent", noise: true },
}

/** what --glass-glow-color resolves to for each colour mode */
export const GLOW_COLOR_VALUE: Record<GlassGlowColor, string> = {
  accent: "var(--ring)",
  neutral: "var(--foreground)",
  category: "currentColor",
}

/* a barely-there fractal-noise grain, only ever switched in via --glass-noise-image */
export const GLASS_NOISE_IMAGE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")"

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeGlassTargets(value: unknown): GlassTargets {
  const parsed = (value && typeof value === "object" ? value : {}) as Partial<
    Record<GlassTargetKey, unknown>
  >
  return GLASS_TARGET_KEYS.reduce<GlassTargets>(
    (acc, key) => {
      acc[key] = typeof parsed[key] === "boolean" ? (parsed[key] as boolean) : DEFAULT_GLASS_TARGETS[key]
      return acc
    },
    { ...DEFAULT_GLASS_TARGETS },
  )
}

export function normalizeGlassSettings(value: unknown): GlassSettings {
  const parsed = (value && typeof value === "object" ? value : {}) as Partial<
    Record<keyof GlassSettings, unknown>
  >
  const num = (key: GlassBoundKey): number => {
    const raw = parsed[key]
    const [min, max] = GLASS_BOUNDS[key]
    return typeof raw === "number" && Number.isFinite(raw) ? clamp(raw, min, max) : DEFAULT_GLASS[key]
  }
  return {
    enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_GLASS.enabled,
    blur: num("blur"),
    alpha: num("alpha"),
    saturate: num("saturate"),
    borderGlow: num("borderGlow"),
    glowColor: (GLASS_GLOW_COLORS as readonly string[]).includes(parsed.glowColor as string)
      ? (parsed.glowColor as GlassGlowColor)
      : DEFAULT_GLASS.glowColor,
    noise: typeof parsed.noise === "boolean" ? parsed.noise : DEFAULT_GLASS.noise,
    targets: normalizeGlassTargets(parsed.targets),
  }
}

/** the preset the given values match, or null when they are hand-tuned */
export function matchGlassPreset(glass: GlassSettings): GlassPreset | null {
  if (!glass.enabled) return "off"
  const entries = Object.entries(GLASS_PRESET_VALUES) as [
    Exclude<GlassPreset, "off">,
    GlassPresetValues,
  ][]
  const match = entries.find(
    ([, values]) =>
      values.blur === glass.blur &&
      values.alpha === glass.alpha &&
      values.saturate === glass.saturate &&
      values.borderGlow === glass.borderGlow &&
      values.glowColor === glass.glowColor &&
      values.noise === glass.noise,
  )
  return match ? match[0] : null
}

/** the slice of the Storage interface these helpers use, so tests can pass a map */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function writeGlassSettings(
  glass: GlassSettings,
  store: StorageLike | null = browserStorage(),
): void {
  if (!store) return
  try {
    store.setItem(GLASS_KEY, JSON.stringify(glass))
    // the pre-glass boolean has now been superseded on disk; drop it so a later
    // reset of `screenkit-glass-v1` cannot resurrect a stale "off".
    store.removeItem(LEGACY_GLOW_KEY)
  } catch {
    // ignore
  }
}

/**
 * Read the stored settings, migrating the pre-glass boolean flag. The
 * migration writes immediately: consuming `screenkit-glow` without persisting
 * the result would lose the user's "off" on the next reload.
 */
export function readGlassSettings(store: StorageLike | null = browserStorage()): GlassSettings {
  if (!store) return DEFAULT_GLASS
  try {
    const raw = store.getItem(GLASS_KEY)
    if (raw) return normalizeGlassSettings(JSON.parse(raw))
    const legacyGlow = store.getItem(LEGACY_GLOW_KEY)
    if (legacyGlow === "off" || legacyGlow === "on") {
      const migrated: GlassSettings = { ...DEFAULT_GLASS, enabled: legacyGlow === "on" }
      writeGlassSettings(migrated, store)
      return migrated
    }
  } catch {
    // ignore
  }
  return DEFAULT_GLASS
}

/** the element side of the contract: exactly what `glass.css` selects on */
export type GlassRoot = {
  setAttribute: (name: string, value: string) => void
  style: { setProperty: (name: string, value: string) => void }
}

export function applyGlassToDocument(glass: GlassSettings, root?: GlassRoot): void {
  const el = root ?? (typeof document === "undefined" ? null : document.documentElement)
  if (!el) return
  el.setAttribute("data-glass", glass.enabled ? "on" : "off")
  for (const key of GLASS_TARGET_KEYS) {
    el.setAttribute(`data-glass-${key}`, glass.targets[key] ? "on" : "off")
  }
  el.style.setProperty("--glass-blur", `${glass.blur}px`)
  el.style.setProperty("--glass-alpha", String(glass.alpha))
  el.style.setProperty("--glass-saturate", String(glass.saturate))
  el.style.setProperty("--glass-border-glow", String(glass.borderGlow))
  el.style.setProperty("--glass-glow-color", GLOW_COLOR_VALUE[glass.glowColor])
  el.style.setProperty("--glass-noise", glass.noise ? "1" : "0")
  el.style.setProperty("--glass-noise-image", glass.noise ? GLASS_NOISE_IMAGE : "none")
}
