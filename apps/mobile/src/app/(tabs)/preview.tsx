import type { Insert } from "@screenkit/core"
import { useVideoPlayer, VideoView } from "expo-video"
import { router } from "expo-router"
import { Image, Linking, ScrollView, Text, View } from "react-native"
import { WebView } from "react-native-webview"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DeviceFrame } from "@/components/device-frame"
import { ActionButton, Explain, KeyVal, SectionHeading, StatusBadge, Surface } from "@/components/primitives"
import { Empty } from "@/components/state"
import { useI18n } from "@/i18n"
import { mediaKindOf } from "@/lib/files"
import { useLibrary } from "@/lib/library"
import { font, space, statusAccent, type, useTheme } from "@/theme"

/* ------------------------------------------------------------------ *
 * the preview tab
 *
 * The insert inside its device frame. Packaged scenes are react
 * components that only exist in the web bundle, so a `scene` insert shows
 * its card instead of a drawing — the honest answer, and the one the
 * empty state says out loud. `site` and `file` inserts do render: a
 * webview for a page, the video player or an image for a file.
 * ------------------------------------------------------------------ */

export default function PreviewTab() {
  const { t } = useI18n()
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()
  const { data, selectedId, pick } = useLibrary()

  const insert = data.inserts.find((entry) => entry.id === selectedId)

  if (!insert) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <SectionHeading title={t("preview.title")} />
          <Explain>{t("preview.desc")}</Explain>
        </View>
        <Empty label={t("preview.none")} icon="cellphone-off" />
        <View style={{ paddingHorizontal: space.lg }}>
          <ActionButton
            label={t("preview.pick")}
            icon="view-grid-outline"
            onPress={() => router.push("/(tabs)/library")}
          />
        </View>
      </View>
    )
  }

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
      <View style={{ gap: 6 }}>
        <SectionHeading title={pick(insert.title)} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <StatusBadge label={insert.status} accent={statusAccent(insert.status, palette)} />
          <Text style={{ fontFamily: font.regular, fontSize: type.micro, color: palette.textFaint }}>
            {insert.episode} · {insert.scene}
          </Text>
        </View>
      </View>

      <DeviceFrame aspect={insert.aspect} device={insert.device}>
        <Stage insert={insert} />
      </DeviceFrame>

      <Surface style={{ padding: space.lg, gap: 2 }}>
        <KeyVal label={t("insert.device")} value={insert.device} />
        <KeyVal label={t("insert.aspect")} value={insert.aspect} />
        <KeyVal label={t("insert.category")} value={String(insert.category)} />
        <KeyVal label={t("insert.date")} value={insert.date} />
        <KeyVal label={t("insert.kind")} value={insert.kind ?? "scene"} />
      </Surface>

      {insert.kind === "site" && insert.source?.url ? (
        <>
          <Explain>{t("preview.siteBlocked")}</Explain>
          <ActionButton
            label={t("preview.openBrowser")}
            icon="open-in-new"
            tone="quiet"
            onPress={() => void Linking.openURL(insert.source?.url ?? "")}
          />
        </>
      ) : null}
    </ScrollView>
  )
}

function Stage({ insert }: { insert: Insert }) {
  const { t } = useI18n()
  const { palette } = useTheme()
  const kind = insert.kind ?? "scene"
  const source = insert.source ?? {}

  if (kind === "site") {
    if (!source.url) return <StageNote text={t("preview.noSource")} />
    return (
      <WebView
        source={{ uri: source.url }}
        scrollEnabled={source.scroll !== false}
        style={{ flex: 1, backgroundColor: palette.background }}
      />
    )
  }

  if (kind === "file") {
    const target = source.url ?? source.path ?? ""
    if (!target) return <StageNote text={t("preview.noSource")} />
    const media = mediaKindOf(target)
    if (media === "video") return <VideoStage uri={target} loop={source.loop !== false} />
    if (media === "image") {
      return (
        <Image
          source={{ uri: target }}
          resizeMode={source.fit === "cover" ? "cover" : "contain"}
          style={{ flex: 1 }}
        />
      )
    }
    return <StageNote text={target} />
  }

  return <StageNote text={t("preview.scene")} />
}

function VideoStage({ uri, loop }: { uri: string; loop: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = loop
    instance.muted = true
  })
  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
}

function StageNote({ text }: { text: string }) {
  const { palette } = useTheme()
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg }}>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: type.small,
          color: palette.textMuted,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </View>
  )
}
