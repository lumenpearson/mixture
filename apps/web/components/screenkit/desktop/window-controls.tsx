"use client"

import { cn } from "@/lib/utils"
import { Copy, Minus, Square, X } from "lucide-react"
import { useScreenkit } from "../store"
import type { WindowControls as Controls } from "./use-window"

/* ------------------------------------------------------------------ *
 * minimize / maximize / close
 *
 * Three real buttons, not glyphs in a div: the bar is a drag region, and a
 * drag region swallows everything that is not explicitly `no-drag`, so each
 * control opts out through `data-tauri-drag-region` being absent and the css
 * rule in globals.css. They are ordinary tab stops with an aria-label from
 * the dictionary, because a frameless window has no system controls to fall
 * back to.
 * ------------------------------------------------------------------ */

const BUTTON =
  "inline-flex h-full items-center justify-center px-3 text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"

export function WindowControls({
  controls,
  compact,
  className,
}: {
  controls: Controls
  compact: boolean
  className?: string
}) {
  const { t } = useScreenkit()
  const { maximized, minimize, toggleMaximize, close } = controls
  const icon = compact ? "size-3" : "size-3.5"

  return (
    <div className={cn("flex h-full shrink-0 items-stretch", className)}>
      <button type="button" onClick={minimize} aria-label={t("desktop.titlebar.minimize")} className={BUTTON}>
        <Minus className={icon} />
      </button>
      <button
        type="button"
        onClick={toggleMaximize}
        aria-label={maximized ? t("desktop.titlebar.restore") : t("desktop.titlebar.maximize")}
        aria-pressed={maximized}
        className={BUTTON}
      >
        {maximized ? <Copy className={icon} /> : <Square className={icon} />}
      </button>
      <button
        type="button"
        onClick={close}
        aria-label={t("desktop.titlebar.close")}
        className={cn(BUTTON, "hover:bg-danger hover:text-destructive-foreground")}
      >
        <X className={icon} />
      </button>
    </div>
  )
}
