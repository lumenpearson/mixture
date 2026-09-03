"use client"

import { isTauriRuntime } from "@/lib/local/bridge"
import { isOffline, networkStore, shouldShowOffline } from "@/lib/net/online"
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isUiLocale, translate } from "@/lib/screenkit/i18n"
import type { UiLocale } from "@/lib/screenkit/types"
import { RefreshCw, WifiOff } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

/* ------------------------------------------------------------------ *
 * the offline screen
 *
 * A full-viewport overlay that appears when the app is cut off, with the
 * two answers that matter: probe again, or keep working without a network
 * (the built-in library and local files never needed one). It starts below
 * the desktop title bar so the window buttons stay reachable — on the web
 * `--sk-titlebar-h` is 0 and the overlay simply covers everything.
 *
 * The language is resolved from `screenkit-locale` rather than from
 * `ScreenkitProvider`: this screen has to be right even when the thing that
 * failed is the data the provider was waiting for, and russian is the
 * default the same way it is for the rest of the interface.
 * ------------------------------------------------------------------ */

/** the site language as stored, without going through the provider */
function readLocale(): UiLocale {
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isUiLocale(raw) ? raw : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function OfflineScreen() {
  const state = React.useSyncExternalStore(
    networkStore.subscribe,
    networkStore.get,
    networkStore.getServer,
  )
  // nothing renders until the client has mounted: the overlay depends on
  // `navigator`, on localStorage and on the runtime, none of which exist
  // during the server render
  const [ready, setReady] = React.useState(false)
  const [locale, setLocale] = React.useState<UiLocale>(DEFAULT_LOCALE)
  const [strict, setStrict] = React.useState(false)

  React.useEffect(() => {
    setLocale(readLocale())
    setStrict(isTauriRuntime())
    setReady(true)
    return networkStore.start()
  }, [])

  const t = React.useCallback((key: string) => translate(locale, key), [locale])
  const offline = isOffline(state, strict)
  const visible = ready && shouldShowOffline(state, strict)

  // land the keyboard inside the overlay rather than on whatever was focused
  // behind it. Focus is not trapped on purpose: in the desktop shell the
  // window buttons above the overlay have to stay reachable.
  const retry = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (visible) retry.current?.focus()
  }, [visible])

  // one toast on the way back up, whether or not the overlay was dismissed
  const wasOffline = React.useRef(false)
  React.useEffect(() => {
    if (!ready) return
    if (wasOffline.current && !offline) toast.success(translate(locale, "desktop.offline.restored"))
    wasOffline.current = offline
  }, [ready, offline, locale])

  if (!visible) return null

  return (
    <div
      role="alertdialog"
      aria-label={t("desktop.offline.label")}
      onKeyDown={(event) => {
        // escape means "I know, let me work" — the same as the second button
        if (event.key === "Escape") networkStore.dismiss()
      }}
      style={{ top: "var(--sk-titlebar-h)" }}
      className="sk-animate-fade fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col gap-5 rounded-3xl border border-panel-border bg-panel-soft p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-panel-border bg-control text-accent-orange">
            <WifiOff className="size-5" />
          </span>
          <h2 className="min-w-0 font-mono text-base font-bold lowercase text-foreground [overflow-wrap:anywhere]">
            {t("desktop.offline.title")}
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-mono text-[13px] leading-relaxed text-text-muted [overflow-wrap:anywhere]">
            {t("desktop.offline.desc")}
          </p>
          <p className="font-mono text-[13px] leading-relaxed text-text-faint [overflow-wrap:anywhere]">
            {t("desktop.offline.hint")}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            ref={retry}
            type="button"
            onClick={() => void networkStore.probeNow()}
            disabled={state.probing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={state.probing ? "size-3.5 animate-spin" : "size-3.5"} />
            {state.probing ? t("desktop.offline.retrying") : t("desktop.offline.retry")}
          </button>
          <button
            type="button"
            onClick={networkStore.dismiss}
            className="inline-flex items-center justify-center rounded-xl border border-panel-border bg-control px-4 py-2.5 font-mono text-sm lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
          >
            {t("desktop.offline.continue")}
          </button>
        </div>
      </div>
    </div>
  )
}
