"use client"

import { localErrorCode, type LocalErrorCode, type LocalFsBridge, type LocalPermission, type LocalScan } from "@/lib/local/bridge"
import { accentForKind, formatBytes, mediaKindOf } from "@/lib/media/kinds"
import { cn } from "@/lib/utils"
import { FolderOpen, FolderX, HardDrive, Loader2, RefreshCw, ShieldCheck, Unlock } from "lucide-react"
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

const buttonFocus = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"

/** a bridge failure carries a code so the message can be translated; a
 *  DOMException from the runtime carries an english sentence, which must not
 *  reach the interface — it falls back to the generic key */
const ERROR_KEYS: Record<LocalErrorCode, string> = {
  "no-root": "local.error.noRoot",
  denied: "local.error.denied",
  path: "local.error.path",
  "not-found": "local.error.notFound",
  "move-into-self": "local.error.moveIntoSelf",
  io: "local.error.io",
}

export function localErrorKey(error: unknown): string {
  const code = localErrorCode(error)
  return code ? ERROR_KEYS[code] : "local.error"
}

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
    // "denied" keeps the remembered handle too: the re-grant button below
    // needs to know the folder is still there before offering to unlock it
    setRootName(state === "unsupported" ? null : await bridge.rootName())
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
      setError(t(localErrorKey(caught)))
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

  /* the handle is remembered but the browser downgraded it to "prompt" after
     a reload; requestPermission inside this click is what restores it, so the
     folder does not have to be picked again */
  const regrant = async () => {
    const ask = bridge.regrant?.bind(bridge)
    if (!ask) return
    setError(null)
    const state = await ask()
    setPermission(state)
    if (state === "granted") setScan(null)
    else setError(t("local.error.denied"))
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
          <HardDrive className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <SectionHeading title={t("local.title")} />
          <Explain>{t("local.desc")}</Explain>
        </div>
      </div>

      {permission === "loading" ? (
        <span className="inline-flex items-center gap-2 font-mono text-[12px] text-text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("player.preview.loading")}
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
              <ShieldCheck className="size-3.5 text-accent-green" aria-hidden="true" /> {t("local.prompt.names")}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-accent-green" aria-hidden="true" /> {t("local.prompt.types")}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-accent-green" aria-hidden="true" /> {t("local.prompt.content")}
            </li>
          </ul>

          <div aria-live="polite" className="font-mono text-[12px]">
            {error ? (
              <span className="text-accent-red">{error}</span>
            ) : permission === "denied" ? (
              <span className="text-accent-orange">{t("local.denied")}</span>
            ) : null}
          </div>

          {/* the runtime still remembers the folder: offer to unlock it before
              asking for a new pick, otherwise the stored handle is dead weight */}
          {rootName && bridge.regrant ? (
            <div className="flex flex-col gap-2">
              <Explain>{t("local.remembered")}</Explain>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void regrant()}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90",
                    buttonFocus,
                  )}
                >
                  <Unlock className="size-4" aria-hidden="true" /> {t("local.regrant")}
                </button>
                <button
                  type="button"
                  onClick={() => void choose()}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover",
                    buttonFocus,
                  )}
                >
                  <FolderOpen className="size-3.5" aria-hidden="true" /> {t("local.change")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void choose()}
              className={cn(
                "inline-flex w-fit items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90",
                buttonFocus,
              )}
            >
              <FolderOpen className="size-4" aria-hidden="true" /> {rootName ? t("local.change") : t("local.choose")}
            </button>
          )}
        </div>
      ) : null}

      {permission === "granted" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[12px] lowercase">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-control px-2.5 py-1 text-accent-green">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> {t("local.granted")}
            </span>
            {/* a granted folder can be named anything at all; let it wrap
                instead of pushing the badge off the row */}
            <span className="min-w-0 text-foreground [overflow-wrap:anywhere]">
              {rootName ?? scan?.root ?? "—"}
            </span>
          </div>

          {/* scanning and failing are both async answers to a button press */}
          <div aria-live="polite" className="font-mono text-[12px]">
            {scanning ? (
              <span className="inline-flex items-center gap-2 text-text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("local.scanning")}
              </span>
            ) : null}
            {error ? <span className="text-accent-red">{error}</span> : null}
          </div>

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
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:opacity-60",
                  buttonFocus,
                )}
              >
                <FolderOpen className="size-4" aria-hidden="true" /> {t("local.continue")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void runScan()}
              disabled={scanning}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover disabled:opacity-50",
                buttonFocus,
              )}
            >
              <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} aria-hidden="true" /> {t("local.rescan")}
            </button>
            <button
              type="button"
              onClick={() => void choose()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover",
                buttonFocus,
              )}
            >
              <FolderOpen className="size-3.5" aria-hidden="true" /> {t("local.change")}
            </button>
            <button
              type="button"
              onClick={() => void forget()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-accent-red",
                buttonFocus,
              )}
            >
              <FolderX className="size-3.5" aria-hidden="true" /> {t("local.forget")}
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
