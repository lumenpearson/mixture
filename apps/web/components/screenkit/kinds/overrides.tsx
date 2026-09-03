"use client"

import type { InsertSource } from "@/lib/screenkit/types"
import * as React from "react"

/* ------------------------------------------------------------------ *
 * per-insert source overrides
 *
 * A site or file insert carries its source in the library (url, path,
 * zoom, fit, playback flags). The preview section lets the operator tweak
 * those for this browser without editing the insert: the overrides live in
 * localStorage under screenkit-kind-overrides-v1, keyed by insert id, and
 * are merged over the stored source when the screen renders.
 * ------------------------------------------------------------------ */

export const KIND_OVERRIDES_KEY = "screenkit-kind-overrides-v1"

type Overrides = Record<string, Partial<InsertSource>>

let state: Overrides = {}
let loaded = false
const listeners = new Set<() => void>()
const EMPTY: Partial<InsertSource> = {}

function load(): Overrides {
  if (loaded) return state
  loaded = true
  if (typeof window === "undefined") return state
  try {
    const raw = window.localStorage.getItem(KIND_OVERRIDES_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === "object") state = parsed as Overrides
  } catch {
    state = {}
  }
  return state
}

function persist() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KIND_OVERRIDES_KEY, JSON.stringify(state))
  } catch {
    // ignore: quota or private mode
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

export const kindOverridesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  get: () => load(),
  getServer: (): Overrides => ({}),
  set(id: string, patch: Partial<InsertSource>) {
    const current = load()
    state = { ...current, [id]: { ...(current[id] ?? {}), ...patch } }
    persist()
    emit()
  },
  clear(id: string) {
    const current = load()
    if (!(id in current)) return
    const next = { ...current }
    delete next[id]
    state = next
    persist()
    emit()
  },
}

/** the stored source merged with this browser's overrides for one insert */
export function useInsertSource(id: string, stored: InsertSource) {
  const all = React.useSyncExternalStore(kindOverridesStore.subscribe, kindOverridesStore.get, kindOverridesStore.getServer)
  const overrides = all[id] ?? EMPTY
  const source = React.useMemo<InsertSource>(() => ({ ...stored, ...overrides }), [stored, overrides])
  const set = React.useCallback((patch: Partial<InsertSource>) => kindOverridesStore.set(id, patch), [id])
  const clear = React.useCallback(() => kindOverridesStore.clear(id), [id])
  return { source, overrides, hasOverrides: overrides !== EMPTY && Object.keys(overrides).length > 0, set, clear }
}
