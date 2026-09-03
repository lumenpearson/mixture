"use client"

import { cn } from "@/lib/utils"
import type { Entry } from "@mixture/protocol/cloud"
import { Download, Loader2, X } from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"
import type { CloudProvider } from "./provider"

/* ------------------------------------------------------------------ *
 * preview panel
 *
 * Deliberately narrow: `{ entry, provider, onClose }` and nothing else, so a
 * full player can replace the body of this file without touching the
 * manager. It fetches the bytes itself, keeps exactly one object url alive
 * and revokes it when the entry changes or the panel unmounts.
 * ------------------------------------------------------------------ */

const TEXT_PREVIEW_LIMIT = 20_000

type PreviewState =
  | { kind: "loading" }
  | { kind: "text"; text: string }
  | { kind: "media"; url: string }
  | { kind: "truncated" }
  | { kind: "error"; message: string }

const isTextual = (contentType: string) =>
  contentType.startsWith("text/") || contentType === "application/json" || contentType === "image/svg+xml"

export function PreviewPanel({
  entry,
  provider,
  onClose,
}: {
  entry: Entry
  provider: CloudProvider
  onClose: () => void
}) {
  const { t } = useScreenkit()
  const [state, setState] = React.useState<PreviewState>({ kind: "loading" })

  React.useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    const controller = new AbortController()
    setState({ kind: "loading" })

    provider
      .read(entry.path, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return
        if (result.truncated) {
          setState({ kind: "truncated" })
          return
        }
        if (isTextual(entry.contentType)) {
          setState({ kind: "text", text: new TextDecoder().decode(result.content).slice(0, TEXT_PREVIEW_LIMIT) })
          return
        }
        objectUrl = URL.createObjectURL(new Blob([result.content as BlobPart], { type: entry.contentType }))
        setState({ kind: "media", url: objectUrl })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({ kind: "error", message: error instanceof Error ? error.message : t("cloud.noPreview") })
      })

    return () => {
      cancelled = true
      controller.abort()
      // the panel owns exactly one object url at a time
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [entry, provider, t])

  const download = () => {
    if (state.kind === "media") {
      const anchor = document.createElement("a")
      anchor.href = state.url
      anchor.download = entry.name
      anchor.click()
      return
    }
    if (entry.downloadUrl) window.open(entry.downloadUrl, "_blank", "noopener")
  }

  return (
    <section
      aria-label={t("cloud.preview")}
      className="flex min-w-0 flex-col gap-3 rounded-3xl border border-panel-border bg-panel-soft p-4"
    >
      <header className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-sm text-foreground" translate="no">
          {entry.path}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <PanelButton label={t("cloud.download")} onClick={download}>
            <Download className="size-3.5" aria-hidden="true" />
          </PanelButton>
          <PanelButton label={t("common.close")} onClick={onClose}>
            <X className="size-3.5" aria-hidden="true" />
          </PanelButton>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-panel-border bg-black">
        <PreviewBody entry={entry} state={state} />
      </div>
    </section>
  )
}

function PreviewBody({ entry, state }: { entry: Entry; state: PreviewState }) {
  const { t } = useScreenkit()
  const note = (text: string, danger?: boolean) => (
    <p className={cn("p-4 font-mono text-[12px] lowercase", danger ? "text-accent-red" : "text-text-muted")}>{text}</p>
  )

  if (state.kind === "loading") {
    return (
      <p className="flex items-center gap-2 p-4 font-mono text-[12px] lowercase text-text-muted" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> {t("cloud.loading")}
      </p>
    )
  }
  if (state.kind === "truncated") return note(t("cloud.largeFile"))
  if (state.kind === "error") return note(state.message, true)
  if (state.kind === "text") {
    return (
      <pre className="sk-scroll max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-relaxed text-text-secondary">
        {state.text}
      </pre>
    )
  }

  const type = entry.contentType
  if (type.startsWith("image/")) {
    return <img src={state.url} alt={entry.name} className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
  }
  if (type.startsWith("video/")) {
    return <video src={state.url} controls playsInline className="mx-auto max-h-[70vh] w-full" />
  }
  if (type.startsWith("audio/")) return <audio src={state.url} controls className="w-full p-4" />
  if (type === "application/pdf") {
    return <iframe src={state.url} title={entry.name} className="h-[70vh] w-full" />
  }
  return note(t("cloud.noPreview"))
}

function PanelButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-lg text-text-faint transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}
