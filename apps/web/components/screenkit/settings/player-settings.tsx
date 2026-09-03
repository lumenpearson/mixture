"use client"

import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { TEXT_ENCODINGS } from "@/lib/media/kinds"
import {
  PLAYBACK_RATES,
  PRELOAD_MODES,
  PREVIEW_MODES,
  STREAMING_MODES,
  type PreloadMode,
  type PreviewMode,
  type StreamingMode,
} from "@/lib/media/player-settings"
import { RotateCcw } from "lucide-react"
import { usePlayerSettings } from "../media/player-settings"
import { MotionNumber } from "../motion-number"
import { Explain, SectionHeading, SegmentedControl } from "../primitives"
import { useScreenkit } from "../store"

/** the "player and preview" block of the style section */
export function PlayerSettingsPanel() {
  const { t } = useScreenkit()
  const { settings, update, reset } = usePlayerSettings()

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <SectionHeading title={t("player.settings.title")} />
        <Explain>{t("player.settings.desc")}</Explain>
      </div>

      <Group title={t("player.settings.playback")}>
        <Toggle
          title={t("player.settings.autoplay")}
          desc={t("player.settings.autoplayDesc")}
          checked={settings.autoplay}
          onChange={(autoplay) => update({ autoplay })}
        />
        <Toggle title={t("player.settings.loop")} desc={t("player.settings.loopDesc")} checked={settings.loop} onChange={(loop) => update({ loop })} />
        <Toggle title={t("player.settings.muted")} desc={t("player.settings.mutedDesc")} checked={settings.muted} onChange={(muted) => update({ muted })} />
        <Range
          title={t("player.settings.volume")}
          desc={t("player.settings.volumeDesc")}
          value={settings.volume}
          min={0}
          max={100}
          suffix="%"
          onChange={(volume) => update({ volume })}
        />
        <Field title={t("player.settings.rate")} desc={t("player.settings.rateDesc")}>
          <SegmentedControl<string>
            options={PLAYBACK_RATES.map((rate) => ({ value: String(rate), label: `${rate}×` }))}
            value={String(settings.playbackRate)}
            onChange={(value) => update({ playbackRate: Number(value) })}
            size="sm"
          />
        </Field>
      </Group>

      <Group title={t("player.settings.delivery")}>
        <Field title={t("player.settings.preload")} desc={t("player.settings.preloadDesc")}>
          <SegmentedControl<PreloadMode>
            options={PRELOAD_MODES.map((mode) => ({ value: mode, label: t(`player.settings.preload.${mode}`) }))}
            value={settings.preload}
            onChange={(preload) => update({ preload })}
            size="sm"
          />
        </Field>
        <Field title={t("player.settings.streaming")} desc={t("player.settings.streamingDesc")}>
          <SegmentedControl<StreamingMode>
            options={STREAMING_MODES.map((mode) => ({ value: mode, label: t(`player.settings.streaming.${mode}`) }))}
            value={settings.streaming}
            onChange={(streaming) => update({ streaming })}
            size="sm"
          />
        </Field>
        <Range
          title={t("player.settings.buffer")}
          desc={t("player.settings.bufferDesc")}
          value={settings.bufferAhead}
          min={0}
          max={30}
          suffix={t("player.settings.bufferSuffix")}
          onChange={(bufferAhead) => update({ bufferAhead })}
        />
      </Group>

      <Group title={t("player.settings.previewing")}>
        <Field title={t("player.settings.previewMode")} desc={t("player.settings.previewModeDesc")}>
          <SegmentedControl<PreviewMode>
            options={PREVIEW_MODES.map((mode) => ({ value: mode, label: t(`player.settings.previewMode.${mode}`) }))}
            value={settings.previewMode}
            onChange={(previewMode) => update({ previewMode })}
            size="sm"
          />
        </Field>
        <Field title={t("player.settings.imageFit")} desc={t("player.settings.imageFitDesc")}>
          <SegmentedControl<"contain" | "cover">
            options={[
              { value: "contain", label: t("player.settings.fit.contain") },
              { value: "cover", label: t("player.settings.fit.cover") },
            ]}
            value={settings.imageFit}
            onChange={(imageFit) => update({ imageFit })}
            size="sm"
          />
        </Field>
        <Field title={t("player.settings.encoding")} desc={t("player.settings.encodingDesc")}>
          <div className="flex flex-wrap gap-1.5">
            {(["auto", ...TEXT_ENCODINGS] as const).map((encoding) => {
              const active = settings.encoding === encoding
              return (
                <button
                  key={encoding}
                  type="button"
                  onClick={() => update({ encoding })}
                  aria-pressed={active}
                  className={
                    active
                      ? "rounded-full border border-transparent bg-control-active px-3 py-1.5 font-mono text-xs lowercase text-control-active-foreground"
                      : "rounded-full border border-panel-border bg-control px-3 py-1.5 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
                  }
                >
                  {encoding === "auto" ? t("player.settings.encoding.auto") : encoding}
                </button>
              )
            })}
          </div>
        </Field>
        <Toggle title={t("player.settings.hotkeys")} desc={t("player.settings.hotkeysDesc")} checked={settings.hotkeys} onChange={(hotkeys) => update({ hotkeys })} />
        <Toggle title={t("player.settings.stats")} desc={t("player.settings.statsDesc")} checked={settings.stats} onChange={(stats) => update({ stats })} />
      </Group>

      <button
        type="button"
        onClick={reset}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
      >
        <RotateCcw className="size-3.5" /> {t("player.settings.reset")}
      </button>
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
      <div className="flex flex-col gap-1">
        <span className="font-mono text-sm lowercase text-foreground">{title}</span>
        <span className="font-mono text-[12px] text-text-muted">{desc}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function Range({
  title,
  desc,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  title: string
  desc: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm lowercase text-foreground">{title}</span>
        <span className="font-mono text-xs text-text-secondary">
          <MotionNumber value={value} />
          {suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(next) => onChange(next[0])} />
      <Explain>{desc}</Explain>
    </div>
  )
}
