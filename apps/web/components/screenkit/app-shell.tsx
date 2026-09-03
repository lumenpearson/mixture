"use client"

import { cn } from "@/lib/utils"
import type { CategoryDef, Insert } from "@/lib/screenkit/types"
import { ChevronDown } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { Content } from "./content"
import { CommandPalette } from "./command-palette"
import { ContextMenuGuard } from "./context-menu/guard"
import { DesktopTitlebar } from "./desktop/titlebar"
import { Hotkeys } from "./hotkeys"
import { OfflineScreen } from "./offline-screen"
import { LayoutProvider, useLayout } from "./layout"
import { BottomRail, Rail } from "./rail"
import { ScreenkitProvider, useScreenkit } from "./store"

const LOCALE_FLOW_CSS = `
@keyframes sk-locale-text-flow {
  0% { opacity: .45; filter: blur(2px); transform: translate3d(0, .32em, 0); }
  55% { opacity: .9; filter: blur(.35px); }
  100% { opacity: 1; filter: blur(0); transform: translate3d(0, 0, 0); }
}
html[data-locale-flow="on"][data-motion="full"] :where(h1,h2,h3,h4,p,span,button,label,a,li,dt,dd,th,td,small) {
  animation: sk-locale-text-flow .44s cubic-bezier(.16, 1, .3, 1) both;
}
`

/**
 * Round toggle for the bottom rail (below `md`). Sits just above the rail on
 * the user's chosen edge; while the rail is hidden the button hugs the
 * bottom edge instead and its chevron flips, so it is always reachable.
 * The vertical shift is a transform (not `bottom`) so it rides the same
 * `sk-resize` transition as the rail's own collapse and main's rounding.
 */
function RailToggleButton() {
  const { side, railVisible, toggleRail } = useLayout()
  const { t } = useScreenkit()

  return (
    <button
      type="button"
      onClick={toggleRail}
      aria-label={railVisible ? t("layout.hideRail") : t("layout.showRail")}
      aria-pressed={!railVisible}
      className={cn(
        "sk-resize fixed z-30 flex size-11 items-center justify-center rounded-full border border-transparent bg-control-active/90 text-control-active-foreground shadow-lg backdrop-blur-md md:hidden",
        side === "right" ? "right-4" : "left-4",
      )}
      style={{
        bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + 0.5rem)",
        transform: railVisible
          ? "translateY(calc(-1 * (var(--sk-bottom-rail-h) + 0.5rem)))"
          : "translateY(0)",
      }}
    >
      <ChevronDown className={cn("size-4 transition-transform", !railVisible && "rotate-180")} />
    </button>
  )
}

/** how close to the bottom edge a touch has to start to count as the gesture */
const SWIPE_EDGE_PX = 24
/** and how far up it has to travel before the rail comes back */
const SWIPE_DISTANCE_PX = 28

/**
 * Swipe up from the bottom edge to bring the rail back, without hunting for
 * the toggle button. The listeners are passive and live on the document: an
 * invisible `fixed` strip would sit above `main` and swallow every tap in the
 * bottom band of the screen — the last row of the library grid, the last cloud
 * entry — while looking like nothing was there.
 *
 * The first time the rail goes away on a touch device the gesture announces
 * itself once (`layout.swipeHint`); an invisible affordance nobody is told
 * about is not an affordance.
 */
function SwipeReveal() {
  const { railVisible, showRail } = useLayout()
  const { t } = useScreenkit()
  const hinted = React.useRef(false)

  React.useEffect(() => {
    if (railVisible) return

    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false
    if (coarse && !hinted.current) {
      hinted.current = true
      toast(t("layout.swipeHint"))
    }

    let startY: number | null = null
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      startY =
        touch && touch.clientY > window.innerHeight - SWIPE_EDGE_PX ? touch.clientY : null
    }
    const onMove = (event: TouchEvent) => {
      if (startY == null) return
      const y = event.touches[0]?.clientY ?? startY
      if (startY - y > SWIPE_DISTANCE_PX) {
        startY = null
        showRail()
      }
    }
    const onEnd = () => {
      startY = null
    }

    document.addEventListener("touchstart", onStart, { passive: true })
    document.addEventListener("touchmove", onMove, { passive: true })
    document.addEventListener("touchend", onEnd, { passive: true })
    document.addEventListener("touchcancel", onEnd, { passive: true })
    return () => {
      document.removeEventListener("touchstart", onStart)
      document.removeEventListener("touchmove", onMove)
      document.removeEventListener("touchend", onEnd)
      document.removeEventListener("touchcancel", onEnd)
    }
  }, [railVisible, showRail, t])

  return null
}

