"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import * as React from "react"
import { CategoryChips, CategoryPanel } from "./category-panel"
import { useLayout } from "./layout"
import { useReveal } from "./motion"
import { AboutSection } from "./sections/about"
import { CloudSection } from "./sections/cloud"
import { LibrarySection } from "./sections/library"
import { NotFoundSection } from "./sections/not-found"
import { OverviewSection } from "./sections/overview"
import { PreviewSection } from "./sections/preview"
import { PromptsSection } from "./sections/prompts"
import { StyleSection } from "./sections/style"
import { TimelineSection } from "./sections/timeline"
import {
  AboutSkeleton,
  CloudSkeleton,
  LibrarySkeleton,
  OverviewSkeleton,
  PreviewSkeleton,
  PromptsSkeleton,
  StyleSkeleton,
  TimelineSkeleton,
} from "./skeletons"
import { useScreenkit, type ContentWidth, type Section } from "./store"

const SECTION_CONTENT: Record<Section, React.ReactNode> = {
  overview: <OverviewSection />,
  library: <LibrarySection />,
  preview: <PreviewSection />,
  timeline: <TimelineSection />,
  prompts: <PromptsSection />,
  style: <StyleSection />,
  cloud: <CloudSection />,
  about: <AboutSection />,
}

const SECTION_SKELETON: Record<Section, React.ReactNode> = {
  overview: <OverviewSkeleton />,
  library: <LibrarySkeleton />,
  preview: <PreviewSkeleton />,
  timeline: <TimelineSkeleton />,
  prompts: <PromptsSkeleton />,
  style: <StyleSkeleton />,
  cloud: <CloudSkeleton />,
  about: <AboutSkeleton />,
}

const CONTENT_WIDTH_CLASS: Record<ContentWidth, string> = {
  narrow: "md:mx-auto md:max-w-4xl",
  default: "md:mx-auto md:max-w-6xl 2xl:max-w-7xl",
  // Keep wide as an animatable max-width value. `max-w-none` snaps because
  // CSS cannot interpolate from a length to `none`.
  wide: "md:mx-auto md:max-w-full 2xl:max-w-full",
}

/** the bottom rail — and therefore this preference — only exists below `md` */
const NARROW_QUERY = "(max-width: 767.98px)"
/** ignore anything smaller than a deliberate flick */
const SCROLL_EPSILON_PX = 4
/** far enough down that the elastic bounce at the top of a section cannot hide the rail */
const HIDE_AFTER_PX = 96
/** bringing the rail back asks for a clearer upward gesture than hiding it */
const SHOW_DELTA_PX = 24
/** matches the `.sk-resize` duration in globals.css */
const SETTLE_MS = 500

/**
 * Below `md`, the "hide the rail while scrolling down" preference (see
 * layout-controls.tsx) drives the same show/hide state as the floating
 * toggle button. Radix's ScrollArea does not forward the viewport ref or an
 * onScroll prop, so this reads the viewport back off the DOM the same way
 * category-panel.tsx measures label widths off its own subtree.
 *
 * Two things it deliberately does not do. It does not run at `md` and up,
 * where the rail is `md:hidden` and flipping the state would only re-render
 * the shell. And it does not react to its own effect: collapsing the rail
 * grows this viewport, the browser answers by clamping `scrollTop`, and that
 * clamp arrives as an upward scroll — which would show the rail again, on
 * every flick at the end of a section. Hence the settle window.
 */
function useAutoHideRailOnScroll(containerRef: React.RefObject<HTMLDivElement | null>) {
  const { autoHideOnScroll, railVisible, setRailVisibleTransient } = useLayout()
  const [narrow, setNarrow] = React.useState(false)
  const railVisibleRef = React.useRef(railVisible)
  const settleUntil = React.useRef(0)

  React.useEffect(() => {
    railVisibleRef.current = railVisible
  }, [railVisible])

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia(NARROW_QUERY)
    setNarrow(mq.matches)
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  React.useEffect(() => {
    if (!autoHideOnScroll || !narrow) return
    const viewport = containerRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    )
    if (!viewport) return

    let lastTop = viewport.scrollTop
    const onScroll = () => {
      const top = viewport.scrollTop
      const delta = top - lastTop
      lastTop = top
      if (Math.abs(delta) < SCROLL_EPSILON_PX) return
      if (performance.now() < settleUntil.current) return

      const visible = railVisibleRef.current
      if (delta > 0 && top > HIDE_AFTER_PX && visible) {
        settleUntil.current = performance.now() + SETTLE_MS
        setRailVisibleTransient(false)
      } else if (delta < -SHOW_DELTA_PX && !visible) {
        settleUntil.current = performance.now() + SETTLE_MS
        setRailVisibleTransient(true)
      }
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", onScroll)
  }, [autoHideOnScroll, narrow, setRailVisibleTransient, containerRef])
}

export function Content({ notFound = false }: { notFound?: boolean }) {
  const { section, contentWidth } = useScreenkit()
  const scrollWrapRef = React.useRef<HTMLDivElement>(null)
  useAutoHideRailOnScroll(scrollWrapRef)

  return (
    <div ref={scrollWrapRef} className="flex h-full min-h-0 min-w-0 overflow-hidden">
      {/* The side category panel needs enough room to share the main area.
          Keep chips on mobile/tablet/pre-desktop so the panel never consumes
          the whole content column around the narrow desktop breakpoint. */}
      {/* `sk-glass-rail` is the hook glass.css uses for the two navigation
          surfaces; it is a marker, not a style. */}
      <CategoryPanel className="sk-glass-rail hidden xl:flex" />

      <ScrollArea className="h-full min-w-0 flex-1 overflow-x-hidden sk-scroll">
        {/* the home-indicator inset is honoured here rather than on the bottom
            rail alone: hiding the rail (toggle or scroll) would otherwise take
            the app's only safe-area padding with it and put the last row of a
            section under the indicator. */}
        <div className="sk-safe-bottom-inset w-full min-w-0 overflow-x-hidden">
          {/* Chips span the whole available main area: from the category-panel
              edge to the right edge, not only the centered content column. */}
          <CategoryChips className="mb-5 border-b border-panel-border/40 bg-background/95 py-3 backdrop-blur sm:mb-6 xl:hidden" />

          <div className="w-full min-w-0 overflow-x-hidden px-[clamp(1rem,3vw,3rem)] py-[clamp(1.25rem,3vw,3.5rem)]">
            <div
              className={cn(
                "sk-resize w-full min-w-0 overflow-x-hidden",
                CONTENT_WIDTH_CLASS[contentWidth],
              )}
            >
              {notFound ? <NotFoundSection /> : <SectionView key={section} section={section} />}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

function SectionView({ section }: { section: Section }) {
  const phase = useReveal()

  if (phase === "skeleton") {
    return (
      <div className="min-w-0 max-w-full overflow-x-hidden">
        {SECTION_SKELETON[section]}
      </div>
    )
  }

  return (
    <div className="sk-section-enter min-w-0 max-w-full overflow-x-hidden">
      {SECTION_CONTENT[section]}
    </div>
  )
}
