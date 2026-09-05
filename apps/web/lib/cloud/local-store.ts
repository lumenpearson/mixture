"use client"

import * as React from "react"

/* ------------------------------------------------------------------ *
 * a tiny localStorage-backed store shared by several components
 *
 * The cloud settings and the local favourites are read from two places each
 * (the manager and the settings panel) and must stay in step without a
 * provider, since the settings panel is mounted by another feature's tab.
 *
 * The store starts at its defaults and only reads localStorage after mount:
 * the first client render must match the server render, so hydration happens
 * in an effect rather than inside the snapshot.
 * ------------------------------------------------------------------ */

export type LocalStore<T> = {
  get: () => T
  set: (next: T | ((current: T) => T)) => void
  subscribe: (listener: () => void) => () => void
  hydrate: () => void
}

export function createLocalStore<T>(key: string, fallback: T, revive: (raw: unknown) => T): LocalStore<T> {
  let value = fallback
  let hydrated = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())

  const read = (): T => {
    if (typeof window === "undefined") return fallback
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? revive(JSON.parse(raw)) : fallback
    } catch {
      return fallback
    }
  }

  const write = (next: T) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // private mode or a full quota: the session keeps working in memory
    }
  }

  return {
    get: () => value,
    set: (next) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(value) : next
      if (Object.is(resolved, value)) return
      value = resolved
      write(value)
      emit()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    hydrate: () => {
      if (hydrated) return
      hydrated = true
      const stored = read()
      value = stored
      emit()
    },
  }
}

/** subscribe a component to a store, hydrating it from localStorage on mount */
export function useLocalStore<T>(store: LocalStore<T>): T {
  const value = React.useSyncExternalStore(store.subscribe, store.get, () => store.get())
  React.useEffect(() => {
    store.hydrate()
  }, [store])
  return value
}
