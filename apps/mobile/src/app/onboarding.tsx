import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import * as React from "react"
import { ScrollView, Text, View } from "react-native"
import Animated, { FadeInDown } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Busy, Failure } from "@/components/state"
import { ActionButton, Explain, IconTile, SectionHeading, Surface } from "@/components/primitives"
import { useI18n } from "@/i18n"
import { formatBytes } from "@/lib/files"
import * as saf from "@/lib/local/saf"
import { useSettings } from "@/lib/settings"
import { markOnboardingSeen } from "@/lib/storage"
import { font, space, type, useTheme } from "@/theme"

/* ------------------------------------------------------------------ *
 * the local files permission screen
 *
 * The android twin of apps/web/components/screenkit/local/permission-
 * screen.tsx: what will be read, the button that opens the system folder
 * picker, then the scan summary. "skip for now" is a first-class path —
 * the cloud tab works without a folder, it just shows one source.
 * ------------------------------------------------------------------ */

export default function Onboarding() {
  const { t } = useI18n()
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()
  const { settings, update } = useSettings()
  const [scan, setScan] = React.useState<saf.LocalScan | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  const supported = saf.isSupported()
  const granted = Boolean(settings.localRoot)

  const runScan = React.useCallback(
    async (root: string) => {
      setBusy(true)
      setError("")
      try {
        setScan(await saf.scan(root))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("local.error"))
      } finally {
        setBusy(false)
      }
    },
    [t],
  )

  React.useEffect(() => {
    if (granted && !scan && !busy) void runScan(settings.localRoot)
  }, [granted, scan, busy, settings.localRoot, runScan])

  const choose = async () => {
    setError("")
    try {
      const uri = await saf.requestRoot()
      if (!uri) {
        setError(t("local.denied"))
        return
      }
      update({ localRoot: uri, localRootName: saf.labelFromUri(uri) })
      setScan(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("local.error"))
    }
  }

  const leave = () => {
    void markOnboardingSeen()
    router.replace("/(tabs)/cloud")
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.lg,
        paddingTop: insets.top + space.lg,
        paddingBottom: insets.bottom + space.xxl,
        gap: space.lg,
        backgroundColor: palette.background,
        flexGrow: 1,
      }}
    >
      <Animated.View entering={FadeInDown.duration(280)}>
        <Surface style={{ padding: space.lg, gap: space.lg }}>
          <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
            <IconTile icon="harddisk" accent={palette.accentCyan} size={40} />
            <View style={{ flex: 1, gap: 6 }}>
              <SectionHeading title={t("local.title")} />
              <Explain>{t("local.desc")}</Explain>
            </View>
          </View>

          {!supported ? <Explain>{t("local.unsupported")}</Explain> : null}

          {supported && !granted ? (
            <View style={{ gap: space.md }}>
              <Text
                style={{ fontFamily: font.medium, fontSize: type.base, color: palette.foreground }}
              >
                {t("local.prompt.title")}
              </Text>
              <Explain>{t("local.prompt.desc")}</Explain>
              <Surface tone="control" style={{ padding: space.md, gap: 8 }}>
                <Text
                  style={{ fontFamily: font.regular, fontSize: type.tiny, color: palette.textFaint }}
                >
                  {t("local.prompt.what")}
                </Text>
                {[t("local.prompt.names"), t("local.prompt.types"), t("local.prompt.content")].map(
                  (line) => (
                    <View key={line} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <MaterialCommunityIcons
                        name="shield-check-outline"
                        size={14}
                        color={palette.accentGreen}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: font.regular,
                          fontSize: type.small,
                          color: palette.textSecondary,
                        }}
                      >
                        {line}
                      </Text>
                    </View>
                  ),
                )}
              </Surface>
              <ActionButton label={t("local.choose")} icon="folder-open-outline" onPress={() => void choose()} />
            </View>
          ) : null}

          {granted ? (
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={16}
                  color={palette.accentGreen}
                />
                <Text
                  style={{
                    fontFamily: font.regular,
                    fontSize: type.small,
                    color: palette.accentGreen,
                  }}
                >
                  {t("local.granted")}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                style={{ fontFamily: font.regular, fontSize: type.small, color: palette.foreground }}
              >
                {settings.localRootName || saf.labelFromUri(settings.localRoot)}
              </Text>
              {busy ? <Busy label={t("local.scanning")} /> : null}
              {scan ? (
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Stat label={t("local.scan.files")} value={String(scan.files)} />
                  <Stat label={t("local.scan.dirs")} value={String(scan.directories)} />
                  <Stat label={t("local.scan.bytes")} value={formatBytes(scan.bytes)} />
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    label={t("local.change")}
                    tone="quiet"
                    icon="folder-open-outline"
                    onPress={() => void choose()}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    label={t("local.forget")}
                    tone="danger"
                    icon="folder-remove-outline"
                    onPress={() => {
                      update({ localRoot: "", localRootName: "" })
                      setScan(null)
                    }}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {error ? <Failure message={error} /> : null}
        </Surface>
      </Animated.View>

      <View style={{ gap: space.sm, marginTop: "auto" }}>
        <ActionButton label={t("local.continue")} icon="arrow-right" onPress={leave} />
        <ActionButton label={t("local.skip")} tone="quiet" onPress={leave} />
      </View>
    </ScrollView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme()
  return (
    <Surface tone="control" style={{ flex: 1, padding: space.md, gap: 2 }}>
      <Text style={{ fontFamily: font.regular, fontSize: type.tiny, color: palette.textFaint }}>
        {label}
      </Text>
      <Text style={{ fontFamily: font.medium, fontSize: type.base, color: palette.foreground }}>
        {value}
      </Text>
    </Surface>
  )
}
