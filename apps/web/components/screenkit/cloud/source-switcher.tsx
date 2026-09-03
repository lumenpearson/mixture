"use client"

import { cn } from "@/lib/utils"
import { useScreenkit } from "../store"
import { useProviders } from "./provider"

/* ------------------------------------------------------------------ *
 * source switcher — one button per registered provider
 *
 * A slot, not a feature: today only the GitHub cloud repository registers,
 * so the switcher renders nothing and the manager looks exactly as before.
 * The moment a second source registers itself the strip appears with no
 * change to this file.
 * ------------------------------------------------------------------ */

export function SourceSwitcher({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  const { t } = useScreenkit()
  const providers = useProviders()
  if (providers.length < 2) return null
  return (
    /* a group of toggle buttons, not a tablist: there is no tabpanel to point
       at and the strip does not own the content below it */
    <div
      role="group"
      aria-label={t("cloudfm.source.label")}
      className={cn("flex w-fit max-w-full gap-1 rounded-2xl border border-panel-border bg-control p-1", className)}
    >
      {providers.map((provider) => {
        const active = provider.id === value
        const Icon = provider.icon
        return (
          <button
            key={provider.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(provider.id)}
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 font-mono text-xs lowercase transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-control-active text-control-active-foreground"
                : "text-text-secondary hover:bg-panel-hover hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t(provider.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