function LocaleFlowEffect() {
  const { locale } = useScreenkit()
  const previous = React.useRef(locale)

  React.useEffect(() => {
    if (previous.current === locale) return
    previous.current = locale

    const root = document.documentElement
    const canAnimate =
      root.dataset.motion === "full" && root.dataset.motionSections !== "off"

    if (!canAnimate) return

    root.setAttribute("data-locale-flow", "on")
    const id = window.setTimeout(() => {
      root.removeAttribute("data-locale-flow")
    }, 520)

    return () => window.clearTimeout(id)
  }, [locale])

  return null
}

function ShellInner({ notFound = false }: { notFound?: boolean }) {
  const { railVisible } = useLayout()

  return (
    <>
      <style>{LOCALE_FLOW_CSS}</style>
      <div className="flex h-[100dvh] flex-col bg-sidebar text-foreground">
        <LocaleFlowEffect />
        <Hotkeys />
        <OfflineScreen />
        <CommandPalette />
        <ContextMenuGuard />

        {/* the desktop shell's own title bar. It renders nothing outside
            Tauri; inside it, being a flex sibling above the row below is what
            makes the shell start under the bar without any offsets. */}
        <DesktopTitlebar />

        <div className="flex min-h-0 flex-1 flex-col bg-sidebar md:flex-row">
          {/* desktop icon rail — sits behind the main area; the rounded left
              corners of main reveal the rail color so it appears to tuck under */}
          <div className="hidden md:block">
            <Rail />
          </div>

          {/* main area. desktop: only the left edge is rounded and pulled over
              the rail. below md: only the bottom edge is rounded and pulled
              over the bottom rail — same trick, other axis — unless the rail
              is hidden, in which case main simply fills the screen. */}
          <main
            className={cn(
              "relative z-10 min-w-0 flex-1 overflow-hidden bg-background sk-resize",
              "md:-ml-3 md:mb-0 md:rounded-b-none md:rounded-l-[1.5rem]",
              railVisible ? "-mb-3 rounded-b-[1.5rem]" : "mb-0 rounded-b-none",
            )}
          >
            <Content notFound={notFound} />
          </main>

          {/* bottom rail (below md) — a real flex sibling, not an overlay, so
              main's available height already excludes it; collapsing its
              max-height to 0 hides it and lets main grow to fill the screen.
              `inert` while collapsed: neither `overflow: hidden` nor
              `max-height: 0` takes the eight buttons out of the tab order or
              the accessibility tree, so without it tabbing past the content
              walks through a nav that is not on screen. */}
          <div
            inert={!railVisible}
            className={cn(
              "sk-resize overflow-hidden md:hidden",
              railVisible ? "sk-bottom-rail-collapse" : "max-h-0",
            )}
          >
            <BottomRail />
          </div>
        </div>

        <RailToggleButton />
        <SwipeReveal />
      </div>
    </>
  )
}

export function AppShell({
  initialInserts,
  initialCategories,
  initialPersistent,
  initialEditLocked,
  initialSelectedId,
  initialView,
  initialCategory,
  notFound,
}: {
  initialInserts?: Insert[]
  initialCategories?: CategoryDef[]
  initialPersistent?: boolean
  initialEditLocked?: boolean
  initialSelectedId?: string
  initialView?: string
  initialCategory?: string
  notFound?: boolean
}) {
  return (
    <ScreenkitProvider
      initialInserts={initialInserts}
      initialCategories={initialCategories}
      initialPersistent={initialPersistent}
      initialEditLocked={initialEditLocked}
      initialSelectedId={initialSelectedId}
      initialView={initialView}
      initialCategory={initialCategory}
    >
      <LayoutProvider>
        <ShellInner notFound={notFound} />
      </LayoutProvider>
    </ScreenkitProvider>
  )
}
