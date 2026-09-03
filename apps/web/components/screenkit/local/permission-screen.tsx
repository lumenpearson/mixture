"use client"

import type { LocalFsBridge, LocalPermission, LocalScan } from "@/lib/local/bridge"
import { accentForKind, formatBytes, mediaKindOf } from "@/lib/media/kinds"
import { cn } from "@/lib/utils"
import { FolderOpen, FolderX, HardDrive, Loader2, RefreshCw, ShieldCheck } from "lucide-react"
import * as React from "react"
import { MotionNumber } from "../motion-number"
import { Explain, SectionHeading } from "../primitives"
import { useScreenkit } from "../store"

/* ------------------------------------------------------------------ *
 * the local files permission screen
 *
 * Shown the first time (and whenever access is missing): what will be
 * read, a button that opens the folder picker, then the scan summary —
 * counts, size and the file types found — before the folder appears in
 * the cloud tab. The same component serves web, desktop and android
 * through the bridge.
 * ------------------------------------------------------------------ */

export function LocalPermissionScreen({
  bridge,
  onContinue,
  className,
}: {
  bridge: LocalFsBridge
  onContinue?: () => void
  className?: string
}) {
  const { t } = useScreenkit()
  const [permission, setPermission] = React.useState<LocalPermission | "loading">("loading")
  const [rootName, setRootName] = React.useState<string | null>(null)
  const [scan, setScan] = React.useState<LocalScan | null>(null)
  const [scanning, setScanning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    const state = await bridge.permission()
    setPermission(state)
    setRootName(state === "granted" || state === "prompt" ? await bridge.rootName() : null)
  }, [bridge])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const runScan = React.useCallback(async () => {
    setScanning(true)
    setError(null)
    try {
      setScan(await bridge.scan())
      setPermission("granted")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("local.error"))
    } finally {
      setScanning(false)
    }
  }, [bridge, t])

  React.useEffect(() => {
    if (permission === "granted" && !scan && !scanning) void runScan()
  }, [permission, scan, scanning, runScan])

  const choose = async () => {
    const name = await bridge.requestRoot()
    if (!name) return
    setRootName(name)
    setScan(null)
    setPermission("granted")
  }

  const forget = async () => {
    await bridge.forgetRoot()
    setScan(null)
    setRootName(null)
    setPermission(bridge.isSupported() ? "prompt" : "unsupported")
  }

  const types = React.useMemo(() => {
    if (!scan) return []
    return Object.entries(scan.byExtension)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [scan])

  return (
    <section className={cn("flex flex-col gap-5 rounded-3xl border border-panel-border bg-panel-soft p-5 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-panel-border bg-control text-accent-cyan">
          <HardDrive className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <SectionHeading title={t("local.title")} />
          <Explain>{t("local.desc")}</Explain>
        </div>
      </div>

      {permission === "loading" ? (
        <span className="inline-flex items-center gap-2 font-mono text-[12px] text-text-muted">
          <Loader2 className="size-4 animate-spin" /> {t("player.preview.loading")}
        </span>
      ) : null}

      {permission === "unsupported" ? <Explain>{t("local.unsupported")}</Explain> : null}

      {permission === "prompt" || permission === "denied" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-sm lowercase text-foreground">{t("local.prompt.title")}</span>
            <Explain>{t("local.prompt.desc")}</Explain>
          </div>
          <ul className="flex flex-col gap-1.5 rounded-2xl border border-panel-border bg-control p-4 font-mono text-[12px] text-text-secondary">
            <li className="mb-1 text-[10px] uppercase tracking-wide text-text-faint">{t("local.prompt.what")}</li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-accent-green" /> {t("local.prompt.names")}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-accent-green" /> {t("local.prompt.types")}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-accent-green" /> {t("local.prompt.content")}
            </li>
          </ul>
          {permission === "denied" ? <span className="font-mono text-[12px] text-accent-orange">{t("local.denied")}</span> : null}
          <button
            type="button"
            onClick={() => void choose()}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90"
          >
            <FolderOpen className="size-4" /> {rootName ? t("local.change") : t("local.choose")}
          </button>
        </div>
      ) : null}

      {permission === "granted" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[12px] lowercase">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-control px-2.5 py-1 text-accent-green">
              <ShieldCheck className="size-3.5" /> {t("local.granted")}
            </span>
            <span className="text-foreground">{rootName ?? scan?.root ?? "—"}</span>
          </div>

          {scanning ? (
            <span className="inline-flex items-center gap-2 font-mono text-[12px] text-text-muted">
              <Loader2 className="size-4 animate-spin" /> {t("local.scanning")}
            </span>
          ) : null}
          {error ? <span className="font-mono text-[12px] text-accent-red">{error}</span> : null}

          {scan ? (
            <>
              <dl className="grid grid-cols-3 gap-2">
                <Stat label={t("local.scan.files")} value={<MotionNumber value={scan.files} />} />
                <Stat label={t("local.scan.dirs")} value={<MotionNumber value={scan.directories} />} />
                <Stat label={t("local.scan.bytes")} value={formatBytes(scan.bytes)} />
              </dl>
              {scan.truncated ? <Explain>{t("local.scan.truncated")}</Explain> : null}
              {types.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{t("local.scan.types")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map(([ext, count]) => (
                      <span
                        key={ext}
                        className="inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-control px-2.5 py-1 font-mono text-[11px] lowercase text-text-secondary"
                      >
                        <span className="size-1.5 rounded-full" style={{ background: accentForKind(mediaKindOf(`x.${ext}`)) }} />
                        .{ext} <span className="text-text-faint">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {onContinue ? (
              <button
                type="button"
                onClick={onContinue}
                disabled={!scan}
                className="inline-flex items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <FolderOpen className="size-4" /> {t("local.continue")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void runScan()}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} /> {t("local.rescan")}
            </button>
            <button
              type="button"
              onClick={() => void choose()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover"
            >
              <FolderOpen className="size-3.5" /> {t("local.change")}
            </button>
            <button
              type="button"
              onClick={() => void forget()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-accent-red"
            >
              <FolderX className="size-3.5" /> {t("local.forget")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-panel-border bg-control px-3 py-2.5">
      <dt className="font-mono text-[10px] lowercase text-text-faint">{label}</dt>
      <dd className="font-mono text-sm text-foreground">{value}</dd>
    </div>
  )
}
