import { router } from "expo-router"
import * as React from "react"
import { ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Field, TextField } from "@/components/fields"
import { ActionButton, Explain, SectionHeading, SegmentedControl, Surface } from "@/components/primitives"
import { useI18n } from "@/i18n"
import * as saf from "@/lib/local/saf"
import { useSettings, type SchemeSetting, type UiLocale } from "@/lib/settings"
import { PALETTE_NAMES, font, space, type, useTheme, type PaletteName } from "@/theme"

/* ------------------------------------------------------------------ *
 * the settings tab
 *
 * The android cut of the style + rpc + cloud settings cards on the web:
 * scheme and palette, the three interface voices, the endpoint the RPC
 * clients talk to, the credentials (device-only) and the granted folder.
 * Every card is one `Surface` with a heading and an explanation, the same
 * rhythm settings/player-settings.tsx uses.
 * ------------------------------------------------------------------ */

export default function SettingsTab() {
  const { t } = useI18n()
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()
  const { settings, update, reset } = useSettings()

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
      <SectionHeading title={t("settings.title")} />

      <Card title={t("settings.appearance")}>
        <Field label={t("settings.scheme")}>
          <SegmentedControl<SchemeSetting>
            size="sm"
            options={[
              { value: "system", label: t("settings.scheme.system") },
              { value: "dark", label: t("settings.scheme.dark") },
              { value: "light", label: t("settings.scheme.light") },
            ]}
            value={settings.scheme}
            onChange={(scheme) => update({ scheme })}
          />
        </Field>
        <Field label={t("settings.palette")}>
          <SegmentedControl<PaletteName>
            size="sm"
            options={PALETTE_NAMES.map((name) => ({
              value: name,
              label: t(`settings.palette.${name}`),
            }))}
            value={settings.palette}
            onChange={(value) => update({ palette: value })}
          />
        </Field>
        <Field label={t("settings.language")}>
          <SegmentedControl<UiLocale>
            size="sm"
            options={[
              { value: "ru", label: t("settings.language.ru") },
              { value: "en", label: t("settings.language.en") },
              { value: "snark", label: t("settings.language.snark") },
            ]}
            value={settings.locale}
            onChange={(locale) => update({ locale })}
          />
        </Field>
      </Card>

      <Card title={t("settings.rpc")} description={t("settings.rpcDesc")}>
        <TextField
          label={t("settings.rpcBase")}
          value={settings.rpcBaseUrl}
          onChange={(rpcBaseUrl) => update({ rpcBaseUrl: rpcBaseUrl.trim() })}
          keyboardType="url"
          placeholder="https://…"
        />
        <Field label={t("settings.rpcFormat")}>
          <SegmentedControl<"binary" | "json">
            size="sm"
            options={[
              { value: "binary", label: "binary" },
              { value: "json", label: "json" },
            ]}
            value={settings.rpcFormat}
            onChange={(rpcFormat) => update({ rpcFormat })}
          />
        </Field>
        <TextField
          label={t("settings.rpcTimeout")}
          value={String(settings.rpcTimeoutMs)}
          onChange={(value) => update({ rpcTimeoutMs: Number(value.replace(/\D/g, "")) || 15000 })}
          keyboardType="numeric"
        />
      </Card>

      <Card title={t("settings.tokens")} description={t("settings.tokensDesc")}>
        <TextField
          label={t("settings.editToken")}
          value={settings.editToken}
          onChange={(editToken) => update({ editToken })}
        />
        <TextField
          label={t("settings.cloudToken")}
          value={settings.cloudToken}
          onChange={(cloudToken) => update({ cloudToken })}
        />
        <TextField
          label={t("settings.cloudKey")}
          value={settings.cloudKey}
          onChange={(cloudKey) => update({ cloudKey })}
        />
      </Card>

      <Card title={t("settings.local")}>
        <Text
          numberOfLines={2}
          style={{ fontFamily: font.regular, fontSize: type.small, color: palette.textSecondary }}
        >
          {settings.localRoot
            ? settings.localRootName || saf.labelFromUri(settings.localRoot)
            : t("cloud.noLocal")}
        </Text>
        <ActionButton
          label={settings.localRoot ? t("local.change") : t("cloud.grantLocal")}
          icon="folder-open-outline"
          tone="quiet"
          onPress={() => router.push("/onboarding")}
        />
      </Card>

      <Card title={t("settings.about")} description={t("settings.aboutDesc")}>
        <ActionButton label={t("settings.reset")} tone="danger" icon="restore" onPress={reset} />
      </Card>
    </ScrollView>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Surface style={{ padding: space.lg, gap: space.lg }}>
      <View style={{ gap: 6 }}>
        <SectionHeading title={title} />
        {description ? <Explain>{description}</Explain> : null}
      </View>
      {children}
    </Surface>
  )
}
