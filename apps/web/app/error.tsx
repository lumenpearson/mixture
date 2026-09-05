"use client"

import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isUiLocale, translate } from "@/lib/screenkit/i18n"
import type { UiLocale } from "@/lib/screenkit/types"
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react"
import Link from "next/link"
import * as React from "react"

/* section-level error boundary: keeps the shell's look, offers a retry and a
   way home, and never leaks the stack to the visitor (it goes to the console) */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = React.useState<UiLocale>(DEFAULT_LOCALE)
  React.useEffect(() => {
    console.error(error)
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
      if (isUiLocale(stored)) setLocale(stored)
    } catch {
      // ignore
    }
  }, [error])
  const t = (key: string) => translate(locale, key)

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-foreground">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-panel-border bg-panel-soft p-6 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(239,71,111,0.2),transparent_66%)]" />
        <div className="relative flex flex-col gap-5">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-panel-border bg-control text-text-secondary">
            <AlertTriangle className="size-7" strokeWidth={1.6} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="font-mono text-[12px] uppercase tracking-[0.34em] text-text-faint">{t("error.kicker")}</div>
            <h1 className="font-mono text-3xl font-bold lowercase sm:text-4xl">{t("error.title")}</h1>
            <p className="max-w-xl font-mono text-[13px] leading-relaxed text-text-muted">{t("error.desc")}</p>
            {error.digest ? <p className="font-mono text-[11px] text-text-faint">digest · {error.digest}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-2xl bg-control-active px-4 py-3 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90"
            >
              <RotateCcw className="size-4" /> {t("common.retry")}
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl border border-panel-border bg-control px-4 py-3 font-mono text-sm lowercase text-foreground transition-colors hover:bg-panel-hover"
            >
              <ArrowLeft className="size-4" /> {t("common.home")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
