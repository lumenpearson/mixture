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
 * The geometry itself is not stored here. `tauri-plugin-window-state` keeps
 * size, position and maximized state in the app data directory and is the
 * only writer; `rememberBounds` decides whether the shell asks it to restore
 * on start (see `use-window.ts`).
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

export type DesktopSettings = {
  /* window */
  alwaysOnTop: boolean
  startMaximized: boolean
  /** restore the size and position the shell saved when it last closed */
  rememberBounds: boolean
  minSize: MinSizePreset

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

  bar: true,
  compact: false,
  controlsSide: "right",
  clock: false,
  sectionTitle: true,
  accentLine: false,
}

/** the numeric size behind a preset, or null for "no minimum" */
export function minSizeOf(preset: MinSizePreset): { width: number; height: number } | null {
  if (preset === "none") return null
  const [width, height] = preset.split("x").map(Number)
  return { width, height }
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
  reset() {
    commit(DEFAULT_DESKTOP_SETTINGS)
  },
}
