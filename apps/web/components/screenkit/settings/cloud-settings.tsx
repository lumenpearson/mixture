"use client"

import { Switch } from "@/components/ui/switch"
import {
  ACCENT_CHOICES,
  CATEGORY_LABEL_KEY,
  DEFAULT_CATEGORY_ACCENTS,
  FILE_CATEGORIES,
  accentForCategory,
  iconForCategory,
} from "@/lib/cloud/file-types"
import { useCloudSettings } from "@/lib/cloud/settings"
import { cn } from "@/lib/utils"
import { RotateCcw } from "lucide-react"
import { Explain, SectionHeading, SegmentedControl } from "../primitives"
import { useScreenkit } from "../store"

/* ------------------------------------------------------------------ *
 * cloud file-manager settings
 *
 * Appearance only — colours, density, the default view. Mounted by the cloud
 * section header today and reachable from the appearance tab later; it takes
 * no props so either mount point works. State lives in localStorage under
 * `screenkit-cloud-settings-v1`, shared through a small store so the manager
 * follows a change immediately.
 * ------------------------------------------------------------------ */

export function CloudSettings() {
  const { t } = useScreenkit()
  const [settings, update, reset] = useCloudSettings()

  return (
    <section className="flex min-w-0 flex-col gap-6 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-2">
        <SectionHeading title={t("cloudfm.settings.title")} />
        <Explain>{t("cloudfm.settings.desc")}</Explain>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="font-mono text-[11px] lowercase text-text-secondary">{t("cloudfm.view.label")}</span>
          <SegmentedControl
            size="sm"
            value={settings.view}
            onChange={(view) => update({ view })}
            options={[
              { value: "list", label: t("cloudfm.view.list") },
              { value: "grid", label: t("cloudfm.view.grid") },
            ]}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="font-mono text-[11px] lowercase text-text-secondary">{t("cloudfm.density.label")}</span>
          <SegmentedControl
            size="sm"
            value={settings.density}
            onChange={(density) => update({ density })}
            options={[
              { value: "comfortable", label: t("cloudfm.density.comfortable") },
              { value: "compact", label: t("cloudfm.density.compact") },
            ]}
          />
        </label>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Toggle
          label={t("cloudfm.settings.colors")}
          hint={t("cloudfm.settings.colorsDesc")}
          checked={settings.colors}
          onChange={(colors) => update({ colors })}
        />
        <Toggle
          label={t("cloudfm.settings.thumbnails")}
          checked={settings.thumbnails}
          onChange={(thumbnails) => update({ thumbnails })}
        />
        <Toggle
          label={t("cloudfm.sort.foldersFirst")}
          checked={settings.foldersFirst}
          onChange={(foldersFirst) => update({ foldersFirst })}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <SectionHeading title={t("cloudfm.settings.accents")} />
        <ul className="flex min-w-0 flex-col gap-2">
          {FILE_CATEGORIES.map((category) => {
            const Icon = iconForCategory(category)
            const current = accentForCategory(category, settings.accents)
            return (
              <li
                key={category}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-panel-border bg-control px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] lowercase text-foreground">
                  <Icon
                    className="size-4 shrink-0"
                    style={settings.colors ? { color: current } : undefined}
                    aria-hidden="true"
                  />
                  <span className="truncate">{t(CATEGORY_LABEL_KEY[category])}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {ACCENT_CHOICES.map((accent) => {
                    const active = current === accent
                    return (
                      <button
                        key={accent}
                        type="button"
                        aria-label={accent}
                        aria-pressed={active}
                        disabled={!settings.colors}
                        onClick={() => update({ accents: { ...settings.accents, [category]: accent } })}
                        className={cn(
                          "size-5 rounded-full border transition-transform focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                          active ? "border-foreground" : "border-panel-border",
                        )}
                        style={{ background: accent }}
                      />
                    )
                  })}
                  <button
                    type="button"
                    aria-label={`${t("cloudfm.settings.reset")} · ${t(CATEGORY_LABEL_KEY[category])}`}
                    disabled={!settings.colors || current === DEFAULT_CATEGORY_ACCENTS[category]}
                    onClick={() => {
                      const next = { ...settings.accents }
                      delete next[category]
                      update({ accents: next })
                    }}
                    className="inline-flex size-6 items-center justify-center rounded-lg text-text-faint transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                  >
                    <RotateCcw className="size-3" aria-hidden="true" />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={reset}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" /> {t("cloudfm.settings.reset")}
      </button>
    </section>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-panel-border bg-control px-4 py-2.5">
      <span className="min-w-0">
        <span className="block truncate font-mono text-[12px] lowercase text-text-secondary">{label}</span>
        {hint ? <span className="block truncate font-mono text-[10px] lowercase text-text-faint">{hint}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
