"use client"

import { playerSettingsStore, type PlayerSettings } from "@/lib/media/player-settings"
import * as React from "react"

/**
 * read and change the player / preview settings from any component. no
 * provider is needed: the store is module-level and the server snapshot is
 * the default, so hydration never mismatches.
 */
export function usePlayerSettings() {
  const settings = React.useSyncExternalStore(
    playerSettingsStore.subscribe,
    playerSettingsStore.get,
    playerSettingsStore.getServer,
  )
  const update = React.useCallback((patch: Partial<PlayerSettings>) => playerSettingsStore.update(patch), [])
  const reset = React.useCallback(() => playerSettingsStore.reset(), [])
  return { settings, update, reset }
}
