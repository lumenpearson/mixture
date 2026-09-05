"use client"

import { Input } from "@/components/ui/input"
import {
  CLOUD_KEY_STORAGE_KEY,
  CLOUD_TOKEN_STORAGE_KEY,
  cloudClient,
  getCloudKey,
  getCloudToken,
  rpcErrorMessage,
  writeStorage,
} from "@/lib/rpc/client"
import { cn } from "@/lib/utils"
import { Role, type Status } from "@mixture/protocol/cloud"
import { Cloud, CloudOff, KeyRound, Loader2, Plus, RefreshCw, Shield, X } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { Explain, SectionHeading } from "../primitives"
import { useScreenkit } from "../store"
import { toolbarButtonCls, toolbarPrimaryCls } from "./toolbar"

/* ------------------------------------------------------------------ *
 * the connection strip above the file manager
 *
 * Unchanged in behaviour from the first cloud tab: what repository is in
 * play, what role the caller resolved to, where to paste a token or a key,
 * and the one-click repository creation for the configured owner. Tokens and
 * keys never leave localStorage except as request headers.
 * ------------------------------------------------------------------ */

const inputCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"

/*
 * `Status.message` carries a dictionary key, not a sentence: the interface is
 * russian and the server used to send english text that named an internal
 * environment variable to anyone who opened the tab. Only these four keys are
 * rendered — anything else (an older deployment, a message that slipped
 * through) is dropped rather than shown raw, because `translate` falls back to
 * echoing the key.
 */
const STATUS_MESSAGE_KEYS = new Set([
  "cloud.status.noToken",
  "cloud.status.unreachable",
  "cloud.status.configInvalid",
  "cloud.status.signIn",
])

export const ROLE_KEY: Record<Role, string> = {
  [Role.UNSPECIFIED]: "cloud.role.anonymous",
  [Role.ANONYMOUS]: "cloud.role.anonymous",
  [Role.VIEWER]: "cloud.role.viewer",
  [Role.EDITOR]: "cloud.role.editor",
  [Role.OWNER]: "cloud.role.owner",
}

export function StatusCard({
  status,
  connected,
  refreshing,
  onConnect,
  onRefresh,
  onAccess,
  children,
}: {
  status: Status | null
  connected: boolean
  refreshing: boolean
  onConnect: () => void
  onRefresh: () => void
  onAccess?: () => void
  children?: React.ReactNode
}) {
  const { t } = useScreenkit()
  const role = status?.role ?? Role.ANONYMOUS
  const ok = Boolean(status?.configured && status.reachable)
  const message = status && STATUS_MESSAGE_KEYS.has(status.message) ? t(status.message) : ""
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl border border-panel-border",
            ok ? "text-accent-green" : "text-text-faint",
          )}
        >
          {ok ? <Cloud className="size-5" aria-hidden="true" /> : <CloudOff className="size-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-sm lowercase text-foreground">
            <span className="truncate" translate="no">
              {status?.repo ?? "—"}
            </span>
            {status?.branch ? (
              <span className="rounded-full bg-control px-2 py-0.5 text-[10px] text-text-secondary" translate="no">
                {status.branch}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-control px-2 py-0.5 text-[10px] text-text-secondary">
              <Shield className="size-3" aria-hidden="true" /> {t(ROLE_KEY[role])}
            </span>
          </div>
          <div className="truncate font-mono text-[11px] lowercase text-text-muted">
            {status?.login ? `${t("cloud.signedInAs")} ${status.login}` : message || (ok ? "" : t("cloud.notConfigured"))}
            {status?.login && message ? ` · ${message}` : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {onAccess ? (
          <button type="button" className={toolbarButtonCls} onClick={onAccess}>
            <Shield className="size-3.5" aria-hidden="true" /> {t("cloud.access.title")}
          </button>
        ) : null}
        <button type="button" className={toolbarButtonCls} onClick={onConnect}>
          <KeyRound className="size-3.5" aria-hidden="true" /> {connected ? t("cloud.connect.saved") : t("cloud.connect.save")}
        </button>
        {status?.repo ? (
          <a
            href={`https://github.com/${status.repo}`}
            target="_blank"
            rel="noreferrer noopener"
            className={toolbarButtonCls}
          >
            {t("cloud.openOnGithub")}
          </a>
        ) : null}
        <button
          type="button"
          className={toolbarButtonCls}
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={t("cloud.refresh")}
          title={t("cloud.refresh")}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function ConnectPanel({ onDone }: { onDone: () => void }) {
  const { t } = useScreenkit()
  const [token, setToken] = React.useState(() => getCloudToken())
  const [key, setKey] = React.useState(() => getCloudKey())

  const save = () => {
    writeStorage(CLOUD_TOKEN_STORAGE_KEY, token.trim())
    writeStorage(CLOUD_KEY_STORAGE_KEY, key.trim())
    toast.success(t("cloud.connect.saved"))
    onDone()
  }
  const clear = () => {
    setToken("")
    setKey("")
    writeStorage(CLOUD_TOKEN_STORAGE_KEY, "")
    writeStorage(CLOUD_KEY_STORAGE_KEY, "")
    onDone()
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:p-5">
      <SectionHeading title={t("cloud.connect.title")} />
      <Explain>{t("cloud.connect.desc")}</Explain>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] lowercase text-text-secondary">{t("cloud.connect.token")}</span>
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder={t("cloud.connect.tokenPh")}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] lowercase text-text-secondary">{t("cloud.connect.key")}</span>
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={t("cloud.connect.keyPh")}
            className={inputCls}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={toolbarPrimaryCls} onClick={save} disabled={!token.trim() && !key.trim()}>
          <KeyRound className="size-3.5" aria-hidden="true" /> {t("cloud.connect.save")}
        </button>
        <button type="button" className={toolbarButtonCls} onClick={clear}>
          <X className="size-3.5" aria-hidden="true" /> {t("cloud.connect.clear")}
        </button>
      </div>
    </div>
  )
}

export function InitCard({ onDone }: { onDone: () => void }) {
  const { t } = useScreenkit()
  const [busy, setBusy] = React.useState(false)
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-dashed border-panel-border bg-control p-4 sm:p-5">
      <SectionHeading title={t("cloud.init.title")} />
      <Explain>{t("cloud.init.desc")}</Explain>
      <button
        type="button"
        className={cn(toolbarPrimaryCls, "w-fit")}
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const response = await cloudClient().initRepository({ private: true })
            toast.success(response.created ? t("cloud.init.created") : t("cloud.init.exists"))
            onDone()
          } catch (error) {
            toast.error(rpcErrorMessage(error))
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="size-3.5" aria-hidden="true" />
        )}{" "}
        {t("cloud.init.button")}
      </button>
    </div>
  )
}
