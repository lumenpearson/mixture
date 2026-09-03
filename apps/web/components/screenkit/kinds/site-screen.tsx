"use client"

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
  const url = normalizeUrl(source.url)

  if (!url) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0b0b0c] font-mono text-[11px] lowercase text-white/60">
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
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
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

export function clampZoom(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return 1
  return Math.min(3, Math.max(0.25, value))
}

/** accept bare hosts ("example.com") and refuse anything but http(s) */
export function normalizeUrl(value: string | undefined): string {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(withScheme)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return ""
    return parsed.toString()
  } catch {
    return ""
  }
}
