"use client"

import { normalizeHttpUrl } from "@/lib/media/url"
import { MAX_SOURCE_ZOOM, MIN_SOURCE_ZOOM } from "@/lib/screenkit/insert-kinds"
import type { ResolvedInsert } from "@/lib/screenkit/types"
import { Globe } from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"
import { useInsertSource } from "./overrides"

/**
 * a live website inside the device screen. the frame is sandboxed (scripts
 * and same-origin are needed for most pages to render, top-navigation is
 * not), zoom scales the page around its top-left corner and `scroll`
 * decides whether the frame takes pointer input at all.
 */
export function SiteScreen({ insert }: { insert: ResolvedInsert }) {
  const { t } = useScreenkit()
  const { source } = useInsertSource(insert.id, insert.source)
  const zoom = clampZoom(source.zoom)
  const url = normalizeHttpUrl(source.url)

  if (!url) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black font-mono text-[11px] lowercase text-white/60">
        <Globe className="size-5" />
        {t("kind.site.empty")}
      </div>
    )
  }

  const inverse = 100 / zoom
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: source.background ?? "#000" }}>
      <iframe
        key={url}
        src={url}
        title={insert.title}
        /* `allow-same-origin` keeps the framed site on its own origin, which
           a real page needs. `checkSourceUrl` refuses this app's own origin,
           so it can never mean "same origin as the shell" — a frame that did
           would share a document with the localStorage holding the edit and
           github tokens. popups and presentation are not needed to render a
           page inside a prop device frame. */
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        loading="lazy"
        scrolling={source.scroll ? "auto" : "no"}
        className="absolute left-0 top-0 border-0 bg-white"
        style={{
          width: `${inverse}%`,
          height: `${inverse}%`,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
          pointerEvents: source.scroll ? "auto" : "none",
        }}
      />
    </div>
  )
}

/** the validator's range, applied to whatever a row actually carries */
export function clampZoom(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return 1
  return Math.min(MAX_SOURCE_ZOOM, Math.max(MIN_SOURCE_ZOOM, value))
}
