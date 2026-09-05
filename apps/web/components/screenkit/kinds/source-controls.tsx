"use client"

import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { ResolvedInsert } from "@/lib/screenkit/types"
import { cn } from "@/lib/utils"
import { RotateCcw } from "lucide-react"
import * as React from "react"
import { MotionNumber } from "../motion-number"
import { Explain, SectionHeading, SegmentedControl } from "../primitives"
import { useScreenkit } from "../store"
import { useInsertSource } from "./overrides"
import { clampZoom } from "./site-screen"

const BACKGROUNDS = ["#000000", "#0b0f17", "#1a1a1a", "#ffffff"]

const inputCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"

/** the "source" block of the preview section for site and file inserts */
export function SourceControls({ insert }: { insert: ResolvedInsert }) {
  const { t } = useScreenkit()
  const { source, hasOverrides, set, clear } = useInsertSource(insert.id, insert.source)
  if (insert.kind === "scene") return null
  const zoomPercent = Math.round(clampZoom(source.zoom) * 100)

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <SectionHeading title={`${t("kind.source.title")} · ${t(`kind.${insert.kind}`)}`} />
          <Explain>{t("kind.source.desc")}</Explain>
        </div>
        {hasOverrides ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> {t("kind.source.reset")}
          </button>
        ) : null}
      </div>

      {insert.kind === "site" ? (
        <Field label={t("kind.source.url")}>
          <Input value={source.url ?? ""} onChange={(event) => set({ url: event.target.value })} placeholder={t("kind.source.urlPh")} className={inputCls} />
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("kind.source.path")}>
            <Input value={source.path ?? ""} onChange={(event) => set({ path: event.target.value })} placeholder={t("kind.source.pathPh")} className={inputCls} />
          </Field>
          <Field label={t("kind.source.url")}>
            <Input value={source.url ?? ""} onChange={(event) => set({ url: event.target.value })} placeholder={t("kind.source.urlPh")} className={inputCls} />
          </Field>
        </div>
      )}

      <Range
        title={t("kind.source.zoom")}
        desc={t("kind.source.zoomDesc")}
        value={zoomPercent}
        min={25}
        max={300}
        suffix="%"
        onChange={(value) => set({ zoom: value / 100 })}
      />

      {insert.kind === "site" ? (
        <>
          <Toggle title={t("kind.source.scroll")} desc={t("kind.source.scrollDesc")} checked={source.scroll ?? false} onChange={(scroll) => set({ scroll })} />
          <Explain>{t("kind.site.blocked")}</Explain>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <SectionHeading title={t("kind.source.fit")} />
            <SegmentedControl<"contain" | "cover">
              options={[
                { value: "contain", label: t("player.settings.fit.contain") },
                { value: "cover", label: t("player.settings.fit.cover") },
              ]}
              value={source.fit ?? "contain"}
              onChange={(fit) => set({ fit })}
              size="sm"
            />
            <Explain>{t("kind.source.fitDesc")}</Explain>
          </div>
          <Toggle title={t("kind.source.autoplay")} desc={t("kind.source.autoplayDesc")} checked={source.autoplay ?? false} onChange={(autoplay) => set({ autoplay })} />
          <Toggle title={t("kind.source.loop")} desc={t("kind.source.loopDesc")} checked={source.loop ?? false} onChange={(loop) => set({ loop })} />
          <Toggle title={t("kind.source.muted")} desc={t("kind.source.mutedDesc")} checked={source.muted ?? false} onChange={(muted) => set({ muted })} />
        </>
      )}

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("kind.source.background")} />
        <div className="flex flex-wrap items-center gap-2">
          {BACKGROUNDS.map((color) => {
            const selected = (source.background ?? "#000000").toLowerCase() === color
            return (
              <button
                key={color}
                type="button"
                onClick={() => set({ background: color })}
                aria-pressed={selected}
                aria-label={color}
                title={color}
                className={cn(
                  "size-8 rounded-full border-2 transition-transform",
                  selected ? "scale-110 border-foreground" : "border-panel-border hover:scale-105",
                )}
                style={{ background: color }}
              />
            )
          })}
          <Input
            value={source.background ?? ""}
            onChange={(event) => set({ background: event.target.value })}
            placeholder="#000000"
            aria-label={t("kind.source.background")}
            className={cn(inputCls, "h-8 w-32")}
          />
        </div>
        <Explain>{t("kind.source.backgroundDesc")}</Explain>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] lowercase text-text-secondary">{label}</span>
      {children}
    </label>
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
      {/* the title above is a plain span: without this the switch is
          announced as an unnamed "switch, off", three in a row on the file
          panel */}
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
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
        <SectionHeading title={title} />
        <span className="font-mono text-xs text-text-secondary">
          <MotionNumber value={value} />
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(next) => onChange(next[0])}
        aria-label={title}
      />
      <Explain>{desc}</Explain>
    </div>
  )
}
