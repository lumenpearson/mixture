"use client"

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
  const url = source.url?.trim() || undefined
  const name = (path ?? url ?? "").split("?")[0].split("/").pop() || insert.title

  if (!path && !url) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0b0b0c] font-mono text-[11px] lowercase text-white/60">
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
