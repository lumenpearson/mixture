import { isTextEncoding, type TextEncoding } from "./kinds"

/* ------------------------------------------------------------------ *
 * player and preview settings
 *
 * One store for everything that decides how a file is shown: the media
 * player defaults, how bytes reach the browser, and how text is decoded.
 * The store is module-level and framework-free so both React components
 * (through the hook in components/screenkit/media/player-settings.tsx) and
 * plain helpers can read it. Persisted under `screenkit-player-v1`.
 * ------------------------------------------------------------------ */

export const PLAYER_STORAGE_KEY = "screenkit-player-v1"

export const PRELOAD_MODES = ["none", "metadata", "auto"] as const
export type PreloadMode = (typeof PRELOAD_MODES)[number]

/**
 * how bytes of a cloud file reach the player:
 *  - inline: the whole file through the ReadFile rpc (works for private repos, ≤ 4 MiB)
 *  - progressive: a direct url the browser can range-request (public files, site urls)
 *  - auto: progressive when a url exists, inline otherwise
 */
export const STREAMING_MODES = ["auto", "progressive", "inline"] as const
export type StreamingMode = (typeof STREAMING_MODES)[number]

export const PREVIEW_MODES = ["inline", "modal"] as const
export type PreviewMode = (typeof PREVIEW_MODES)[number]

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export type PlayerSettings = {
  autoplay: boolean
  loop: boolean
  muted: boolean
  /** 0 … 100 */
  volume: number
  playbackRate: number
  preload: PreloadMode
  streaming: StreamingMode
  /** seconds the player tries to keep buffered before it reports "ready" */
  bufferAhead: number
  previewMode: PreviewMode
  imageFit: "contain" | "cover"
  /** text decoding; "auto" sniffs byte-order marks and strict utf-8 */
  encoding: TextEncoding | "auto"
  /** space / arrows / m / f inside the player */
  hotkeys: boolean
  /** show codec, buffer and resolution stats over the video */
  stats: boolean
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  autoplay: false,
  loop: false,
  muted: false,
  volume: 80,
  playbackRate: 1,
  preload: "metadata",
  streaming: "auto",
  bufferAhead: 4,
  previewMode: "inline",
  imageFit: "contain",
  encoding: "auto",
  hotkeys: true,
  stats: false,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** validate a stored or foreign object into settings, field by field */
export function normalizePlayerSettings(input: unknown): PlayerSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const bool = (key: keyof PlayerSettings) =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : DEFAULT_PLAYER_SETTINGS[key] as boolean
  const oneOf = <T extends string>(key: keyof PlayerSettings, values: readonly T[]): T =>
    (values as readonly string[]).includes(String(raw[key])) ? (raw[key] as T) : (DEFAULT_PLAYER_SETTINGS[key] as T)
  const rate = Number(raw.playbackRate)
  const encoding = String(raw.encoding ?? "auto")
  return {
    autoplay: bool("autoplay"),
    loop: bool("loop"),
    muted: bool("muted"),
    volume: Number.isFinite(Number(raw.volume)) ? clamp(Math.round(Number(raw.volume)), 0, 100) : DEFAULT_PLAYER_SETTINGS.volume,
    playbackRate: (PLAYBACK_RATES as readonly number[]).includes(rate) ? rate : 1,
    preload: oneOf("preload", PRELOAD_MODES),
    streaming: oneOf("streaming", STREAMING_MODES),
    bufferAhead: Number.isFinite(Number(raw.bufferAhead)) ? clamp(Math.round(Number(raw.bufferAhead)), 0, 30) : DEFAULT_PLAYER_SETTINGS.bufferAhead,
    previewMode: oneOf("previewMode", PREVIEW_MODES),
    imageFit: raw.imageFit === "cover" ? "cover" : "contain",
    encoding: encoding === "auto" ? "auto" : isTextEncoding(encoding) ? encoding : "auto",
    hotkeys: bool("hotkeys"),
    stats: bool("stats"),
  }
}

/* ------------------------------ the store ------------------------------ */

type Listener = () => void

let state: PlayerSettings = DEFAULT_PLAYER_SETTINGS
let loaded = false
const listeners = new Set<Listener>()

function load(): PlayerSettings {
  if (loaded) return state
  loaded = true
  if (typeof window === "undefined") return state
  try {
    const raw = window.localStorage.getItem(PLAYER_STORAGE_KEY)
    if (raw) state = normalizePlayerSettings(JSON.parse(raw))
  } catch {
    state = DEFAULT_PLAYER_SETTINGS
  }
  return state
}

function persist() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage may be full or blocked; the in-memory value still applies
  }
}

export const playerSettingsStore = {
  get: (): PlayerSettings => load(),
  /** the value used during server rendering and hydration */
  getServer: (): PlayerSettings => DEFAULT_PLAYER_SETTINGS,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  update(patch: Partial<PlayerSettings>) {
    state = normalizePlayerSettings({ ...load(), ...patch })
    persist()
    listeners.forEach((listener) => listener())
  },
  reset() {
    state = DEFAULT_PLAYER_SETTINGS
    persist()
    listeners.forEach((listener) => listener())
  },
}
