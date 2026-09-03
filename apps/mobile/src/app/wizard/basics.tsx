import type { AspectRatio, DeviceType, InsertStatus } from "@screenkit/core"
import { ScrollView, View } from "react-native"
import { Field, TextField } from "@/components/fields"
import { Pill, SegmentedControl } from "@/components/primitives"
import { useI18n } from "@/i18n"
import { useLibrary } from "@/lib/library"
import { ASPECTS, DEVICES, STATUSES } from "@/lib/rpc/codec"
import { DEVICE_ASPECT, space } from "@/theme"
import { WizardHeader, WizardNav } from "@/wizard/chrome"
import { useWizard } from "@/wizard/context"
import { suggestSlug } from "@/wizard/draft"

/* step 2 — the card: title, identity, category, device and the frame */

export default function WizardBasics() {
  const { t } = useI18n()
  const { data, pick } = useLibrary()
  const { draft, patch } = useWizard()

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <WizardHeader title={t("wizard.basics.title")} description={t("wizard.basics.desc")} />

      <TextField
        label={t("field.titleRu")}
        value={draft.titleRu}
        onChange={(titleRu) => patch({ titleRu })}
        autoCapitalize="sentences"
      />
      <TextField
        label={t("field.titleEn")}
        value={draft.titleEn}
        onChange={(titleEn) => patch({ titleEn })}
      />
      <TextField
        label={t("field.slug")}
        value={draft.slug}
        onChange={(slug) => patch({ slug })}
        placeholder={suggestSlug(draft.titleRu)}
      />

      <Field label={t("library.category")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {data.categories.map((category) => (
            <Pill
              key={String(category.id)}
              active={draft.category === String(category.id)}
              onPress={() => patch({ category: String(category.id) })}
            >
              {pick(category.label)}
            </Pill>
          ))}
        </View>
      </Field>

      <Field label={t("insert.device")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {DEVICES.map((device: DeviceType) => (
            <Pill
              key={device}
              active={draft.device === device}
              onPress={() =>
                patch({
                  device,
                  // the device carries its natural frame, exactly like DEVICES
                  // does on the web; the user can still change it below
                  aspect: (DEVICE_ASPECT[device] as AspectRatio) ?? draft.aspect,
                })
              }
            >
              {device}
            </Pill>
          ))}
        </View>
      </Field>

      <Field label={t("insert.aspect")}>
        <SegmentedControl<AspectRatio>
          size="sm"
          options={ASPECTS.map((aspect) => ({ value: aspect, label: aspect }))}
          value={draft.aspect}
          onChange={(aspect) => patch({ aspect })}
        />
      </Field>

      <Field label={t("insert.status")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {STATUSES.map((status: InsertStatus) => (
            <Pill key={status} active={draft.status === status} onPress={() => patch({ status })}>
              {status}
            </Pill>
          ))}
        </View>
      </Field>

      <TextField
        label={t("field.episode")}
        value={draft.episode}
        onChange={(episode) => patch({ episode })}
      />
      <TextField label={t("field.scene")} value={draft.scene} onChange={(scene) => patch({ scene })} />
      <TextField
        label={t("field.date")}
        value={draft.date}
        onChange={(date) => patch({ date })}
        placeholder="2026-01-01"
      />

      <WizardNav step="basics" />
    </ScrollView>
  )
}
