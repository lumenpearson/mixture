"use client"

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes"
import * as React from "react"
import { MotionProvider, useMotion } from "./motion"
import { StickyCursor } from "./sticky-cursor"

export const PALETTES = ["cobalt", "sunset", "forest", "mono"] as const
export type Palette = (typeof PALETTES)[number]

/* gradient intensity — user-personalisable, applied to accent surfaces
   (category tiles / icons / active accents). minimal by default. */
export const GRADIENT_LEVELS = ["off", "soft", "vivid"] as const
export type GradientLevel = (typeof GRADIENT_LEVELS)[number]

/* site scale / zoom — scales the root font-size so every rem-based size and
   spacing token grows or shrinks together. defaults a touch larger than 1. */
export const SCALE_LEVELS = ["compact", "normal", "large", "huge"] as const
export type ScaleLevel = (typeof SCALE_LEVELS)[number]
export const SCALE_VALUE: Record<ScaleLevel, number> = {
  compact: 0.92,
  normal: 1,
  large: 1.08,
  huge: 1.2,
}
const DEFAULT_SCALE: ScaleLevel = "large"

const PALETTE_KEY = "screenkit-palette"
const GRADIENT_KEY = "screenkit-gradients"
const SCALE_KEY = "screenkit-scale"

type PaletteCtx = {
  palette: Palette
  setPalette: (p: Palette) => void
  gradients: GradientLevel
  setGradients: (g: GradientLevel) => void
  scale: ScaleLevel
  setScale: (s: ScaleLevel) => void
  /** thin alias over useGlass().glass.enabled / setEnabled — kept so older call
   *  sites that only care about "is glass on" don't need the full glass api */
  glow: boolean
  setGlow: (enabled: boolean) => void
  /** run a dom mutation inside a crossfade view-transition (respects reduce-motion) */
  transition: (fn: () => void) => void
}

const PaletteContext = React.createContext<PaletteCtx | null>(null)

/** shared by every theme.tsx provider that needs to crossfade a <html> mutation */
function useCrossfadeTransition() {
  const { reduceMotion, features } = useMotion()
  return React.useCallback(
    (fn: () => void) => {
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => unknown
      }
      if (
        reduceMotion ||
        !features.viewTransitions ||
        typeof document === "undefined" ||
        !doc.startViewTransition
      ) {
        fn()
        return
      }
      doc.startViewTransition(fn)
    },
    [reduceMotion, features.viewTransitions],
  )
}

/* ------------------------------------------------------------------ *
 * glass-muted-glow
 *
 * translucent surface treatment with a glowing border highlight. lives in
 * its own provider/context so `glass.css` has one clear source of truth for
 * the <html> attributes and --glass-* variables it reads; usePalette() keeps
 * a `glow` / `setGlow` alias over the master switch for older call sites.
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

const GLASS_KEY = "screenkit-glass-v1"
/** pre-glass boolean flag; "off" migrates straight to `enabled: false` */
const LEGACY_GLOW_KEY = "screenkit-glow"

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

type GlassPresetValues = Pick<
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

