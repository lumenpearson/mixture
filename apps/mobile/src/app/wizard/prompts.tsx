import { ScrollView } from "react-native"
import { TextField } from "@/components/fields"
import { useI18n } from "@/i18n"
import { space } from "@/theme"
import { WizardHeader, WizardNav } from "@/wizard/chrome"
import { useWizard } from "@/wizard/context"

/* step 4 — the optional texts: description, prompts, technical notes */

export default function WizardPrompts() {
  const { t } = useI18n()
  const { draft, patch } = useWizard()

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <WizardHeader title={t("wizard.prompts.title")} description={t("wizard.prompts.desc")} />

      <TextField
        label={t("field.descriptionRu")}
        value={draft.descriptionRu}
        onChange={(descriptionRu) => patch({ descriptionRu })}
        multiline
        autoCapitalize="sentences"
      />
      <TextField
        label={t("field.descriptionEn")}
        value={draft.descriptionEn}
        onChange={(descriptionEn) => patch({ descriptionEn })}
        multiline
      />
      <TextField
        label={t("field.promptRu")}
        value={draft.promptRu}
        onChange={(promptRu) => patch({ promptRu })}
        multiline
      />
      <TextField
        label={t("field.promptEn")}
        value={draft.promptEn}
        onChange={(promptEn) => patch({ promptEn })}
        multiline
      />
      <TextField
        label={t("field.shortPromptRu")}
        value={draft.shortPromptRu}
        onChange={(shortPromptRu) => patch({ shortPromptRu })}
        multiline
      />
      <TextField
        label={t("field.negativePromptRu")}
        value={draft.negativePromptRu}
        onChange={(negativePromptRu) => patch({ negativePromptRu })}
        multiline
      />
      <TextField
        label={t("field.notesRu")}
        value={draft.technicalNotesRu}
        onChange={(technicalNotesRu) => patch({ technicalNotesRu })}
        multiline
      />

      <WizardNav step="prompts" />
    </ScrollView>
  )
}
