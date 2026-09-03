"use client"

import { ACCENT_CHOICES, FILE_CATEGORIES, type FileCategory } from "./file-types"
import { createLocalStore, useLocalStore } from "./local-store"
import { DEFAULT_SORT, SORT_KEYS, type SortKey, type SortDirection } from "./sorting"

/* ------------------------------------------------------------------ *
 * cloud manager settings — persisted in localStorage
 *
 * Appearance of the listing only: nothing here changes what the server
 * returns or who may see it. Kept out of ScreenkitProvider on purpose, the
 * cloud tab and the settings panel are the only readers.
 * ------------------------------------------------------------------ */

export const CLOUD_SETTINGS_STORAGE_KEY = "screenkit-cloud-settings-v1"

export type CloudDensity = "comfortable" | "compact"
export type CloudView = "list" | "grid"

export type CloudSettings = {
  /** per-type colours in the listing; icons stay, only the tint goes */
  colors: boolean
  /** category → accent token, partial: anything missing uses the default */
  accents: Partial<Record<FileCategory, string>>
  density: CloudDensity
  view: CloudView
  foldersFirst: boolean
  sortKey: SortKey
  sortDirection: SortDirection
  /** image thumbnails in the grid view */
  thumbnails: boolean
}

export const DEFAULT_CLOUD_SETTINGS: CloudSettings = {
  colors: true,
  accents: {},
  density: "comfortable",
  view: "list",
  foldersFirst: DEFAULT_SORT.foldersFirst,
  sortKey: DEFAULT_SORT.key,
  sortDirection: DEFAULT_SORT.direction,
  thumbnails: true,
}

function reviveSettings(raw: unknown): CloudSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_CLOUD_SETTINGS
  const value = raw as Partial<CloudSettings>
  const accents: Partial<Record<FileCategory, string>> = {}
  if (value.accents && typeof value.accents === "object") {
    for (const category of FILE_CATEGORIES) {
      const accent = (value.accents as Record<string, unknown>)[category]
      // only accept the tokens the picker offers, never an arbitrary colour
      if (typeof accent === "string" && ACCENT_CHOICES.includes(accent as (typeof ACCENT_CHOICES)[number])) {
        accents[category] = accent
      }
    }
  }
  return {
    colors: typeof value.colors === "boolean" ? value.colors : DEFAULT_CLOUD_SETTINGS.colors,
    accents,
    density: value.density === "compact" ? "compact" : "comfortable",
    view: value.view === "grid" ? "grid" : "list",
    foldersFirst: typeof value.foldersFirst === "boolean" ? value.foldersFirst : true,
    sortKey: SORT_KEYS.includes(value.sortKey as SortKey) ? (value.sortKey as SortKey) : "name",
    sortDirection: value.sortDirection === "desc" ? "desc" : "asc",
    thumbnails: typeof value.thumbnails === "boolean" ? value.thumbnails : true,
  }
}

export const cloudSettingsStore = createLocalStore<CloudSettings>(
  CLOUD_SETTINGS_STORAGE_KEY,
  DEFAULT_CLOUD_SETTINGS,
  reviveSettings,
)

export function useCloudSettings(): [CloudSettings, (patch: Partial<CloudSettings>) => void, () => void] {
  const settings = useLocalStore(cloudSettingsStore)
  const update = (patch: Partial<CloudSettings>) =>
    cloudSettingsStore.set((current) => ({ ...current, ...patch }))
  const reset = () => cloudSettingsStore.set({ ...DEFAULT_CLOUD_SETTINGS, accents: {} })
  return [settings, update, reset]
}
