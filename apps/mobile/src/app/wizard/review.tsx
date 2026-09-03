import { router } from "expo-router"
import * as React from "react"
import { ScrollView, Text, View } from "react-native"
import { ActionButton, Explain, KeyVal, SectionHeading, Surface } from "@/components/primitives"
import { Failure } from "@/components/state"
import { useI18n } from "@/i18n"
import { useLibrary } from "@/lib/library"
import { rpcErrorMessage } from "@/lib/rpc/client"
import { font, space, type, useTheme } from "@/theme"
import { WizardHeader, WizardNav } from "@/wizard/chrome"
import { useWizard } from "@/wizard/context"
import { splitLines, suggestSlug } from "@/wizard/draft"

/* ------------------------------------------------------------------ *
 * step 5 — review and create
 *
 * `AddInsertRequest` carries the card and the texts, not the kind or the
 * source: those two fields exist in @screenkit/core but not yet in
 * mixture/library/v1. The draft keeps them, and the review screen says so
 * rather than pretending they were sent.
 * ------------------------------------------------------------------ */

export default function WizardReview() {
  const { t } = useI18n()
  const { palette } = useTheme()
  const { draft, discard } = useWizard()
  const { addInsert, data, select } = useLibrary()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  const create = async () => {
    setBusy(true)
    setError("")
    try {
      const id = await addInsert({
        slug: draft.slug.trim() || suggestSlug(draft.titleRu),
        category: draft.category,
        device: draft.device,
        aspect: draft.aspect,
        status: draft.status,
        episode: draft.episode,
        scene: draft.scene,
        date: draft.date,
        titleRu: draft.titleRu.trim(),
        titleEn: draft.titleEn.trim(),
        descriptionRu: draft.descriptionRu,
        descriptionEn: draft.descriptionEn,
        promptRu: draft.promptRu,
        promptEn: draft.promptEn,
        shortPromptRu: draft.shortPromptRu,
        negativePromptRu: draft.negativePromptRu,
        technicalNotesRu: splitLines(draft.technicalNotesRu),
      })
      discard()
      select(id)
      router.replace(`/insert/${id}`)
    } catch (caught) {
      setError(rpcErrorMessage(caught, t("common.error")))
    } finally {
      setBusy(false)
    }
  }

  const category = data.categories.find((entry) => String(entry.id) === draft.category)

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <WizardHeader title={t("wizard.review.title")} description={t("wizard.review.desc")} />

      <Surface style={{ padding: space.lg, gap: 8 }}>
        <SectionHeading title={draft.titleRu || t("field.titleRu")} />
        {draft.descriptionRu ? <Explain>{draft.descriptionRu}</Explain> : null}
        <View style={{ marginTop: space.sm }}>
          <KeyVal label={t("insert.kind")} value={draft.kind} />
          <KeyVal label={t("insert.category")} value={category ? String(category.id) : draft.category} />
          <KeyVal label={t("insert.device")} value={draft.device} />
          <KeyVal label={t("insert.aspect")} value={draft.aspect} />
          <KeyVal label={t("insert.status")} value={draft.status} />
          <KeyVal label={t("insert.episode")} value={draft.episode} />
          <KeyVal label={t("insert.scene")} value={draft.scene} />
          <KeyVal label={t("insert.date")} value={draft.date} />
          {draft.source.url ? <KeyVal label={t("field.url")} value={draft.source.url} /> : null}
          {draft.source.path ? <KeyVal label={t("field.path")} value={draft.source.path} /> : null}
        </View>
      </Surface>

      {!data.persistent ? (
        <Text style={{ fontFamily: font.regular, fontSize: type.small, color: palette.warning }}>
          {t("library.readonly")}
        </Text>
      ) : null}
      {data.editLocked ? (
        <Text style={{ fontFamily: font.regular, fontSize: type.small, color: palette.warning }}>
          {t("wizard.error.locked")}
        </Text>
      ) : null}

      {error ? <Failure message={error} /> : null}

      <WizardNav
        step="review"
        nextLabel={busy ? t("wizard.creating") : t("wizard.create")}
        onNext={() => void create()}
        busy={busy}
      />

      <ActionButton label={t("wizard.discard")} tone="danger" icon="delete-outline" onPress={discard} />
    </ScrollView>
  )
}
