import type { InsertKind } from "@screenkit/core"
import { ScrollView, Text, View } from "react-native"
import Animated, { FadeInDown } from "react-native-reanimated"
import { KIND_ART } from "@/components/kind-art"
import { PressableScale } from "@/components/pressable"
import { ActionButton, Explain, Surface } from "@/components/primitives"
import { useI18n } from "@/i18n"
import { font, space, type, useTheme } from "@/theme"
import { WizardHeader, WizardNav } from "@/wizard/chrome"
import { useWizard } from "@/wizard/context"

/* step 1 — the kind, as three cards with the line art of the web wizard */

const KINDS: InsertKind[] = ["scene", "site", "file"]

export default function WizardKind() {
  const { t } = useI18n()
  const { palette } = useTheme()
  const { draft, patch, restored, discard } = useWizard()

  const accentFor = (kind: InsertKind) =>
    kind === "scene" ? palette.accentCyan : kind === "site" ? palette.accentPurple : palette.accentOrange

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <WizardHeader title={t("wizard.kind.title")} description={t("wizard.kind.desc")} />

      {restored ? (
        <Surface tone="control" style={{ padding: space.md, gap: space.sm }}>
          <Text style={{ fontFamily: font.medium, fontSize: type.small, color: palette.foreground }}>
            {t("wizard.resume")}
          </Text>
          <Explain style={{ fontSize: type.micro }}>{t("wizard.resumeDesc")}</Explain>
          <ActionButton label={t("wizard.startOver")} tone="quiet" icon="restore" onPress={discard} />
        </Surface>
      ) : null}

      {KINDS.map((kind, index) => {
        const Art = KIND_ART[kind]
        const active = draft.kind === kind
        const accent = accentFor(kind)
        return (
          <Animated.View key={kind} entering={FadeInDown.delay(index * 60).duration(240)}>
            <PressableScale onPress={() => patch({ kind })}>
              <Surface
                style={{
                  padding: space.lg,
                  gap: space.md,
                  borderColor: active ? accent : palette.panelBorder,
                }}
              >
                <View style={{ alignItems: "center" }}>
                  <Art color={accent} width={150} height={100} />
                </View>
                <Text
                  style={{
                    fontFamily: font.bold,
                    fontSize: type.large,
                    color: active ? accent : palette.foreground,
                  }}
                >
                  {t(`kind.${kind}`)}
                </Text>
                <Explain>{t(`kind.${kind}Desc`)}</Explain>
              </Surface>
            </PressableScale>
          </Animated.View>
        )
      })}

      <WizardNav step="kind" />
    </ScrollView>
  )
}