function normalizeGlassTargets(value: unknown): GlassTargets {
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

function normalizeGlassSettings(value: unknown): GlassSettings {
  const parsed = (value && typeof value === "object" ? value : {}) as Partial<
    Record<keyof GlassSettings, unknown>
  >
  return {
    enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_GLASS.enabled,
    blur: typeof parsed.blur === "number" ? clamp(parsed.blur, 0, 32) : DEFAULT_GLASS.blur,
    alpha: typeof parsed.alpha === "number" ? clamp(parsed.alpha, 0.2, 1) : DEFAULT_GLASS.alpha,
    saturate: typeof parsed.saturate === "number" ? clamp(parsed.saturate, 0.8, 2) : DEFAULT_GLASS.saturate,
    borderGlow:
      typeof parsed.borderGlow === "number" ? clamp(parsed.borderGlow, 0, 1) : DEFAULT_GLASS.borderGlow,
    glowColor: (GLASS_GLOW_COLORS as readonly string[]).includes(parsed.glowColor as string)
      ? (parsed.glowColor as GlassGlowColor)
      : DEFAULT_GLASS.glowColor,
    noise: typeof parsed.noise === "boolean" ? parsed.noise : DEFAULT_GLASS.noise,
    targets: normalizeGlassTargets(parsed.targets),
  }
}

function readGlassSettings(): GlassSettings {
  if (typeof window === "undefined") return DEFAULT_GLASS
  try {
    const raw = window.localStorage.getItem(GLASS_KEY)
    if (raw) return normalizeGlassSettings(JSON.parse(raw))
    const legacyGlow = window.localStorage.getItem(LEGACY_GLOW_KEY)
    if (legacyGlow === "off") return { ...DEFAULT_GLASS, enabled: false }
  } catch {
    // ignore
  }
  return DEFAULT_GLASS
}

function writeGlassSettings(glass: GlassSettings) {
  try {
    window.localStorage.setItem(GLASS_KEY, JSON.stringify(glass))
  } catch {
    // ignore
  }
}

function applyGlassToDocument(glass: GlassSettings) {
  if (typeof document === "undefined") return
  const el = document.documentElement
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

type GlassCtx = {
  glass: GlassSettings
  /** the preset the current values match, or null when hand-tuned */
  activePreset: GlassPreset | null
  setEnabled: (enabled: boolean) => void
  setPreset: (preset: GlassPreset) => void
  setBlur: (blur: number) => void
  setAlpha: (alpha: number) => void
  setSaturate: (saturate: number) => void
  setBorderGlow: (borderGlow: number) => void
  setGlowColor: (color: GlassGlowColor) => void
  setNoise: (noise: boolean) => void
  setTarget: (key: GlassTargetKey, enabled: boolean) => void
  reset: () => void
}

const GlassContext = React.createContext<GlassCtx | null>(null)

function GlassProvider({ children }: { children: React.ReactNode }) {
  const transition = useCrossfadeTransition()
  const [glass, setGlassState] = React.useState<GlassSettings>(DEFAULT_GLASS)

  // hydrate from storage (migrating the legacy boolean flag) + apply to <html>
  React.useEffect(() => {
    const initial = readGlassSettings()
    setGlassState(initial)
    applyGlassToDocument(initial)
  }, [])

  /** commit a full next value: dom write is synchronous so glass.css never
   *  waits on a react re-render; continuous slider drags skip the view
   *  transition so dragging doesn't snapshot the dom on every tick. */
  const commit = React.useCallback(
    (next: GlassSettings, crossfade: boolean) => {
      const run = () => {
        setGlassState(next)
        applyGlassToDocument(next)
      }
      if (crossfade) transition(run)
      else run()
      writeGlassSettings(next)
    },
    [transition],
  )

  const setEnabled = React.useCallback(
    (enabled: boolean) => commit({ ...glass, enabled }, true),
    [glass, commit],
  )

  const setPreset = React.useCallback(
    (preset: GlassPreset) => {
      const next: GlassSettings =
        preset === "off"
          ? { ...glass, enabled: false }
          : { ...glass, enabled: true, ...GLASS_PRESET_VALUES[preset] }
      commit(next, true)
    },
    [glass, commit],
  )

  const setBlur = React.useCallback((blur: number) => commit({ ...glass, blur }, false), [glass, commit])
  const setAlpha = React.useCallback((alpha: number) => commit({ ...glass, alpha }, false), [glass, commit])
  const setSaturate = React.useCallback(
    (saturate: number) => commit({ ...glass, saturate }, false),
    [glass, commit],
  )
  const setBorderGlow = React.useCallback(
    (borderGlow: number) => commit({ ...glass, borderGlow }, false),
    [glass, commit],
  )
  const setGlowColor = React.useCallback(
    (glowColor: GlassGlowColor) => commit({ ...glass, glowColor }, true),
    [glass, commit],
  )
  const setNoise = React.useCallback((noise: boolean) => commit({ ...glass, noise }, true), [glass, commit])
  const setTarget = React.useCallback(
    (key: GlassTargetKey, enabled: boolean) =>
      commit({ ...glass, targets: { ...glass.targets, [key]: enabled } }, true),
    [glass, commit],
  )
  const reset = React.useCallback(() => commit({ ...DEFAULT_GLASS }, true), [commit])

  const activePreset = React.useMemo<GlassPreset | null>(() => {
    if (!glass.enabled) return "off"
    const match = (Object.entries(GLASS_PRESET_VALUES) as [Exclude<GlassPreset, "off">, GlassPresetValues][]).find(
      ([, values]) =>
        values.blur === glass.blur &&
        values.alpha === glass.alpha &&
        values.saturate === glass.saturate &&
        values.borderGlow === glass.borderGlow &&
        values.glowColor === glass.glowColor &&
        values.noise === glass.noise,
    )
    return match ? match[0] : null
  }, [glass])

  const value = React.useMemo<GlassCtx>(
    () => ({
      glass,
      activePreset,
      setEnabled,
      setPreset,
      setBlur,
      setAlpha,
      setSaturate,
      setBorderGlow,
      setGlowColor,
      setNoise,
      setTarget,
      reset,
    }),
    [
      glass,
      activePreset,
      setEnabled,
      setPreset,
      setBlur,
      setAlpha,
      setSaturate,
      setBorderGlow,
      setGlowColor,
      setNoise,
      setTarget,
      reset,
    ],
  )

  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>
}

export function useGlass() {
  const ctx = React.useContext(GlassContext)
  if (!ctx) throw new Error("useGlass must be used within ThemeProvider")
  return ctx
}

/* ------------------------------------------------------------------ *
 * accent surface helper
 * ------------------------------------------------------------------ */
export function accentSurface(
  accent: string,
  level: GradientLevel,
  active: boolean,
): string {
  if (level === "off") {
    return active ? accent : `color-mix(in srgb, ${accent} 16%, transparent)`
  }
  if (active) {
    const lo = level === "vivid" ? 70 : 84
    const hi = level === "vivid" ? 82 : 92
    return `linear-gradient(145deg, color-mix(in srgb, ${accent} ${lo}%, #ffffff) 0%, ${accent} 52%, color-mix(in srgb, ${accent} ${hi}%, #000000) 100%)`
  }
  const top = level === "vivid" ? 26 : 18
  const bot = level === "vivid" ? 12 : 8
  return `linear-gradient(145deg, color-mix(in srgb, ${accent} ${top}%, transparent), color-mix(in srgb, ${accent} ${bot}%, transparent))`
}

function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = React.useState<Palette>("cobalt")
  const [gradients, setGradientsState] = React.useState<GradientLevel>("soft")
  const [scale, setScaleState] = React.useState<ScaleLevel>(DEFAULT_SCALE)
  // glass-muted-glow lives in its own provider (an ancestor of this one); the
  // `glow` / `setGlow` fields below are a thin alias over its master switch.
  const glass = useGlass()

  // hydrate from storage + apply to <html data-palette / data-gradients / scale>
  React.useEffect(() => {
    let initialPalette: Palette = "cobalt"
    let initialGradients: GradientLevel = "soft"
    let initialScale: ScaleLevel = DEFAULT_SCALE
    try {
      const sp = window.localStorage.getItem(PALETTE_KEY)
      if (sp && (PALETTES as readonly string[]).includes(sp)) {
        initialPalette = sp as Palette
      }
      const sg = window.localStorage.getItem(GRADIENT_KEY)
      if (sg && (GRADIENT_LEVELS as readonly string[]).includes(sg)) {
        initialGradients = sg as GradientLevel
      }
      const ss = window.localStorage.getItem(SCALE_KEY)
      if (ss && (SCALE_LEVELS as readonly string[]).includes(ss)) {
        initialScale = ss as ScaleLevel
      }
    } catch {
      // ignore
    }
    setPaletteState(initialPalette)
    setGradientsState(initialGradients)
    setScaleState(initialScale)
    document.documentElement.setAttribute("data-palette", initialPalette)
    document.documentElement.setAttribute("data-gradients", initialGradients)
    document.documentElement.style.setProperty(
      "--app-scale",
      String(SCALE_VALUE[initialScale]),
    )
  }, [])

  // crossfade helper using the View Transitions API (graceful fallback)
  const transition = useCrossfadeTransition()

  const setPalette = React.useCallback(
    (p: Palette) => {
      transition(() => {
        setPaletteState(p)
        document.documentElement.setAttribute("data-palette", p)
      })
      try {
        window.localStorage.setItem(PALETTE_KEY, p)
      } catch {
        // ignore
      }
    },
    [transition],
  )

  const setGradients = React.useCallback(
    (g: GradientLevel) => {
      transition(() => {
        setGradientsState(g)
        document.documentElement.setAttribute("data-gradients", g)
      })
      try {
        window.localStorage.setItem(GRADIENT_KEY, g)
      } catch {
        // ignore
      }
    },
    [transition],
  )

  const setScale = React.useCallback(
    (s: ScaleLevel) => {
      transition(() => {
        setScaleState(s)
        document.documentElement.style.setProperty(
          "--app-scale",
          String(SCALE_VALUE[s]),
        )
      })

      try {
        window.localStorage.setItem(SCALE_KEY, s)
      } catch {
        // ignore
      }
    },
    [transition],
  )

  const value = React.useMemo(
    () => ({
      palette,
      setPalette,
      gradients,
      setGradients,
      scale,
      setScale,
      glow: glass.glass.enabled,
      setGlow: glass.setEnabled,
      transition,
    }),
    [
      palette,
      setPalette,
      gradients,
      setGradients,
      scale,
      setScale,
      glass.glass.enabled,
      glass.setEnabled,
      transition,
    ],
  )

  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  )
}

export function usePalette() {
  const ctx = React.useContext(PaletteContext)
  if (!ctx) throw new Error("usePalette must be used within ThemeProvider")
  return ctx
}

/** non-throwing accessor for the gradient level (safe in any client subtree) */
export function useGradients(): GradientLevel {
  const ctx = React.useContext(PaletteContext)
  return ctx?.gradients ?? "soft"
}

/** crossfade helper for theme-mode switches (light / dark / system) */
export function useThemeTransition() {
  const ctx = React.useContext(PaletteContext)
  return ctx?.transition ?? ((fn: () => void) => fn())
}

/* re-export next-themes hook for mode (light / dark / system) */
export function useThemeMode() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useNextTheme()
  return { theme, setTheme, resolvedTheme, systemTheme }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <MotionProvider>
        <GlassProvider>
          <PaletteProvider>
            {children}
            <StickyCursor />
          </PaletteProvider>
        </GlassProvider>
      </MotionProvider>
    </NextThemesProvider>
  )
}
