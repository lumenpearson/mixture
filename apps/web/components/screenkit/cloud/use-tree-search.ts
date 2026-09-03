"use client"

import { rpcErrorMessage } from "@/lib/rpc/client"
import type { Entry } from "@mixture/protocol/cloud"
import * as React from "react"
import type { CloudProvider } from "./provider"

/* ------------------------------------------------------------------ *
 * "search everywhere" — one recursive listing, cached for the session
 *
 * GetTree walks the whole branch, which is one expensive call. It is taken
 * at most once a minute per source and kept in memory for the page session,
 * so typing in the search box filters an array instead of hammering GitHub.
 * The request is abortable: leaving the mode or the tab cancels it.
 * ------------------------------------------------------------------ */

const TTL_MS = 60_000

type CacheEntry = { at: number; entries: Entry[]; truncated: boolean }

const cache = new Map<string, CacheEntry>()

export function invalidateTreeCache(providerId?: string) {
  if (providerId) cache.delete(providerId)
  else cache.clear()
}

export type TreeSearchState = {
  loading: boolean
  entries: readonly Entry[]
  truncated: boolean
  error: string | null
}

const IDLE: TreeSearchState = { loading: false, entries: [], truncated: false, error: null }

/**
 * @param generation bumped whenever the credentials change. The cached tree
 *   was walked as whoever was signed in at the time — for an owner it lists
 *   hidden entries — so both the cache and the state held here are dropped
 *   when it moves, or clearing the token would leave that listing on screen
 *   for the rest of the ttl.
 */
export function useTreeSearch(provider: CloudProvider, enabled: boolean, generation = 0): TreeSearchState {
  const [state, setState] = React.useState<TreeSearchState>(IDLE)
  const seen = React.useRef(generation)

  React.useEffect(() => {
    if (seen.current !== generation) {
      seen.current = generation
      invalidateTreeCache()
    }
    if (!enabled || !provider.capabilities.tree) {
      setState(IDLE)
      return
    }
    const cached = cache.get(provider.id)
    if (cached && Date.now() - cached.at < TTL_MS) {
      setState({ loading: false, entries: cached.entries, truncated: cached.truncated, error: null })
      return
    }
    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true, error: null }))
    provider
      .tree("", { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        cache.set(provider.id, { at: Date.now(), entries: result.entries, truncated: result.truncated })
        setState({ loading: false, entries: result.entries, truncated: result.truncated, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ loading: false, entries: [], truncated: false, error: rpcErrorMessage(error) })
      })
    return () => controller.abort()
  }, [provider, enabled, generation])

  return state
}

/** a value that only catches up after the user stops typing */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}
