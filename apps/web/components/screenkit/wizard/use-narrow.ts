"use client"

import * as React from "react"

const QUERY = "(max-width: 639px)"

const subscribe = (listener: () => void) => {
  if (typeof window === "undefined") return () => undefined
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", listener)
  return () => media.removeEventListener("change", listener)
}

/** true below the sm breakpoint; false during server rendering */
export function useNarrow(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
