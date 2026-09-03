"use client"

import * as React from "react"
import { createLocalStore, useLocalStore } from "./local-store"

/* ------------------------------------------------------------------ *
 * cloud favourites — a local bookmark list of repository paths
 *
 * Browser-only on purpose: a favourite is a personal shortcut, not a
 * permission, and writing it into cloud.config.json would put a per-person
 * preference into a file the whole crew shares.
 * ------------------------------------------------------------------ */

export const CLOUD_FAVORITES_STORAGE_KEY = "screenkit-cloud-favorites-v1"

const MAX_FAVORITES = 500

function revive(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, MAX_FAVORITES)
}

export const cloudFavoritesStore = createLocalStore<string[]>(CLOUD_FAVORITES_STORAGE_KEY, [], revive)

export function useCloudFavorites() {
  const paths = useLocalStore(cloudFavoritesStore)
  const set = React.useMemo(() => new Set(paths), [paths])
  const toggle = React.useCallback((path: string) => {
    cloudFavoritesStore.set((current) =>
      current.includes(path) ? current.filter((value) => value !== path) : [...current, path].slice(-MAX_FAVORITES),
    )
  }, [])
  const rename = React.useCallback((from: string, to: string) => {
    cloudFavoritesStore.set((current) =>
      current.map((value) => (value === from ? to : value.startsWith(`${from}/`) ? `${to}${value.slice(from.length)}` : value)),
    )
  }, [])
  const forget = React.useCallback((path: string) => {
    cloudFavoritesStore.set((current) =>
      current.filter((value) => value !== path && !value.startsWith(`${path}/`)),
    )
  }, [])
  // one stable object: the manager memoises its action table on it, and a new
  // identity every render would re-render every row in the listing
  return React.useMemo(() => ({ paths, set, toggle, rename, forget }), [paths, set, toggle, rename, forget])
}
