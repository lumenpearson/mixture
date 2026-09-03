"use client"

import type { Entry } from "@mixture/protocol/cloud"
import { Download, X } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { FilePreview } from "../media/file-preview"
import { useScreenkit } from "../store"
import type { CloudProvider } from "./provider"

/* ------------------------------------------------------------------ *
 * preview panel
 *
 * Deliberately narrow: `{ entry, provider, onClose }` and nothing else. The
 * body is the shared FilePreview (images with zoom, the media player, pdf,
 * decoded text), fed by the provider so a local folder previews exactly
 * like the GitHub repository. A direct stream url, when the provider has
 * one, lets video seek without downloading the whole file first.
 * ------------------------------------------------------------------ */

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
  const [streamUrl, setStreamUrl] = React.useState<string | null | undefined>(undefined)

  React.useEffect(() => {
    let cancelled = false
    setStreamUrl(undefined)
    if (!provider.streamUrl) {
      setStreamUrl(null)
      return
    }
    provider
      .streamUrl(entry)
      .then((url) => {
        if (!cancelled) setStreamUrl(url)
      })
      .catch(() => {
        if (!cancelled) setStreamUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [entry, provider])

  const reader = React.useCallback(
    async (path: string) => {
      const result = await provider.read(path)
      return {
        content: result.content,
        contentType: result.entry?.contentType || entry.contentType,
        name: result.entry?.name || entry.name,
        truncated: result.truncated,
        downloadUrl: result.entry?.downloadUrl || entry.downloadUrl || undefined,
      }
    },
    [provider, entry.contentType, entry.name, entry.downloadUrl],
  )

  const source = React.useMemo(
    () => ({
      path: entry.path,
      sha: entry.sha,
      name: entry.name,
      contentType: entry.contentType,
      url: streamUrl ?? undefined,
      reader,
      scope: provider.id,
    }),
    [entry.path, entry.sha, entry.name, entry.contentType, streamUrl, reader, provider.id],
  )

  const download = async () => {
    try {
      const result = await provider.read(entry.path)
      if (result.truncated) {
        const url = (await provider.streamUrl?.(entry)) ?? entry.downloadUrl
        if (url) window.open(url, "_blank", "noopener")
        else toast.error(t("cloud.largeFile"))
        return
      }
      const url = URL.createObjectURL(new Blob([result.content as BlobPart], { type: entry.contentType }))
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = entry.name
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("cloud.noPreview"))
    }
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
          <PanelButton label={t("cloud.download")} onClick={() => void download()}>
            <Download className="size-3.5" aria-hidden="true" />
          </PanelButton>
          <PanelButton label={t("common.close")} onClick={onClose}>
            <X className="size-3.5" aria-hidden="true" />
          </PanelButton>
        </div>
      </header>

      {streamUrl === undefined ? null : (
        <FilePreview
          key={`${provider.id}:${entry.path}:${entry.sha}`}
          source={source}
          name={entry.name}
          contentType={entry.contentType}
          size={Number(entry.size)}
          mode="panel"
        />
      )}
    </section>
  )
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
