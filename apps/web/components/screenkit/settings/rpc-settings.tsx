"use client"

import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { libraryClient, resetTransport, rpcBaseUrl, rpcCurlCommand, rpcErrorMessage } from "@/lib/rpc/client"
import { formatBytes, formatClock, rpcLog, type RpcLogEntry } from "@/lib/rpc/log"
import {
  checkBaseUrl,
  RPC_FORMATS,
  RPC_PROTOCOLS,
  RPC_RETRIES_MAX,
  RPC_SERVER_MAX_TIMEOUT_MS,
  RPC_TIMEOUT_MAX_MS,
  RPC_TIMEOUT_MIN_MS,
  RPC_TIMEOUT_STEP_MS,
  rpcSettingsStore,
  type RpcFormat,
  type RpcProtocol,
} from "@/lib/rpc/settings"
import { cn } from "@/lib/utils"
import { Check, Copy, Loader2, Pause, Play, RotateCcw, Trash2, TriangleAlert, Zap } from "lucide-react"
import * as React from "react"
import { MotionNumber } from "../motion-number"
import { Explain, KeyVal, SectionHeading, SegmentedControl } from "../primitives"
import { useScreenkit } from "../store"
import { fill, recentCalls } from "./rpc-format"
import { copyText } from "@/lib/clipboard"

/* ------------------------------------------------------------------ *
 * connection · grpc / protobuf
 *
 * The card over `lib/rpc/settings.ts` and `lib/rpc/log.ts`: it changes the
 * transport the browser builds and shows what that transport actually did.
 * Both stores are module-level, so they are read with useSyncExternalStore
 * and their server snapshots are the defaults — no provider, no hydration
 * mismatch.
 *
 * It shows no credential: the edit and cloud tokens are attached by the
 * interceptor in `client.ts` and never enter the log or the curl command.
 * ------------------------------------------------------------------ */

/** how many of the 200 buffered calls the table shows */
const LOG_ROWS = 40

const inputCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"
const buttonCls =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
const smallButtonCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-panel-border bg-control px-2.5 py-1 font-mono text-[11px] lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
const headCls =
  "sticky top-0 z-10 bg-panel-soft px-3 py-2 text-left font-mono text-[10px] font-normal uppercase tracking-wide text-text-faint"
const cellCls = "px-3 py-1.5 align-top font-mono text-[11px]"

/* the endpoint is read through the settings store so it follows a base url
   change; the server snapshot is empty because `window.location` decides it */
const readEndpoint = () => rpcBaseUrl()
const readEndpointServer = () => ""

type TestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; ms: number; count: number }
  | { kind: "fail"; message: string }

