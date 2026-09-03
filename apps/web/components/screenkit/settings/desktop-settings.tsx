"use client"

import { Switch } from "@/components/ui/switch"
import { RotateCcw } from "lucide-react"
import {
  MIN_SIZE_PRESETS,
  type ControlsSide,
  type MinSizePreset,
} from "../desktop/desktop-settings"
import { useDesktopSettings, useIsTauri } from "../desktop/use-window"
import { Explain, SectionHeading, SegmentedControl } from "../primitives"
import { useScreenkit } from "../store"

/* the "desktop" block of the style section: the window and our own title
   bar. Only the desktop shell has a window to apply any of it to, so a
   browser tab gets the heading and one line saying where the settings live
   instead of controls that would do nothing. */
export function DesktopSettings() {
  const { t } = useScreenkit()
  const tauri = useIsTauri()
  const { settings, update, reset } = useDesktopSettings()

  const minSizeLabel = (preset: MinSizePreset) =>
    preset === "none" ? t("desktop.settings.minSize.none") : preset.replace("x", " × ")

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <SectionHeading title={t("desktop.settings.title")} />
        <Explain>{t("desktop.settings.desc")}</Explain>
      </div>

      {!tauri ? (
        <p className="font-mono text-[13px] leading-relaxed text-text-faint [overflow-wrap:anywhere]">
          {t("desktop.settings.webOnly")}
        </p>
      ) : (
        <>
          <Group title={t("desktop.settings.window")}>
            <Toggle
              title={t("desktop.settings.alwaysOnTop")}
              desc={t("desktop.settings.alwaysOnTopDesc")}
              checked={settings.alwaysOnTop}
              onChange={(alwaysOnTop) => update({ alwaysOnTop })}
            />
            <Toggle
              title={t("desktop.settings.startMaximized")}
              desc={t("desktop.settings.startMaximizedDesc")}
              checked={settings.startMaximized}
              onChange={(startMaximized) => update({ startMaximized })}
            />
            <Toggle
              title={t("desktop.settings.remember")}
              desc={t("desktop.settings.rememberDesc")}
              checked={settings.rememberBounds}
              onChange={(rememberBounds) => update({ rememberBounds })}
            />
            <Field title={t("desktop.settings.minSize")} desc={t("desktop.settings.minSizeDesc")}>
              <SegmentedControl<MinSizePreset>
                options={MIN_SIZE_PRESETS.map((preset) => ({ value: preset, label: minSizeLabel(preset) }))}
                value={settings.minSize}
                onChange={(minSize) => update({ minSize })}
                size="sm"
              />
            </Field>
          </Group>

          <Group title={t("desktop.settings.bar")}>
            <Toggle
              title={t("desktop.settings.showBar")}
              desc={t("desktop.settings.showBarDesc")}
              checked={settings.bar}
              onChange={(bar) => update({ bar })}
            />
            <Toggle
              title={t("desktop.settings.compact")}
              desc={t("desktop.settings.compactDesc")}
              checked={settings.compact}
              onChange={(compact) => update({ compact })}
            />
            <Field title={t("desktop.settings.side")} desc={t("desktop.settings.sideDesc")}>
              <SegmentedControl<ControlsSide>
                options={[
                  { value: "left", label: t("desktop.settings.side.left") },
                  { value: "right", label: t("desktop.settings.side.right") },
                ]}
                value={settings.controlsSide}
                onChange={(controlsSide) => update({ controlsSide })}
                size="sm"
              />
            </Field>
            <Toggle
              title={t("desktop.settings.clock")}
              desc={t("desktop.settings.clockDesc")}
              checked={settings.clock}
              onChange={(clock) => update({ clock })}
            />
            <Toggle
              title={t("desktop.settings.sectionTitle")}
              desc={t("desktop.settings.sectionTitleDesc")}
              checked={settings.sectionTitle}
              onChange={(sectionTitle) => update({ sectionTitle })}
            />
            <Toggle
              title={t("desktop.settings.accentLine")}
              desc={t("desktop.settings.accentLineDesc")}
              checked={settings.accentLine}
              onChange={(accentLine) => update({ accentLine })}
            />
          </Group>

          <button
            type="button"
            onClick={reset}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> {t("desktop.settings.reset")}
          </button>
        </>
      )}
    </section>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">{title}</span>
      {children}
    </div>
  )
}

function Field({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-mono text-sm lowercase text-foreground">{title}</span>
      {children}
      <Explain>{desc}</Explain>
    </div>
  )
}

function Toggle({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string
  desc: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-control px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-sm lowercase text-foreground">{title}</span>
        <span className="font-mono text-[12px] text-text-muted [overflow-wrap:anywhere]">{desc}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
