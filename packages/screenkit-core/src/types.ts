export type Locale = "ru" | "en"

/* the interface may speak more languages than the inserts do: `snark` is a
   russian voice with light sarcasm and kaomoji that falls back to russian for
   any insert content */
export type UiLocale = Locale | "snark"

/** the content locale an interface locale resolves to */
export const contentLocaleOf = (locale: UiLocale): Locale => (locale === "en" ? "en" : "ru")

/* what an insert renders: a packaged scene, a live website inside the frame,
   or a file from the cloud drive (image, video, pdf, text) */
export type InsertKind = "scene" | "site" | "file"

export type InsertSource = {
  /** website url for `site` inserts */
  url?: string
  /** cloud-drive path for `file` inserts */
  path?: string
  /** which scene package draws a `scene` insert; absent = resolve by id/category */
  sceneKey?: string
  /** how a file fills the screen */
  fit?: "contain" | "cover"
  /** zoom factor for sites and images (1 = natural) */
  zoom?: number
  /** allow scrolling inside a site insert */
  scroll?: boolean
  /** media playback flags for file inserts */
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  /** background behind letterboxed content, a css color */
  background?: string
}

export type LocalizedText = { ru: string; en?: string }
export type LocalizedList = { ru: string[]; en?: string[] }

export type InsertStatus = "draft" | "ready" | "needs review" | "shooting"

export type DeviceType =
  | "phone"
  | "monitor"
  | "tv"
  | "tablet"
  | "projector"
  | "cctv"

export type AspectRatio = "9:16" | "16:9" | "4:3" | "16:10"

export type PlaybackMode = "clean" | "filmed" | "dirty"

/* built-in category ids; custom categories add their own string ids */
export type BuiltInCategoryId =
  | "phones"
  | "cctv"
  | "trackers"
  | "tv-news"
  | "bank"
  | "hq-monitors"

export type CategoryId = BuiltInCategoryId | (string & {})

/* a category definition carries its own localized label + colors so that
   custom, user-added categories are fully self-describing */
export type CategoryDef = {
  id: CategoryId
  accent: string
  tint: string
  label: LocalizedText
  /** optional chosen icon name from the shared icon library */
  icon?: string
  custom?: boolean
}

export type Insert = {
  id: string
  date: string
  episode: string
  scene: string
  category: CategoryId
  device: DeviceType
  aspect: AspectRatio
  status: InsertStatus
  title: LocalizedText
  description: LocalizedText
  prompt: LocalizedText
  shortPrompt: LocalizedText
  negativePrompt: LocalizedText
  technicalNotes: LocalizedList
  /** true for rows stored in the database (user-added), absent for built-ins */
  custom?: boolean
  /** scene (default), site or file — see InsertKind */
  kind?: InsertKind
  /** where a site / file insert gets its content from */
  source?: InsertSource
}

/* a fully resolved insert with all localized text flattened to strings */
export type ResolvedInsert = {
  id: string
  date: string
  episode: string
  scene: string
  category: CategoryId
  device: DeviceType
  aspect: AspectRatio
  status: InsertStatus
  title: string
  description: string
  prompt: string
  shortPrompt: string
  negativePrompt: string
  technicalNotes: string[]
  hasEnglish: boolean
  custom: boolean
  kind: InsertKind
  source: InsertSource
}
