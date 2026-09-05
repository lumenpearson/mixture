import { router, useLocalSearchParams } from "expo-router"
import { ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ActionButton, KeyVal, SectionHeading, StatusBadge, Surface } from "@/components/primitives"
import { Empty } from "@/components/state"
import { useI18n } from "@/i18n"
import { useLibrary } from "@/lib/library"
import { font, space, statusAccent, type, useTheme } from "@/theme"

/* the full insert card: the passport, the prompts and the technical notes */

export default function InsertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, content } = useI18n()
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()
  const { data, favorites, toggleFavorite, select, pick } = useLibrary()

  const insert = data.inserts.find((entry) => entry.id === id)

  if (!insert) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
        <Empty label={t("library.empty")} icon="magnify" />
        <View style={{ paddingHorizontal: space.lg }}>
          <ActionButton label={t("common.back")} icon="arrow-left" tone="quiet" onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  const notes = content === "en" ? (insert.technicalNotes.en ?? insert.technicalNotes.ru) : insert.technicalNotes.ru

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{
        padding: space.lg,
        paddingTop: insets.top + space.md,
        paddingBottom: insets.bottom + space.xxl,
        gap: space.lg,
      }}
    >
      <View style={{ gap: 8 }}>
        <SectionHeading title={pick(insert.title)} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <StatusBadge label={insert.status} accent={statusAccent(insert.status, palette)} />
          <Text style={{ fontFamily: font.regular, fontSize: type.micro, color: palette.textFaint }}>
            {insert.episode} · {insert.scene}
          </Text>
        </View>
      </View>

      <Surface style={{ padding: space.lg }}>
        <KeyVal label={t("insert.category")} value={String(insert.category)} />
        <KeyVal label={t("insert.device")} value={insert.device} />
        <KeyVal label={t("insert.aspect")} value={insert.aspect} />
        <KeyVal label={t("insert.date")} value={insert.date} />
        <KeyVal label={t("insert.custom")} value={insert.custom ? "+" : "—"} />
      </Surface>

      <Block title={t("insert.description")} body={pick(insert.description)} />
      <Block title={t("insert.prompt")} body={pick(insert.prompt)} />
      <Block title={t("insert.shortPrompt")} body={pick(insert.shortPrompt)} />
      <Block title={t("insert.negativePrompt")} body={pick(insert.negativePrompt)} />

      {notes.length > 0 ? (
        <Surface style={{ padding: space.lg, gap: 8 }}>
          <SectionHeading title={t("insert.notes")} />
          {notes.map((line) => (
            <Text
              key={line}
              style={{
                fontFamily: font.regular,
                fontSize: type.small,
                lineHeight: 20,
                color: palette.textSecondary,
              }}
            >
              · {line}
            </Text>
          ))}
        </Surface>
      ) : null}

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <ActionButton
            label={t("preview.title")}
            icon="cellphone-play"
            onPress={() => {
              select(insert.id)
              router.push("/(tabs)/preview")
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton
            label={favorites.includes(insert.id) ? t("menu.unfavorite") : t("menu.favorite")}
            icon="star-outline"
            tone="quiet"
            onPress={() => toggleFavorite(insert.id)}
          />
        </View>
      </View>
    </ScrollView>
  )
}

function Block({ title, body }: { title: string; body: string }) {
  const { palette } = useTheme()
  if (!body.trim()) return null
  return (
    <Surface style={{ padding: space.lg, gap: 8 }}>
      <SectionHeading title={title} />
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: type.small,
          lineHeight: 20,
          color: palette.textSecondary,
        }}
      >
        {body}
      </Text>
    </Surface>
  )
}