export function RpcSettings() {
  const { t } = useScreenkit()
  const settings = React.useSyncExternalStore(rpcSettingsStore.subscribe, rpcSettingsStore.get, rpcSettingsStore.getServer)
  const endpoint = React.useSyncExternalStore(rpcSettingsStore.subscribe, readEndpoint, readEndpointServer)

  const [draft, setDraft] = React.useState(settings.baseUrl)
  const [test, setTest] = React.useState<TestState>({ kind: "idle" })
  const hintId = React.useId()

  // the stored override only exists after hydration, and changes again on
  // apply and on reset; the field follows the canonical value rather than
  // holding a draft the transport is not using
  React.useEffect(() => {
    setDraft(settings.baseUrl)
  }, [settings.baseUrl])

  const check = checkBaseUrl(draft)
  const dirty = check.ok && check.value !== settings.baseUrl

  const applyBaseUrl = React.useCallback(() => {
    const next = checkBaseUrl(draft)
    if (!next.ok) return
    setDraft(next.value)
    if (next.value === settings.baseUrl) return
    rpcSettingsStore.update({ baseUrl: next.value })
    // the transport caches its base url; drop it so the next call uses the new one
    resetTransport()
    setTest({ kind: "idle" })
  }, [draft, settings.baseUrl])

  const runTest = React.useCallback(async () => {
    setTest({ kind: "running" })
    const started = performance.now()
    try {
      const response = await libraryClient().getLibrary({})
      setTest({
        kind: "ok",
        ms: Math.round(performance.now() - started),
        count: response.library?.inserts.length ?? 0,
      })
    } catch (error) {
      setTest({ kind: "fail", message: rpcErrorMessage(error) })
    }
  }, [])

  const copyCurl = React.useCallback(() => {
    void copyText(rpcCurlCommand(), t("rpc.copied"), t("menu.copyFailed"))
  }, [t])

  const reset = React.useCallback(() => {
    rpcSettingsStore.reset()
    resetTransport()
    setTest({ kind: "idle" })
  }, [])

  // the deployment refuses a longer deadline; a remote host may not, so this
  // is a warning rather than a clamp (see RPC_SERVER_MAX_TIMEOUT_MS)
  const overDeadline = !settings.baseUrl && settings.timeoutMs > RPC_SERVER_MAX_TIMEOUT_MS

  /* the applied override, when it points somewhere other than the page it is
     rendered on. empty while the field is empty or names this same origin */
  const remoteOrigin = React.useSyncExternalStore(
    rpcSettingsStore.subscribe,
    () => {
      const base = rpcSettingsStore.get().baseUrl
      if (!base) return ""
      if (typeof window !== "undefined" && base === window.location.origin) return ""
      return base
    },
    () => "",
  )

  return (
    <section className="flex min-w-0 flex-col gap-6 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <SectionHeading title={t("rpc.title")} />
          <Explain>{t("rpc.desc")}</Explain>
        </div>
        <button type="button" onClick={reset} className={cn(smallButtonCls, "shrink-0")}>
          <RotateCcw className="size-3" aria-hidden="true" /> {t("rpc.reset")}
        </button>
      </div>

      <Field title={t("rpc.protocol")} desc={t("rpc.explain.grpcWeb")}>
        <SegmentedControl<RpcProtocol>
          options={RPC_PROTOCOLS.map((protocol) => ({ value: protocol, label: t(`rpc.protocol.${protocol}`) }))}
          value={settings.protocol}
          onChange={(protocol) => rpcSettingsStore.update({ protocol })}
          size="sm"
          label={t("rpc.protocol")}
        />
      </Field>

      <Field title={t("rpc.format")} desc={t("rpc.explain.format")}>
        <SegmentedControl<RpcFormat>
          options={RPC_FORMATS.map((format) => ({ value: format, label: t(`rpc.format.${format}`) }))}
          value={settings.format}
          onChange={(format) => rpcSettingsStore.update({ format })}
          size="sm"
          label={t("rpc.format")}
        />
      </Field>

      <div className="rounded-2xl border border-panel-border bg-control px-4 py-1">
        <KeyVal label={t("rpc.endpoint")} value={endpoint || "—"} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm lowercase text-foreground">{t("rpc.timeout")}</span>
          <span className="font-mono text-xs text-text-secondary">
            <MotionNumber value={settings.timeoutMs / 1000} format={{ maximumFractionDigits: 1 }} suffix={` ${t("rpc.sec")}`} />
          </span>
        </div>
        {overDeadline ? (
          <p className="flex items-start gap-1.5 font-mono text-[12px] leading-relaxed text-warning [overflow-wrap:anywhere]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{fill(t("rpc.timeoutServerLimit"), { max: RPC_SERVER_MAX_TIMEOUT_MS / 1000 })}</span>
          </p>
        ) : null}
        {/* the visible label above is a plain span, so the thumb would be
            announced as an unnamed "slider, 30000" without this group */}
        <div role="group" aria-label={t("rpc.timeout")}>
          <Slider
            value={[settings.timeoutMs]}
            min={RPC_TIMEOUT_MIN_MS}
            max={RPC_TIMEOUT_MAX_MS}
            step={RPC_TIMEOUT_STEP_MS}
            onValueChange={(next) => rpcSettingsStore.update({ timeoutMs: next[0] })}
          />
        </div>
        <Explain>{t("rpc.timeoutDesc")}</Explain>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm lowercase text-foreground">{t("rpc.retries")}</span>
          <span className="font-mono text-xs text-text-secondary">
            <MotionNumber value={settings.retries} />
          </span>
        </div>
        <div role="group" aria-label={t("rpc.retries")}>
          <Slider
            value={[settings.retries]}
            min={0}
            max={RPC_RETRIES_MAX}
            step={1}
            onValueChange={(next) => rpcSettingsStore.update({ retries: next[0] })}
          />
        </div>
        <Explain>{t("rpc.retriesDesc")}</Explain>
        <Explain>{t("rpc.explain.retries")}</Explain>
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <span className="font-mono text-sm lowercase text-foreground">{t("rpc.baseUrl")}</span>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={applyBaseUrl}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              applyBaseUrl()
            }}
            placeholder={t("rpc.baseUrlPh")}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!check.ok}
            aria-describedby={hintId}
            className={cn(inputCls, "min-w-0 flex-1")}
          />
          <button type="button" onClick={applyBaseUrl} disabled={!dirty} className={cn(buttonCls, "shrink-0")}>
            <Check className="size-3.5" aria-hidden="true" /> {t("rpc.apply")}
          </button>
        </div>
        <p
          id={hintId}
          aria-live="polite"
          className={cn(
            // `empty:hidden` keeps the flex gap out of the layout while the
            // element itself stays mounted, so the live region can announce
            "font-mono text-[12px] leading-relaxed empty:hidden [overflow-wrap:anywhere]",
            check.ok ? "text-accent-green" : "text-accent-red",
          )}
        >
          {check.ok
            ? settings.baseUrl && !dirty
              ? t("rpc.baseUrl.ok")
              : ""
            : t(`rpc.baseUrl.${check.reason}`)}
        </p>
        {remoteOrigin ? (
          /* the credential interceptor attaches the edit token and the user's
             github token to every request, so where the requests go is not a
             detail to leave in a description nobody re-reads */
          <p className="flex items-start gap-1.5 font-mono text-[12px] leading-relaxed text-warning [overflow-wrap:anywhere]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{fill(t("rpc.baseUrl.remote"), { origin: remoteOrigin })}</span>
          </p>
        ) : null}
        <Explain>{t("rpc.baseUrlDesc")}</Explain>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-control px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-sm lowercase text-foreground">{t("rpc.log")}</span>
          <span className="font-mono text-[12px] text-text-muted">{t("rpc.logDesc")}</span>
        </div>
        <Switch
          checked={settings.log}
          aria-label={t("rpc.log")}
          onCheckedChange={(log) => rpcSettingsStore.update({ log })}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void runTest()} disabled={test.kind === "running"} className={buttonCls}>
            {test.kind === "running" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="size-3.5" aria-hidden="true" />
            )}
            {test.kind === "running" ? t("rpc.testing") : t("rpc.test")}
          </button>
          <button type="button" onClick={copyCurl} className={buttonCls}>
            <Copy className="size-3.5" aria-hidden="true" /> {t("rpc.curl")}
          </button>
        </div>
        <p aria-live="polite" className="min-h-4 font-mono text-[12px] leading-relaxed [overflow-wrap:anywhere]">
          {test.kind === "ok" ? (
            <span className="text-accent-green">{fill(t("rpc.testOk"), { ms: test.ms, count: test.count })}</span>
          ) : test.kind === "fail" ? (
            <span className="text-accent-red">{`${t("rpc.testFail")} · ${test.message}`}</span>
          ) : null}
        </p>
        <Explain>{t("rpc.curlDesc")}</Explain>
      </div>

      <CallLog enabled={settings.log} />
    </section>
  )
}

