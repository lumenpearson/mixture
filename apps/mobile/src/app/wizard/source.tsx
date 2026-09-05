import * as DocumentPicker from "expo-document-picker"
import * as React from "react"
import { ScrollView, Text, View } from "react-native"
import { Field, TextField, ToggleRow } from "@/components/fields"
import { ActionButton, Explain, Pill, Surface } from "@/components/primitives"
import { Failure } from "@/components/state"
import { useI18n } from "@/i18n"
import { useFileManager } from "@/lib/cloud"
import { useLibrary } from "@/lib/library"
import { font, space, type, useTheme } from "@/theme"
import { WizardHeader, WizardNav } from "@/wizard/chrome"
import { useWizard } from "@/wizard/context"

/* ------------------------------------------------------------------ *
 * step 3 — the source
 *
 * Three different screens behind one step, the way the web wizard does
 * it: a scene picks a category, a site takes a url with zoom and scroll,
 * a file is browsed out of the cloud or picked off the device.
 * ------------------------------------------------------------------ */

export default function WizardSource() {
  const { t } = useI18n()
  const { palette } = useTheme()
  const { draft, patch } = useWizard()
  const { data, pick } = useLibrary()
  const manager = useFileManager()
  const [error, setError] = React.useState("")

  const pickFromDevice = async () => {
    setError("")
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
      if (picked.canceled || picked.assets.length === 0) return
      patch({ source: { ...draft.source, url: picked.assets[0].uri, path: picked.assets[0].name } })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <WizardHeader
        title={t("wizard.source.title")}
        description={
          draft.kind === "site"
            ? t("wizard.source.siteDesc")
            : draft.kind === "file"
              ? t("wizard.source.fileDesc")
              : t("wizard.source.sceneDesc")
        }
      />

      {draft.kind === "scene" ? (
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
      ) : null}

      {draft.kind === "site" ? (
        <>
          <TextField
            label={t("field.url")}
            value={draft.source.url ?? ""}
            onChange={(url) => patch({ source: { ...draft.source, url } })}
            keyboardType="url"
            placeholder="https://…"
          />
          <TextField
            label={t("field.zoom")}
            value={String(Math.round((draft.source.zoom ?? 1) * 100))}
            onChange={(value) =>
              patch({
                source: {
                  ...draft.source,
                  zoom: Math.min(400, Math.max(25, Number(value.replace(/\D/g, "")) || 100)) / 100,
                },
              })
            }
            keyboardType="numeric"
          />
          <ToggleRow
            title={t("field.scroll")}
            value={draft.source.scroll !== false}
            onChange={(scroll) => patch({ source: { ...draft.source, scroll } })}
          />
        </>
      ) : null}

      {draft.kind === "file" ? (
        <>
          <Surface tone="control" style={{ padding: space.md, gap: space.sm }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: font.regular, fontSize: type.micro, color: palette.textFaint }}
            >
              {manager.path || t("cloud.root")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Pill onPress={manager.goUp}>{t("cloud.up")}</Pill>
              {manager.entries.slice(0, 40).map((entry) => (
                <Pill
                  key={entry.path}
                  active={draft.source.path === entry.path}
                  onPress={() =>
                    entry.directory
                      ? manager.open(entry.path)
                      : patch({ source: { ...draft.source, path: entry.path } })
                  }
                >
                  {entry.directory ? `${entry.name}/` : entry.name}
                </Pill>
              ))}
            </View>
            {manager.entries.length === 0 ? <Explain>{t("cloud.empty")}</Explain> : null}
          </Surface>

          <ActionButton
            label={t("wizard.pickFile")}
            icon="file-search-outline"
            tone="quiet"
            onPress={() => void pickFromDevice()}
          />

          <TextField
            label={t("field.path")}
            value={draft.source.path ?? ""}
            onChange={(path) => patch({ source: { ...draft.source, path } })}
            placeholder="renders/ep01/lock-screen.png"
          />
        </>
      ) : null}

      {error ? <Failure message={error} /> : null}

      <WizardNav step="source" />
    </ScrollView>
  )
}
