"use client"

import { RAIL_LAYOUT_KEY } from "@/lib/screenkit/appearance"
import type { StorageLike } from "@/lib/screenkit/glass"
import * as React from "react"

/* ------------------------------------------------------------------ *
 * layout: narrow-screen rail placement and visibility
 *
 * Below `md` the icon rail moves to the bottom of the screen. This provider
 * owns which edge the floating hide/show toggle sits on, whether the rail is
 * currently visible, and whether it should hide itself while the user
 * scrolls down. The side and the auto-hide switch are per-device preferences:
 * hydrated from localStorage after mount (SSR renders the defaults below),
 * never in a lazy initialiser, matching the pattern in theme.tsx / motion.tsx.
 *
 * Visibility is two values, not one. `railVisible` is what is on screen right
 * now; the *stored* value only ever changes when the user presses the toggle
 * or swipes the rail back. Scroll-driven hiding (content.tsx) is a reaction to
 * a gesture, not a preference — persisting it would leave the rail gone after
 * a reload with nothing on screen to explain why.
 * ------------------------------------------------------------------ */

export type RailSide = "left" | "right"

export type StoredLayout = {
  side: RailSide
  railVisible: boolean
  autoHideOnScroll: boolean
}

export const DEFAULT_LAYOUT: StoredLayout = {
  side: "left",
  railVisible: true,
  autoHideOnScroll: false,
}

type LayoutCtx = StoredLayout & {
  setSide: (side: RailSide) => void
  /** explicit reveal (toggle button, edge swipe) — persisted */
  showRail: () => void
  /** explicit toggle — persisted */
  toggleRail: () => void
  /** scroll-driven show/hide — live state only, never written to storage */
  setRailVisibleTransient: (visible: boolean) => void
  setAutoHideOnScroll: (enabled: boolean) => void
}

const LayoutContext = React.createContext<LayoutCtx | null>(null)

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readLayout(store: StorageLike | null = browserStorage()): StoredLayout {
  if (!store) return DEFAULT_LAYOUT
  try {
    const raw = store.getItem(RAIL_LAYOUT_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw) as Partial<StoredLayout>
    return {
      side: parsed.side === "right" ? "right" : "left",
      railVisible:
        typeof parsed.railVisible === "boolean"
          ? parsed.railVisible
          : DEFAULT_LAYOUT.railVisible,
      autoHideOnScroll:
        typeof parsed.autoHideOnScroll === "boolean"
          ? parsed.autoHideOnScroll
          : DEFAULT_LAYOUT.autoHideOnScroll,
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function writeLayout(value: StoredLayout, store: StorageLike | null = browserStorage()) {
  if (!store) return
  try {
    store.setItem(RAIL_LAYOUT_KEY, JSON.stringify(value))
  } catch {
    // ignore
  }
}

/**
 * Mirror the live state onto `<html data-rail>`. The pre-hydration script sets
 * the same attribute from storage, which is what keeps a hidden rail from
 * painting and then collapsing (globals.css reads it); keeping it in sync
 * afterwards means the attribute and react never disagree.
 */
function applyRailToDocument(visible: boolean) {
  if (typeof document === "undefined") return
  const el = document.documentElement
  if (visible) el.removeAttribute("data-rail")
  else el.setAttribute("data-rail", "hidden")
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [side, setSideState] = React.useState<RailSide>(DEFAULT_LAYOUT.side)
  const [railVisible, setRailVisibleState] = React.useState(DEFAULT_LAYOUT.railVisible)
  const [autoHideOnScroll, setAutoHideOnScrollState] = React.useState(
    DEFAULT_LAYOUT.autoHideOnScroll,
  )
  /** the value that goes back to storage — see the note at the top of the file */
  const storedRailVisible = React.useRef(DEFAULT_LAYOUT.railVisible)

  React.useEffect(() => {
    const stored = readLayout()
    setSideState(stored.side)
    setRailVisibleState(stored.railVisible)
    setAutoHideOnScrollState(stored.autoHideOnScroll)
    storedRailVisible.current = stored.railVisible
    applyRailToDocument(stored.railVisible)
  }, [])

  const persist = React.useCallback(
    (next: Partial<StoredLayout>) => {
      writeLayout({
        side,
        railVisible: storedRailVisible.current,
        autoHideOnScroll,
        ...next,
      })
    },
    [side, autoHideOnScroll],
  )

  const setSide = React.useCallback(
    (next: RailSide) => {
      setSideState(next)
      persist({ side: next })
    },
    [persist],
  )

  const setRailVisible = React.useCallback(
    (next: boolean) => {
      setRailVisibleState(next)
      applyRailToDocument(next)
      storedRailVisible.current = next
      persist({ railVisible: next })
    },
    [persist],
  )

  const showRail = React.useCallback(() => setRailVisible(true), [setRailVisible])
  const toggleRail = React.useCallback(
    () => setRailVisible(!railVisible),
    [railVisible, setRailVisible],
  )

  // stable identity: content.tsx's scroll listener depends on it and must not
  // be torn down and re-attached on every layout change
  const setRailVisibleTransient = React.useCallback((visible: boolean) => {
    setRailVisibleState(visible)
    applyRailToDocument(visible)
  }, [])

  const setAutoHideOnScroll = React.useCallback(
    (enabled: boolean) => {
      setAutoHideOnScrollState(enabled)
      persist({ autoHideOnScroll: enabled })
      // switching auto-hide off drops whatever the last scroll left behind and
      // returns the rail to the state the user actually chose
      if (!enabled) setRailVisibleTransient(storedRailVisible.current)
    },
    [persist, setRailVisibleTransient],
  )

  const value = React.useMemo<LayoutCtx>(
    () => ({
      side,
      railVisible,
      autoHideOnScroll,
      setSide,
      showRail,
      toggleRail,
      setRailVisibleTransient,
      setAutoHideOnScroll,
    }),
    [
      side,
      railVisible,
      autoHideOnScroll,
      setSide,
      showRail,
      toggleRail,
      setRailVisibleTransient,
      setAutoHideOnScroll,
    ],
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout() {
  const ctx = React.useContext(LayoutContext)
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider")
  return ctx
}