/* ------------------------------- the log ------------------------------- */

function CallLog({ enabled }: { enabled: boolean }) {
  const { t } = useScreenkit()
  const entries = React.useSyncExternalStore(rpcLog.subscribe, rpcLog.get, rpcLog.getServer)
  const paused = React.useSyncExternalStore(rpcLog.subscribe, rpcLog.isPaused, () => false)
  const rows = React.useMemo(() => recentCalls(entries, LOG_ROWS), [entries])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading title={t("rpc.logTitle")} />
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => rpcLog.setPaused(!paused)}
            aria-pressed={paused}
            className={smallButtonCls}
          >
            {paused ? <Play className="size-3" aria-hidden="true" /> : <Pause className="size-3" aria-hidden="true" />}
            {paused ? t("rpc.logResume") : t("rpc.logPause")}
          </button>
          <button type="button" onClick={() => rpcLog.clear()} disabled={rows.length === 0} className={smallButtonCls}>
            <Trash2 className="size-3" aria-hidden="true" /> {t("rpc.logClear")}
          </button>
        </div>
      </div>

      {!enabled ? (
        <Explain>{t("rpc.logOff")}</Explain>
      ) : rows.length === 0 ? (
        <Explain>{t("rpc.logEmpty")}</Explain>
      ) : (
        <div className="sk-scroll max-h-72 min-w-0 overflow-y-auto rounded-2xl border border-panel-border bg-control">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">{t("rpc.logTitle")}</caption>
            <thead>
              <tr>
                <th scope="col" className={cn(headCls, "w-[4.5rem]")}>
                  {t("rpc.col.time")}
                </th>
                <th scope="col" className={headCls}>
                  {t("rpc.col.method")}
                </th>
                <th scope="col" className={cn(headCls, "w-14 text-right")}>
                  {t("rpc.col.ms")}
                </th>
                <th scope="col" className={cn(headCls, "hidden w-16 text-right sm:table-cell")}>
                  {t("rpc.col.size")}
                </th>
                <th scope="col" className={cn(headCls, "w-24")}>
                  {t("rpc.col.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <LogRow key={entry.id} entry={entry} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LogRow({ entry, t }: { entry: RpcLogEntry; t: (key: string) => string }) {
  const failed = entry.status === "error"
  return (
    <tr className="border-t border-panel-border/60">
      <td className={cn(cellCls, "text-text-faint tabular-nums")}>{formatClock(entry.at)}</td>
      <td className={cn(cellCls, "min-w-0 text-text-secondary")}>
        <span className="block truncate" title={`${entry.service}/${entry.method}`}>
          {entry.method}
        </span>
        {entry.attempt > 0 ? (
          <span className="block truncate text-[10px] lowercase text-text-faint">
            {fill(t("rpc.attempt"), { n: entry.attempt + 1 })}
          </span>
        ) : null}
      </td>
      <td className={cn(cellCls, "text-right tabular-nums text-text-secondary")}>{entry.durationMs}</td>
      <td className={cn(cellCls, "hidden text-right tabular-nums text-text-faint sm:table-cell")}>
        {formatBytes(entry.bytes)}
      </td>
      <td className={cn(cellCls, failed ? "text-accent-red" : "text-accent-green")}>
        <span className="block truncate" title={failed ? entry.message || undefined : undefined}>
          {failed ? entry.code ?? t("rpc.testFail") : t("rpc.status.ok")}
        </span>
      </td>
    </tr>
  )
}

/* ------------------------------- shells ------------------------------- */

/** the label / control / explanation stack used by the neighbouring cards */
function Field({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <span className="font-mono text-sm lowercase text-foreground">{title}</span>
      {children}
      <Explain>{desc}</Explain>
    </div>
  )
}
