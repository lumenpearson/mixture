"use client"

import { cn } from "@/lib/utils"
import * as React from "react"
import { useScreenkit, type Section } from "../store"
import { titlebarHeight } from "./desktop-settings"
import { useDesktopChrome, useDesktopSettings, useIsTauri, useWindowControls } from "./use-window"
import { WindowControls } from "./window-controls"

/* ------------------------------------------------------------------ *
 * the desktop title bar
 *
 * The Tauri window is frameless, so this strip is the window's title bar:
 * a drag region carrying the app name, the current section, an optional
 * clock and our own minimize / maximize / close buttons. It is a flex child
 * of the shell's 100dvh column, above the row that holds the rail and the
 * content — no fixed positioning, no offsets: the row's `flex-1` already
 * subtracts the bar's height.
 *
 * Outside Tauri the component renders nothing and the chrome effects do
 * nothing, so the web build is untouched apart from one null render.
 * ------------------------------------------------------------------ */

/** mirrors `sectionLabel` in rail.tsx: the changelog keeps its own noun */
function sectionLabel(id: Section, t: (key: string) => string) {
  return id === "timeline" ? t("nav.changelog") : t(`section.${id}`)
}

/** hh:mm, padded by hand — no locale formatting to disagree with the shell */
function clockText(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function Clock({ compact }: { compact: boolean }) {
  const [time, setTime] = React.useState("")

  // minute precision: a tick every 15 s lands within a quarter minute of the
  // change without waking the renderer once a second
  React.useEffect(() => {
    const tick = () => setTime(clockText(new Date()))
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [])

  if (!time) return null

  return (
    <span
      data-tauri-drag-region
      className={cn(
        "shrink-0 px-2 font-mono tabular-nums text-text-secondary",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      {time}
    </span>
  )
}

export function DesktopTitlebar() {
  const tauri = useIsTauri()
  const { settings } = useDesktopSettings()
  const { section, t } = useScreenkit()
  const controls = useWindowControls(tauri && settings.bar)

  useDesktopChrome(tauri, settings)

  if (!tauri || !settings.bar) return null

  const height = titlebarHeight(settings)
  const buttons = <WindowControls controls={controls} compact={settings.compact} />

  return (
    <header
      data-tauri-drag-region
      data-sk-surface="titlebar"
      aria-label={t("desktop.titlebar.label")}
      onPointerDown={controls.notePointerDown}
      onDoubleClick={controls.toggleMaximizeOnDoubleClick}
      style={{ height }}
      className="sk-fly-from-top relative z-20 flex shrink-0 select-none items-stretch border-b border-panel-border bg-panel-soft"
    >
      {settings.controlsSide === "left" ? buttons : null}

      <div
        data-tauri-drag-region
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 px-3 font-mono lowercase",
          settings.compact ? "text-[11px]" : "text-xs",
        )}
      >
        <span data-tauri-drag-region className="shrink-0 truncate font-bold text-foreground">
          {t("desktop.titlebar.brand")}
        </span>
        {settings.sectionTitle ? (
          <>
            <span data-tauri-drag-region aria-hidden="true" className="shrink-0 text-text-faint">
              /
            </span>
            <span data-tauri-drag-region className="min-w-0 truncate text-text-secondary">
              {sectionLabel(section, t)}
            </span>
          </>
        ) : null}
      </div>

      {settings.clock ? <Clock compact={settings.compact} /> : null}

      {settings.controlsSide === "right" ? buttons : null}

      {settings.accentLine ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-accent-blue via-accent-cyan to-accent-purple"
        />
      ) : null}
    </header>
  )
}
