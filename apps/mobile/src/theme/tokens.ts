/* ------------------------------------------------------------------ *
 * design tokens
 *
 * A direct port of the custom properties in apps/web/app/globals.css.
 * The names are the css ones with the dashes removed so a value can be
 * traced back to the stylesheet it came from: `--panel-soft` is
 * `panelSoft`, `--accent-cyan` is `accentCyan`.
 *
 * Palettes follow the web app: `default`, `sunset`, `forest`, `mono`
 * override only the accent ramp, exactly as `[data-palette="…"]` does.
 * ------------------------------------------------------------------ */

export type Scheme = "dark" | "light"
export type PaletteName = "default" | "sunset" | "forest" | "mono"

export type Accents = {
  accentBlue: string
  accentCyan: string
  accentPurple: string
  accentRed: string
  accentOrange: string
  accentGreen: string
  accentGrey: string
  ring: string
}

export type Palette = Accents & {
  background: string
  foreground: string
  panel: string
  panelSoft: string
  panelHover: string
  panelBorder: string
  control: string
  controlHover: string
  controlActive: string
  controlActiveForeground: string
  textMuted: string
  textFaint: string
  textSecondary: string
  sidebar: string
  sidebarBorder: string
  danger: string
  warning: string
  success: string
  /** translucent scrim behind sheets and dialogs */
  scrim: string
}

const dark: Palette = {
  background: "#05070c",
  foreground: "#f5f7fb",
  panel: "#0b0f17",
  panelSoft: "#101624",
  panelHover: "#162033",
  panelBorder: "#22304a",
  control: "#0f1624",
  controlHover: "#172236",
  controlActive: "#f5f7fb",
  controlActiveForeground: "#05070c",
  textMuted: "#a2aec5",
  textFaint: "#5f6b82",
  textSecondary: "#cbd5e1",
  sidebar: "#070910",
  sidebarBorder: "#151d2d",
  accentBlue: "#2f80ed",
  accentCyan: "#4cc9f0",
  accentPurple: "#9b5cff",
  accentRed: "#ef476f",
  accentOrange: "#ff9f1c",
  accentGreen: "#22c55e",
  accentGrey: "#8b8f99",
  ring: "#4cc9f0",
  danger: "#ef476f",
  warning: "#ffb703",
  success: "#22c55e",
  scrim: "rgba(3,5,10,0.72)",
}

const light: Palette = {
  background: "#f7f9fc",
  foreground: "#0a0d14",
  panel: "#ffffff",
  panelSoft: "#f0f4fa",
  panelHover: "#e7edf6",
  panelBorder: "#d5deec",
  control: "#f5f7fb",
  controlHover: "#e7edf6",
  controlActive: "#0a0d14",
  controlActiveForeground: "#ffffff",
  textMuted: "#647084",
  textFaint: "#8c98aa",
  textSecondary: "#273244",
  sidebar: "#eef3fa",
  sidebarBorder: "#d5deec",
  accentBlue: "#2f80ed",
  accentCyan: "#0ea5e9",
  accentPurple: "#7c3aed",
  accentRed: "#d72f55",
  accentOrange: "#f97316",
  accentGreen: "#16a34a",
  accentGrey: "#71717a",
  ring: "#2f80ed",
  danger: "#d72f55",
  warning: "#f59e0b",
  success: "#16a34a",
  scrim: "rgba(10,13,20,0.42)",
}

export const SCHEMES: Record<Scheme, Palette> = { dark, light }

/* accent ramps from `[data-palette="…"]` in globals.css */
const OVERRIDES: Record<Exclude<PaletteName, "default">, Partial<Accents>> = {
  sunset: {
    accentBlue: "#fb8500",
    accentCyan: "#ffb703",
    accentPurple: "#f72585",
    accentRed: "#e5383b",
    accentOrange: "#fb8500",
    accentGreen: "#ffb703",
    ring: "#fb8500",
  },
  forest: {
    accentBlue: "#2d6a4f",
    accentCyan: "#43cea2",
    accentPurple: "#2a9d8f",
    accentRed: "#bc4749",
    accentOrange: "#e9c46a",
    accentGreen: "#52b788",
    ring: "#43cea2",
  },
  mono: {
    accentBlue: "#777777",
    accentCyan: "#a7abb4",
    accentPurple: "#8b8f99",
    accentRed: "#b06a6a",
    accentOrange: "#9ca3af",
    accentGreen: "#7f8c8d",
    ring: "#a7abb4",
  },
}

export const PALETTE_NAMES: PaletteName[] = ["default", "sunset", "forest", "mono"]

export function resolvePalette(scheme: Scheme, palette: PaletteName): Palette {
  const base = SCHEMES[scheme]
  if (palette === "default") return base
  return { ...base, ...OVERRIDES[palette] }
}

/* the three corner radii the web shell uses: rounded-xl / 2xl / 3xl */
export const radius = { sm: 12, md: 16, lg: 24, pill: 999 } as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const

/* the mono type scale; every label in the interface is lowercase */
export const font = {
  regular: "JetBrainsMono_400Regular",
  medium: "JetBrainsMono_500Medium",
  bold: "JetBrainsMono_700Bold",
} as const

export const type = {
  tiny: 10,
  micro: 11,
  small: 12,
  body: 13,
  base: 14,
  large: 16,
  title: 20,
} as const

/** the glass look: translucent surface plus the soft border glow */
export const glass = { alpha: 0.72, blur: 18, glow: 0.35 } as const

/** hex + 0..1 alpha as an `rgba()` string; non-hex values pass through */
export function alpha(color: string, value: number): string {
  const hex = color.trim()
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return hex
  const full =
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
  const r = parseInt(full.slice(1, 3), 16)
  const g = parseInt(full.slice(3, 5), 16)
  const b = parseInt(full.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${value})`
}

/** the status ramp of `STATUSES` in apps/web/lib/screenkit/data.ts */
export function statusAccent(status: string, palette: Palette): string {
  switch (status) {
    case "ready":
      return palette.accentGreen
    case "needs review":
      return palette.accentOrange
    case "shooting":
      return palette.accentRed
    default:
      return palette.textMuted
  }
}

/** device -> its natural aspect, from `DEVICES` in the same module */
export const DEVICE_ASPECT: Record<string, string> = {
  phone: "9:16",
  monitor: "16:9",
  tv: "16:9",
  tablet: "16:10",
  projector: "16:9",
  cctv: "4:3",
}
