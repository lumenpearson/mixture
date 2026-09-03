"use client"

import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import * as React from "react"
import { MotionNumber } from "../motion-number"
import { Explain, SectionHeading, SegmentedControl } from "../primitives"
import { useScreenkit } from "../store"
import {
  GLASS_GLOW_COLORS,
  GLASS_NOISE_IMAGE,
  GLASS_PRESETS,
  GLASS_TARGET_KEYS,
  GLOW_COLOR_VALUE,
  useGlass,
  type GlassGlowColor,
  type GlassPreset,
  type GlassTargetKey,
} from "../theme"

/* -------------------------------------------------------------------- *
 * shared control shells — mirrors the Control / SliderControl / SwitchControl
 * pattern in sections/preview.tsx so this settings card reads like a
 * neighbour rather than inventing its own idiom.
 * -------------------------------------------------------------------- */

function RangeControl({
  title,
  desc,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  title: string
  desc: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading title={title} />
        <span className="font-mono text-xs text-text-secondary">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
      <Explain>{desc}</Explain>
    </div>
  )
}

function ToggleCard({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
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

/* -------------------------------------------------------------------- *
 * live preview — reads straight from react state (not the <html> vars) so
 * dragging a slider updates it in lockstep, independent of the master switch.
 * -------------------------------------------------------------------- */

function GlassPreview() {
  const { t } = useScreenkit()
  const { glass } = useGlass()

  const glowColor = GLOW_COLOR_VALUE[glass.glowColor]
  const ring = `color-mix(in srgb, ${glowColor} ${glass.borderGlow * 70}%, transparent)`
  const halo = `color-mix(in srgb, ${glowColor} ${glass.borderGlow * 45}%, transparent)`

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading title={t("glass.preview")} />
      <div
        className="relative flex h-28 items-end overflow-hidden rounded-2xl p-4"
        style={{
          background:
            "linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 45%, var(--accent-orange) 100%)",
        }}
      >
        <div
          className="flex flex-col gap-1 rounded-xl px-4 py-3"
          style={{
            backdropFilter: `blur(${glass.blur}px) saturate(${glass.saturate})`,
            WebkitBackdropFilter: `blur(${glass.blur}px) saturate(${glass.saturate})`,
            backgroundColor: `color-mix(in srgb, var(--panel-soft) ${Math.round(glass.alpha * 100)}%, transparent)`,
            backgroundImage: glass.noise ? GLASS_NOISE_IMAGE : "none",
            backgroundBlendMode: "overlay",
            boxShadow: `inset 0 0 0 1px ${ring}, 0 0 12px ${halo}`,
          }}
        >
          <span className="font-mono text-xs lowercase text-foreground">{t("glass.previewSample")}</span>
          <span className="font-mono text-[11px] lowercase text-text-muted">{t("glass.previewSampleDesc")}</span>
        </div>
      </div>
      <Explain>{t("glass.previewDesc")}</Explain>
    </div>
  )
}

/* -------------------------------------------------------------------- *
 * glass-controls
 * -------------------------------------------------------------------- */

export function GlassControls() {
  const { t } = useScreenkit()
  const { glass, activePreset, setEnabled, setPreset, setBlur, setAlpha, setSaturate, setBorderGlow, setGlowColor, setNoise, setTarget, reset } =
    useGlass()

  const presetOptions: { value: GlassPreset; label: string }[] = GLASS_PRESETS.map((preset) => ({
    value: preset,
    label: t(`glass.preset.${preset}`),
  }))

  const glowColorOptions: { value: GlassGlowColor; label: string }[] = GLASS_GLOW_COLORS.map((color) => ({
    value: color,
    label: t(`glass.glowColor.${color}`),
  }))

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-panel-border bg-panel-soft p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading title={t("glass.title")} />
        <button
          type="button"
          onClick={reset}
          className="w-fit rounded-xl border border-panel-border bg-control px-3 py-1.5 font-mono text-[11px] lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
        >
          {t("glass.reset")}
        </button>
      </div>
      <Explain>{t("glass.desc")}</Explain>

      <ToggleCard
        title={`${t("glass.enable")} — ${glass.enabled ? t("glass.enableOn") : t("glass.enableOff")}`}
        desc={t("glass.enableDesc")}
        checked={glass.enabled}
        onChange={setEnabled}
      />

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("glass.presets")} />
        <SegmentedControl<GlassPreset> options={presetOptions} value={activePreset ?? "glass"} onChange={setPreset} />
        <Explain>{t("glass.presetsDesc")}</Explain>
      </div>

      <RangeControl
        title={t("glass.blur")}
        desc={t("glass.blurDesc")}
        value={glass.blur}
        min={0}
        max={32}
        step={1}
        onChange={setBlur}
        display={<MotionNumber value={glass.blur} suffix="px" />}
      />

      <RangeControl
        title={t("glass.translucency")}
        desc={t("glass.translucencyDesc")}
        value={glass.alpha}
        min={0.2}
        max={1}
        step={0.01}
        onChange={setAlpha}
        display={<MotionNumber value={glass.alpha} format={{ style: "percent" }} />}
      />

      <RangeControl
        title={t("glass.borderGlow")}
        desc={t("glass.borderGlowDesc")}
        value={glass.borderGlow}
        min={0}
        max={1}
        step={0.01}
        onChange={setBorderGlow}
        display={<MotionNumber value={glass.borderGlow} format={{ style: "percent" }} />}
      />

      <RangeControl
        title={t("glass.saturate")}
        desc={t("glass.saturateDesc")}
        value={glass.saturate}
        min={0.8}
        max={2}
        step={0.01}
        onChange={setSaturate}
        display={<MotionNumber value={glass.saturate} prefix="×" format={{ maximumFractionDigits: 2 }} />}
      />

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("glass.glowColor")} />
        <SegmentedControl<GlassGlowColor> options={glowColorOptions} value={glass.glowColor} onChange={setGlowColor} />
        <Explain>{t("glass.glowColorDesc")}</Explain>
      </div>

      <ToggleCard title={t("glass.noise")} desc={t("glass.noiseDesc")} checked={glass.noise} onChange={setNoise} />

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("glass.targets")} />
        <Explain>{t("glass.targetsDesc")}</Explain>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {GLASS_TARGET_KEYS.map((key: GlassTargetKey) => {
            const enabled = glass.targets[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTarget(key, !enabled)}
                aria-pressed={enabled}
                className={cn(
                  "min-w-0 rounded-2xl border p-3 text-left transition-colors",
                  enabled
                    ? "border-ring bg-control-active text-control-active-foreground"
                    : "border-panel-border bg-control text-text-secondary hover:bg-panel-hover hover:text-foreground",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[12px] font-bold lowercase">{t(`glass.target.${key}`)}</span>
                  <span className="shrink-0 font-mono text-[10px] lowercase opacity-75">{enabled ? "on" : "off"}</span>
                </span>
                <span className="mt-2 block font-mono text-[11px] lowercase leading-relaxed opacity-75">
                  {t(`glass.target.${key}Desc`)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <GlassPreview />

      <Explain>{t("glass.perfNote")}</Explain>
    </div>
  )
}
