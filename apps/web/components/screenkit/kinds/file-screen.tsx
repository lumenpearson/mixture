"use client"

import { normalizeHttpUrl } from "@/lib/media/url"
import type { ResolvedInsert } from "@/lib/screenkit/types"
import { FileQuestion } from "lucide-react"
import * as React from "react"
import { FilePreview } from "../media/file-preview"
import { useScreenkit } from "../store"
import { useInsertSource } from "./overrides"
import { clampZoom } from "./site-screen"

/** a cloud or linked file rendered as the device screen */
export function FileScreen({ insert }: { insert: ResolvedInsert }) {
  const { t } = useScreenkit()
  const { source } = useInsertSource(insert.id, insert.source)
  const path = source.path?.trim() || undefined
  // the stored url is checked again here: a per-browser override, a restored
  // row or a draft never passed through the write-time gate, and this url
  // becomes an <img>/<video>/<iframe> src and a download href below
  const url = normalizeHttpUrl(source.url) || undefined
  const name = (path ?? url ?? "").split("?")[0].split("/").pop() || insert.title

  if (!path && !url) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black font-mono text-[11px] lowercase text-white/60">
        <FileQuestion className="size-5" />
        {t("kind.file.empty")}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: source.background ?? "#000" }}>
      <FilePreview
        source={{ path, url, name }}
        name={name}
        mode="screen"
        fit={source.fit}
        zoom={clampZoom(source.zoom)}
        autoplay={source.autoplay}
        loop={source.loop}
        muted={source.muted}
        background={source.background ?? "#000"}
      />
    </div>
  )
}
