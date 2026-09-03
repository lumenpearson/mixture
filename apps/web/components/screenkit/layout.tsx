"use client"

import * as React from "react"

/* ------------------------------------------------------------------ *
 * layout: narrow-screen rail placement and visibility
 *
 * Below `md` the icon rail moves to the bottom of the screen. This provider
 * owns which edge the floating hide/show toggle sits on, whether the rail is
 * currently visible, and whether it should hide itself while the user
 * scrolls down. All three are per-device preferences: hydrated from
 * localStorage after mount (SSR renders the defaults below), never in a
 * lazy initialiser, matching the pattern in theme.tsx / motion.tsx.
 * ------------------------------------------------------------------ */

const LAYOUT_KEY = "screenkit-layout-v1"

export type RailSide = "left" | "right"

type StoredLayout = {
  side: RailSide
  railVisible: boolean
  autoHideOnScroll: boolean
}

const DEFAULT_LAYOUT: StoredLayout = {
  side: "left",
  railVisible: true,
  autoHideOnScroll: false,
}

type LayoutCtx = StoredLayout & {
  setSide: (side: RailSide) => void
  showRail: () => void
  hideRail: () => void
  toggleRail: () => void
  setAutoHideOnScroll: (enabled: boolean) => void
}

const LayoutContext = React.createContext<LayoutCtx | null>(null)

function readLayout(): StoredLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY)
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

function writeLayout(value: StoredLayout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [side, setSideState] = React.useState<RailSide>(DEFAULT_LAYOUT.side)
  const [railVisible, setRailVisible] = React.useState(DEFAULT_LAYOUT.railVisible)
  const [autoHideOnScroll, setAutoHideOnScrollState] = React.useState(
    DEFAULT_LAYOUT.autoHideOnScroll,
  )

  React.useEffect(() => {
    const stored = readLayout()
    setSideState(stored.side)
    setRailVisible(stored.railVisible)
    setAutoHideOnScrollState(stored.autoHideOnScroll)
  }, [])

  const setSide = React.useCallback(
    (next: RailSide) => {
      setSideState(next)
      writeLayout({ side: next, railVisible, autoHideOnScroll })
    },
    [railVisible, autoHideOnScroll],
  )

  const showRail = React.useCallback(() => {
    setRailVisible(true)
    writeLayout({ side, railVisible: true, autoHideOnScroll })
  }, [side, autoHideOnScroll])

  const hideRail = React.useCallback(() => {
    setRailVisible(false)
    writeLayout({ side, railVisible: false, autoHideOnScroll })
  }, [side, autoHideOnScroll])

  const toggleRail = React.useCallback(() => {
    const next = !railVisible
    setRailVisible(next)
    writeLayout({ side, railVisible: next, autoHideOnScroll })
  }, [side, railVisible, autoHideOnScroll])

  const setAutoHideOnScroll = React.useCallback(
    (enabled: boolean) => {
      setAutoHideOnScrollState(enabled)
      writeLayout({ side, railVisible, autoHideOnScroll: enabled })
    },
    [side, railVisible],
  )

  const value = React.useMemo<LayoutCtx>(
    () => ({
      side,
      railVisible,
      autoHideOnScroll,
      setSide,
      showRail,
      hideRail,
      toggleRail,
      setAutoHideOnScroll,
    }),
    [side, railVisible, autoHideOnScroll, setSide, showRail, hideRail, toggleRail, setAutoHideOnScroll],
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout() {
  const ctx = React.useContext(LayoutContext)
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider")
  return ctx
}
