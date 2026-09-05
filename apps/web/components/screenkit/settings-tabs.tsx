"use client"

import { cn } from "@/lib/utils"
import { Cloud, Palette, type LucideIcon } from "lucide-react"
import { useScreenkit, type Section } from "./store"

/* the settings hub: appearance and the cloud drive share one tab strip so
   both read as tabs of the same settings area while keeping their own url
   slugs (?view=appearance, ?view=cloud) */
const TABS: { id: Section; icon: LucideIcon; labelKey: string }[] = [
  { id: "style", icon: Palette, labelKey: "settings.tabs.appearance" },
  { id: "cloud", icon: Cloud, labelKey: "settings.tabs.cloud" },
]

export function SettingsTabs({ className }: { className?: string }) {
  const { section, setSection, t } = useScreenkit()
  return (
    <div
      role="tablist"
      aria-label={t("settings.title")}
      className={cn("flex w-fit max-w-full gap-1 rounded-2xl border border-panel-border bg-control p-1", className)}
    >
      {TABS.map((tab) => {
        const active = section === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setSection(tab.id)}
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 font-mono text-xs lowercase transition-colors",
              active
                ? "bg-control-active text-control-active-foreground"
                : "text-text-secondary hover:bg-panel-hover hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{t(tab.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
