"use client"

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes"
import * as React from "react"
import {
  DEFAULT_GRADIENTS,
  DEFAULT_PALETTE,
  DEFAULT_SCALE,
  GRADIENT_KEY,
  GRADIENT_LEVELS,
  PALETTE_KEY,
  PALETTES,
  SCALE_KEY,
  SCALE_LEVELS,
  SCALE_VALUE,
  type GradientLevel,
  type Palette,
  type ScaleLevel,
} from "@/lib/screenkit/appearance"
import {
  applyGlassToDocument,
  DEFAULT_GLASS,
  GLASS_ALPHA_MIN,
  GLASS_BOUNDS,
  GLASS_GLOW_COLORS,
  GLASS_NOISE_IMAGE,
  GLASS_PRESET_VALUES,
  GLASS_PRESETS,
  GLASS_TARGET_KEYS,
  GLOW_COLOR_VALUE,
  matchGlassPreset,
  readGlassSettings,
  writeGlassSettings,
  type GlassGlowColor,
  type GlassPreset,
  type GlassSettings,
  type GlassTargetKey,
  type GlassTargets,
} from "@/lib/screenkit/glass"
import { MotionProvider, useMotion } from "./motion"
import { StickyCursor } from "./sticky-cursor"

/* palette / gradients / scale / glass live in lib so the pre-hydration script
   in app/layout.tsx can share their keys and defaults; re-exported here
   because every call site in the shell reads them off the provider module. */
export {
  DEFAULT_GLASS,
  GLASS_ALPHA_MIN,
  GLASS_BOUNDS,
  GLASS_GLOW_COLORS,
  GLASS_NOISE_IMAGE,
  GLASS_PRESET_VALUES,
  GLASS_PRESETS,
  GLASS_TARGET_KEYS,
  GLOW_COLOR_VALUE,
  GRADIENT_LEVELS,
  PALETTES,
  SCALE_LEVELS,
  SCALE_VALUE,
}
export type {
  GlassGlowColor,
  GlassPreset,
  GlassSettings,
  GlassTargetKey,
  GlassTargets,
  GradientLevel,
  Palette,
  ScaleLevel,
}

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
 * translucent surface treatment with a glowing border highlight. the stored
 * shape, its clamps and the <html> writes live in lib/screenkit/glass.ts (the
 * pre-hydration script needs them too); this provider is the react half.
 * usePalette() keeps a `glow` / `setGlow` alias over the master switch for
 * older call sites.
 * ------------------------------------------------------------------ */

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

  // hydrate from storage (migrating the legacy boolean flag) + apply to <html>.
  // APPEARANCE_BOOT_SCRIPT has normally written the same attributes before the
  // first paint; this re-applies them so nothing depends on that script having
  // run, and mirrors the values into react state for the controls.
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

  const activePreset = React.useMemo<GlassPreset | null>(() => matchGlassPreset(glass), [glass])

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
  const [palette, setPaletteState] = React.useState<Palette>(DEFAULT_PALETTE)
  const [gradients, setGradientsState] = React.useState<GradientLevel>(DEFAULT_GRADIENTS)
  const [scale, setScaleState] = React.useState<ScaleLevel>(DEFAULT_SCALE)
  // glass-muted-glow lives in its own provider (an ancestor of this one); the
  // `glow` / `setGlow` fields below are a thin alias over its master switch.
  const glass = useGlass()

  // mirror the values the pre-hydration script (APPEARANCE_BOOT_SCRIPT) already
  // painted on <html> into react state, and re-apply them so the two agree even
  // when that script could not run
  React.useEffect(() => {
    let initialPalette: Palette = DEFAULT_PALETTE
    let initialGradients: GradientLevel = DEFAULT_GRADIENTS
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
