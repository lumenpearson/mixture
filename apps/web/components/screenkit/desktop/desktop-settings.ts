/* ------------------------------------------------------------------ *
 * desktop window and title bar settings
 *
 * Everything the Tauri shell lets the user decide about the window itself:
 * how it behaves (always on top, maximized, remembered geometry, minimum
 * size) and how our own title bar looks (height, which side the window
 * buttons sit on, clock, section title, accent line). The window is not
 * part of the page, so this cannot live in `ScreenkitProvider`: the title
 * bar, the settings card and the chrome effects all read the same
 * module-level store, in the shape `lib/rpc/settings.ts` established.
 *
 * Persisted under `screenkit-desktop-v1`. The values are harmless in a
 * browser tab — they simply have nothing to apply to, and the settings card
 * says so instead of rendering controls.
 * ------------------------------------------------------------------ */

export const DESKTOP_STORAGE_KEY = "screenkit-desktop-v1"

/** the bar is one line of monospace: 40 px normally, 32 px compact */
export const TITLEBAR_HEIGHT_PX = 40
export const TITLEBAR_COMPACT_HEIGHT_PX = 32

export const CONTROLS_SIDES = ["left", "right"] as const
export type ControlsSide = (typeof CONTROLS_SIDES)[number]

/** presets rather than two number fields: nobody wants to type a window size */
export const MIN_SIZE_PRESETS = ["none", "720x560", "960x640", "1280x800"] as const
export type MinSizePreset = (typeof MIN_SIZE_PRESETS)[number]

export type WindowBounds = {
  /** logical pixels, as reported by the window scaled to its monitor */
  width: number
  height: number
  x: number
  y: number
}

export type DesktopSettings = {
  /* window */
  alwaysOnTop: boolean
  startMaximized: boolean
  /** save the size and position on move / resize and restore them on start */
  rememberBounds: boolean
  minSize: MinSizePreset
  /** last saved geometry, null until something was remembered */
  bounds: WindowBounds | null

  /* title bar */
  bar: boolean
  compact: boolean
  controlsSide: ControlsSide
  clock: boolean
  sectionTitle: boolean
  accentLine: boolean
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  alwaysOnTop: false,
  startMaximized: false,
  rememberBounds: true,
  minSize: "720x560",
  bounds: null,

  bar: true,
  compact: false,
  controlsSide: "right",
  clock: false,
  sectionTitle: true,
  accentLine: false,
}

/** a window smaller than this cannot show the rail and the content at once */
export const MIN_WINDOW_PX = 320
/** a remembered position further out than this is off every plausible desktop */
const MAX_OFFSET_PX = 10_000

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const int = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN
}

/** the numeric size behind a preset, or null for "no minimum" */
export function minSizeOf(preset: MinSizePreset): { width: number; height: number } | null {
  if (preset === "none") return null
  const [width, height] = preset.split("x").map(Number)
  return { width, height }
}

/**
 * geometry saved by an older build, a different monitor layout or a corrupt
 * storage entry must never place the window where it cannot be reached, so
 * a bad field drops the whole record rather than half-restoring it.
 */
export function normalizeBounds(input: unknown): WindowBounds | null {
  if (!input || typeof input !== "object") return null
  const raw = input as Record<string, unknown>
  const width = int(raw.width)
  const height = int(raw.height)
  const x = int(raw.x)
  const y = int(raw.y)
  if (![width, height, x, y].every(Number.isFinite)) return null
  if (width < MIN_WINDOW_PX || height < MIN_WINDOW_PX) return null
  return {
    width,
    height,
    x: clamp(x, -MAX_OFFSET_PX, MAX_OFFSET_PX),
    y: clamp(y, -MAX_OFFSET_PX, MAX_OFFSET_PX),
  }
}

/** validate a stored or foreign object into settings, field by field */
export function normalizeDesktopSettings(input: unknown): DesktopSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const bool = (key: keyof DesktopSettings) =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : (DEFAULT_DESKTOP_SETTINGS[key] as boolean)
  const oneOf = <T extends string>(key: keyof DesktopSettings, values: readonly T[]): T =>
    (values as readonly string[]).includes(String(raw[key]))
      ? (raw[key] as T)
      : (DEFAULT_DESKTOP_SETTINGS[key] as T)
  return {
    alwaysOnTop: bool("alwaysOnTop"),
    startMaximized: bool("startMaximized"),
    rememberBounds: bool("rememberBounds"),
    minSize: oneOf("minSize", MIN_SIZE_PRESETS),
    bounds: normalizeBounds(raw.bounds),

    bar: bool("bar"),
    compact: bool("compact"),
    controlsSide: oneOf("controlsSide", CONTROLS_SIDES),
    clock: bool("clock"),
    sectionTitle: bool("sectionTitle"),
    accentLine: bool("accentLine"),
  }
}

/** how tall the bar is right now, in css pixels; 0 when it is switched off */
export function titlebarHeight(settings: DesktopSettings): number {
  if (!settings.bar) return 0
  return settings.compact ? TITLEBAR_COMPACT_HEIGHT_PX : TITLEBAR_HEIGHT_PX
}

/* ------------------------------ the store ------------------------------ */

type Listener = () => void

let state: DesktopSettings = DEFAULT_DESKTOP_SETTINGS
let loaded = false
const listeners = new Set<Listener>()

function load(): DesktopSettings {
  if (loaded) return state
  loaded = true
  if (typeof window === "undefined") return state
  try {
    const raw = window.localStorage.getItem(DESKTOP_STORAGE_KEY)
    if (raw) state = normalizeDesktopSettings(JSON.parse(raw))
  } catch {
    state = DEFAULT_DESKTOP_SETTINGS
  }
  return state
}

function persist() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(DESKTOP_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage may be full or blocked; the in-memory value still applies
  }
}

function commit(next: DesktopSettings) {
  state = next
  persist()
  listeners.forEach((listener) => listener())
}

export const desktopSettingsStore = {
  get: (): DesktopSettings => load(),
  /** the value used during server rendering and hydration */
  getServer: (): DesktopSettings => DEFAULT_DESKTOP_SETTINGS,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  update(patch: Partial<DesktopSettings>) {
    commit(normalizeDesktopSettings({ ...load(), ...patch }))
  },
  /**
   * remember the geometry without waking every subscriber: this runs on each
   * debounced resize and nothing on screen renders the numbers.
   */
  rememberBounds(bounds: WindowBounds) {
    const next = normalizeBounds(bounds)
    if (!next) return
    state = { ...load(), bounds: next }
    persist()
  },
  reset() {
    commit(DEFAULT_DESKTOP_SETTINGS)
  },
}
