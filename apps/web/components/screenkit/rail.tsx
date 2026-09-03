"use client"

import { cn } from "@/lib/utils"
import {
  Cloud,
  Eye,
  FileText,
  GitBranch,
  Info,
  Library,
  Palette,
  type LucideIcon,
} from "lucide-react"
import { useScreenkit, type Section } from "./store"
import { usePalette, type ScaleLevel } from "./theme"

type RailItem = { id: Section; icon: LucideIcon }

const RAIL_ITEMS: RailItem[] = [
  { id: "library", icon: Library },
  { id: "preview", icon: Eye },
  { id: "timeline", icon: GitBranch },
  { id: "prompts", icon: FileText },
  { id: "style", icon: Palette },
  { id: "cloud", icon: Cloud },
]

const RAIL_ICON_SIZE: Record<ScaleLevel, string> = {
  compact: "1.38rem",
  normal: "1.48rem",
  large: "1.58rem",
  huge: "1.72rem",
}

function sectionLabel(id: Section, t: (key: string) => string) {
  if (id === "timeline") return t("nav.changelog")
  return t(`section.${id}`)
}

/** shared overview glyph: same look on the vertical desktop rail and the
    horizontal bottom rail. */
function OverviewButton({
  active,
  onClick,
  className,
}: {
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label="overview"
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-[3.35rem] shrink-0 items-center justify-center rounded-xl border font-mono text-sm font-bold transition-colors",
        active
          ? "border-transparent bg-control-active text-control-active-foreground"
          : "border-sidebar-border bg-panel-soft text-foreground hover:bg-panel-hover",
        className,
      )}
    >
      гс
    </button>
  )
}

export function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const { section, setSection, t } = useScreenkit()
  const { scale } = usePalette()
  const iconStyle = {
    width: RAIL_ICON_SIZE[scale],
    height: RAIL_ICON_SIZE[scale],
  }

  const go = (s: Section) => {
    setSection(s)
    onNavigate?.()
  }

  return (
    <nav
      aria-label="primary"
      className="flex h-full w-[108px] shrink-0 flex-col items-center gap-1 bg-sidebar px-3 py-3 md:py-4 md:pl-3 md:pr-6"
    >
      {/* project glyph -> overview */}
      <OverviewButton active={section === "overview"} onClick={() => go("overview")} className="mb-3" />

      <div className="flex flex-1 flex-col items-center gap-1">
        {RAIL_ITEMS.map((item) => {
          const active = section === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex w-[4.5rem] flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-colors",
                active
                  ? "bg-control-active text-control-active-foreground"
                  : "text-sidebar-muted hover:bg-panel-hover hover:text-foreground",
              )}
            >
              <Icon className="shrink-0" strokeWidth={1.7} style={iconStyle} />
              <span className="font-mono text-[10px] lowercase leading-tight">
                {sectionLabel(item.id, t)}
              </span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => go("about")}
        className={cn(
          "flex w-[4.5rem] flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-colors",
          section === "about"
            ? "bg-control-active text-control-active-foreground"
            : "text-sidebar-muted hover:bg-panel-hover hover:text-foreground",
        )}
      >
        <Info className="shrink-0" strokeWidth={1.7} style={iconStyle} />
        <span className="font-mono text-[10px] lowercase leading-tight">
          {t("nav.about")}
        </span>
      </button>
    </nav>
  )
}

/**
 * Bottom rail for narrow screens (below `md`): the same items as `Rail`, laid
 * out horizontally and scrollable if they overflow. The wrapping element in
 * app-shell.tsx owns show/hide (it tucks under the main area the same way
 * the desktop rail tucks under its left edge); this component only renders
 * the row of buttons and reserves its own height via `--sk-bottom-rail-h` so
 * `content.tsx`'s scroll padding always matches.
 */
export function BottomRail() {
  const { section, setSection, t } = useScreenkit()
  const { scale } = usePalette()
  const iconStyle = {
    width: RAIL_ICON_SIZE[scale],
    height: RAIL_ICON_SIZE[scale],
  }

  return (
    <nav aria-label="primary" className="relative min-w-0 bg-sidebar sk-safe-bottom">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-sidebar to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-sidebar to-transparent" />

      <div
        className="sk-chips flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain px-3"
        style={{ height: "var(--sk-bottom-rail-h)" }}
      >
        <OverviewButton
          active={section === "overview"}
          onClick={() => setSection("overview")}
          className="size-11 text-xs"
        />

        {RAIL_ITEMS.map((item) => {
          const active = section === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[3.9rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
                active
                  ? "bg-control-active text-control-active-foreground"
                  : "text-sidebar-muted hover:bg-panel-hover hover:text-foreground",
              )}
            >
              <Icon className="shrink-0" strokeWidth={1.7} style={iconStyle} />
              <span className="font-mono text-[10px] lowercase leading-tight">
                {sectionLabel(item.id, t)}
              </span>
            </button>
          )
        })}

        <button
          onClick={() => setSection("about")}
          aria-current={section === "about" ? "page" : undefined}
          className={cn(
            "flex min-w-[3.9rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
            section === "about"
              ? "bg-control-active text-control-active-foreground"
              : "text-sidebar-muted hover:bg-panel-hover hover:text-foreground",
          )}
        >
          <Info className="shrink-0" strokeWidth={1.7} style={iconStyle} />
          <span className="font-mono text-[10px] lowercase leading-tight">
            {t("nav.about")}
          </span>
        </button>
      </div>
    </nav>
  )
}
