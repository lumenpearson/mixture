"use client"

import { Switch } from "@/components/ui/switch"
import { useLayout, type RailSide } from "../layout"
import { useMotion } from "../motion"
import { Explain, SectionHeading, SegmentedControl } from "../primitives"
import { useScreenkit } from "../store"

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

/** the "rail on a narrow screen" block of the style section */
export function LayoutControls() {
  const { t } = useScreenkit()
  const { side, setSide, autoHideOnScroll, setAutoHideOnScroll } = useLayout()
  const { features, setMotionFeature } = useMotion()

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-panel-border bg-panel-soft p-4">
      <div className="flex flex-col gap-2">
        <SectionHeading title={t("layout.title")} />
        <Explain>{t("layout.desc")}</Explain>
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-mono text-sm lowercase text-foreground">{t("layout.side")}</span>
        <SegmentedControl<RailSide>
          options={[
            { value: "left", label: t("layout.side.left") },
            { value: "right", label: t("layout.side.right") },
          ]}
          value={side}
          onChange={setSide}
          size="sm"
        />
        <Explain>{t("layout.sideDesc")}</Explain>
      </div>

      <Toggle
        title={t("layout.autoHide")}
        desc={t("layout.autoHideDesc")}
        checked={autoHideOnScroll}
        onChange={setAutoHideOnScroll}
      />

      <Toggle
        title={t("layout.smoothScroll")}
        desc={t("layout.smoothScrollDesc")}
        checked={features.scroll}
        onChange={(enabled) => setMotionFeature("scroll", enabled)}
      />
    </div>
  )
}
