"use client"

import { formatBytes } from "@/lib/cloud/paths"
import {
  summarize,
  type ConflictResolution,
  type UploadItem,
  type UploadStatus,
} from "@/lib/cloud/upload-queue"
import { cn } from "@/lib/utils"
import { AlertTriangle, Check, CloudUpload, Loader2, RotateCcw, X } from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"
import { toolbarButtonCls } from "./toolbar"

/* ------------------------------------------------------------------ *
 * the upload queue, visible while anything is in flight
 *
 * Every file gets a line: where it is going, how far it got, and — when it
 * failed — why, with a retry that does not need the file picked again. Files
 * that would overwrite something wait on an answer instead of silently
 * replacing what is already in the repository.
 * ------------------------------------------------------------------ */

const STATUS_KEY: Record<UploadStatus, string> = {
  pending: "cloudfm.upload.statusPending",
  uploading: "cloudfm.upload.statusUploading",
  done: "cloudfm.upload.statusDone",
  error: "cloudfm.upload.statusError",
  skipped: "cloudfm.upload.statusSkipped",
  cancelled: "cloudfm.upload.statusCancelled",
  conflict: "cloudfm.upload.statusConflict",
}

export function UploadPanel({
  items,
  canUploadDirectly,
  onResolve,
  onResolveAll,
  onRetry,
  onCancel,
  onClear,
}: {
  items: readonly UploadItem[]
  canUploadDirectly: boolean
  onResolve: (id: string, resolution: ConflictResolution) => void
  onResolveAll: (resolution: ConflictResolution) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
  onClear: () => void
}) {
  const { t } = useScreenkit()
  const summary = React.useMemo(() => summarize(items), [items])
  if (!items.length) return null

  return (
    <section
      aria-label={t("cloudfm.upload.queue")}
      className="flex min-w-0 flex-col gap-3 rounded-3xl border border-panel-border bg-panel-soft p-4"
    >
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 font-mono text-sm lowercase text-foreground">
          <CloudUpload className="size-4 shrink-0 text-text-faint" aria-hidden="true" />
          <span className="truncate">{t("cloudfm.upload.queue")}</span>
          <span className="rounded-full bg-control px-2 py-0.5 text-[10px] tabular-nums text-text-secondary">
            {summary.done}/{summary.total}
          </span>
          {summary.failed ? (
            <span className="rounded-full bg-control px-2 py-0.5 text-[10px] tabular-nums text-accent-red">
              {summary.failed}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {summary.conflicts > 1 ? (
            <>
              <button type="button" className={toolbarButtonCls} onClick={() => onResolveAll("overwrite")}>
                {t("cloudfm.upload.overwriteAll")}
              </button>
              <button type="button" className={toolbarButtonCls} onClick={() => onResolveAll("skip")}>
                {t("cloudfm.upload.skipAll")}
              </button>
            </>
          ) : null}
          <button type="button" className={toolbarButtonCls} onClick={onClear}>
            <X className="size-3.5" aria-hidden="true" /> {t("cloudfm.upload.clear")}
          </button>
        </div>
      </header>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(summary.progress * 100)}
        aria-label={t("cloudfm.upload.queue")}
        className="h-1 w-full overflow-hidden rounded-full bg-control"
      >
        <div
          className="h-full w-full origin-left rounded-full bg-accent-green motion-safe:transition-transform motion-safe:duration-200"
          style={{ transform: `scaleX(${summary.progress})` }}
        />
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-text-muted">
        {canUploadDirectly ? t("cloudfm.upload.capNoteToken") : t("cloudfm.upload.capNote")}
      </p>

      {/* one line of progress, not the whole queue: every row re-renders on
          each progress tick, and a live region around them made a screen
          reader read the list out again from the top for the whole upload */}
      <p className="sr-only" aria-live="polite">
        {t("cloudfm.upload.queue")}: {summary.done}/{summary.total}
        {summary.failed ? ` · ${t("cloudfm.upload.statusError")}: ${summary.failed}` : ""}
      </p>

      <ul className="flex min-w-0 flex-col gap-1.5">
        {items.map((item) => (
          <UploadRow key={item.id} item={item} onResolve={onResolve} onRetry={onRetry} onCancel={onCancel} />
        ))}
      </ul>
    </section>
  )
}

function UploadRowInner({
  item,
  onResolve,
  onRetry,
  onCancel,
}: {
  item: UploadItem
  onResolve: (id: string, resolution: ConflictResolution) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}) {
  const { t } = useScreenkit()
  const tooLarge = item.route === "too-large"
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-panel-border bg-control px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <StatusIcon status={item.status} tooLarge={tooLarge} />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground" translate="no">
          {item.path}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-faint">{formatBytes(item.size)}</span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={cn(
            "font-mono text-[10px] lowercase",
            item.status === "error" || tooLarge ? "text-accent-red" : "text-text-muted",
          )}
        >
          {tooLarge ? t("cloudfm.upload.tooLargeItem") : t(STATUS_KEY[item.status])}
          {item.error ? ` · ${item.error}` : ""}
        </span>
        {item.route === "direct" && !tooLarge ? (
          <span className="rounded-full bg-panel-soft px-2 py-0.5 font-mono text-[10px] text-text-secondary">
            {t("cloudfm.upload.direct")}
          </span>
        ) : null}

        <span className="ml-auto flex items-center gap-1.5">
          {item.status === "conflict" ? (
            <>
              <QueueButton onClick={() => onResolve(item.id, "overwrite")}>{t("cloudfm.upload.overwrite")}</QueueButton>
              <QueueButton onClick={() => onResolve(item.id, "keep-both")}>{t("cloudfm.upload.keepBoth")}</QueueButton>
              <QueueButton onClick={() => onResolve(item.id, "skip")}>{t("cloudfm.upload.skip")}</QueueButton>
            </>
          ) : null}
          {item.status === "error" || item.status === "cancelled" ? (
            <QueueButton onClick={() => onRetry(item.id)}>
              <RotateCcw className="size-3" aria-hidden="true" /> {t("cloudfm.upload.retry")}
            </QueueButton>
          ) : null}
          {item.status === "uploading" || item.status === "pending" ? (
            <QueueButton onClick={() => onCancel(item.id)}>{t("cloudfm.upload.cancelOne")}</QueueButton>
          ) : null}
        </span>
      </div>

      {item.status === "uploading" ? (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-panel-soft">
          <div
            className="h-full w-full origin-left rounded-full bg-accent-blue motion-safe:transition-transform motion-safe:duration-150"
            style={{ transform: `scaleX(${item.progress})` }}
          />
        </div>
      ) : null}
    </li>
  )
}

const UploadRow = React.memo(UploadRowInner)

function StatusIcon({ status, tooLarge }: { status: UploadStatus; tooLarge: boolean }) {
  if (tooLarge || status === "error") return <AlertTriangle className="size-3.5 shrink-0 text-accent-red" aria-hidden="true" />
  if (status === "done") return <Check className="size-3.5 shrink-0 text-accent-green" aria-hidden="true" />
  if (status === "uploading") return <Loader2 className="size-3.5 shrink-0 animate-spin text-text-secondary" aria-hidden="true" />
  return <CloudUpload className="size-3.5 shrink-0 text-text-faint" aria-hidden="true" />
}

function QueueButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-panel-border bg-panel-soft px-2 py-1 font-mono text-[10px] lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}
