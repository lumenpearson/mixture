"use client"

import { cloudClient } from "@/lib/rpc/client"
import type { Entry } from "@mixture/protocol/cloud"
import * as React from "react"

/* ------------------------------------------------------------------ *
 * the recursive cloud listing, shared by the command palette and the
 * wizard's file picker: one GetTree call, cached for a minute, refreshed
 * on demand after an upload.
 * ------------------------------------------------------------------ */

const TREE_TTL_MS = 60_000

let treeCache: { at: number; entries: Entry[] } | null = null
let version = 0
const listeners = new Set<() => void>()

/** forget the cached listing (after a write) so the next reader refetches */
export function invalidateCloudTree() {
  treeCache = null
  version += 1
  listeners.forEach((listener) => listener())
}

export type CloudTreeState = "idle" | "loading" | "unavailable"

export function useCloudTree(open: boolean) {
  const [entries, setEntries] = React.useState<Entry[] | null>(treeCache?.entries ?? null)
  const [state, setState] = React.useState<CloudTreeState>("idle")
  const [tick, setTick] = React.useState(version)

  React.useEffect(() => {
    const listener = () => setTick(version)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  React.useEffect(() => {
    if (!open) return
    if (treeCache && Date.now() - treeCache.at < TREE_TTL_MS) {
      setEntries(treeCache.entries)
      return
    }
    let cancelled = false
    setState("loading")
    cloudClient()
      .getTree({ prefix: "" })
      .then((response) => {
        if (cancelled) return
        treeCache = { at: Date.now(), entries: response.entries }
        setEntries(response.entries)
        setState("idle")
      })
      .catch(() => {
        if (cancelled) return
        setEntries([])
        setState("unavailable")
      })
    return () => {
      cancelled = true
    }
  }, [open, tick])

  return { entries, state, refresh: invalidateCloudTree }
}
