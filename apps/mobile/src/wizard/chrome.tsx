import { router } from "expo-router"
import * as React from "react"
import { Text, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useI18n } from "@/i18n"
import { ActionButton, Explain, SectionHeading } from "@/components/primitives"
import { alpha, font, radius, space, type, useTheme } from "@/theme"
import { WIZARD_STEPS, validateStep, type WizardStep } from "./draft"
import { useWizard } from "./context"

/* the progress bar and the back / next pair every wizard screen wears */

export function WizardProgress() {
  const { palette } = useTheme()
  const { t } = useI18n()
  const { draft, stepIndex, total } = useWizard()
  const progress = useSharedValue((stepIndex + 1) / total)

  React.useEffect(() => {
    progress.value = withTiming((stepIndex + 1) / total, { duration: 260 })
  }, [stepIndex, total, progress])

  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))

  return (
    <View style={{ gap: 6, paddingHorizontal: space.lg, paddingTop: space.md }}>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          overflow: "hidden",
          backgroundColor: alpha(palette.panelBorder, 0.8),
        }}
      >
        <Animated.View style={[{ height: 4, backgroundColor: palette.accentCyan }, bar]} />
      </View>
      <Text style={{ fontFamily: font.regular, fontSize: type.tiny, color: palette.textFaint }}>
        {t("wizard.stepOf", { n: stepIndex + 1, total })} · {t(`wizard.step.${draft.step}`)}
      </Text>
    </View>
  )
}

export function WizardHeader({ title, description }: { title: string; description: string }) {
  return (
    <View style={{ gap: 8 }}>
      <SectionHeading title={title} />
      <Explain>{description}</Explain>
    </View>
  )
}

const ROUTE: Record<WizardStep, string> = {
  kind: "/wizard/kind",
  basics: "/wizard/basics",
  source: "/wizard/source",
  prompts: "/wizard/prompts",
  review: "/wizard/review",
}

/**
 * move one step in either direction. Going forward validates the step that
 * is being left, exactly like the web wizard, so the review screen never
 * has to explain a problem the user could have fixed three screens ago.
 */
export function WizardNav({
  step,
  nextLabel,
  onNext,
  busy,
}: {
  step: WizardStep
  nextLabel?: string
  onNext?: () => void
  busy?: boolean
}) {
  const { t } = useI18n()
  const { palette } = useTheme()
  const { draft, patch } = useWizard()
  const [problem, setProblem] = React.useState<string>("")

  const index = WIZARD_STEPS.indexOf(step)
  const previous = index > 0 ? WIZARD_STEPS[index - 1] : null
  const next = index < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[index + 1] : null

  const go = (target: WizardStep) => {
    patch({ step: target })
    router.replace(ROUTE[target])
  }

  const forward = () => {
    const failure = validateStep(draft, step)
    if (failure) {
      setProblem(t(failure))
      return
    }
    setProblem("")
    if (onNext) onNext()
    else if (next) go(next)
  }

  return (
    <View style={{ gap: space.sm }}>
      {problem ? (
        <Text style={{ fontFamily: font.regular, fontSize: type.small, color: palette.danger }}>
          {problem}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <ActionButton
            label={t("wizard.back")}
            icon="arrow-left"
            tone="quiet"
            onPress={() => (previous ? go(previous) : router.back())}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton
            label={nextLabel ?? t("wizard.next")}
            icon="arrow-right"
            onPress={forward}
            disabled={busy}
          />
        </View>
      </View>
    </View>
  )
}

export const wizardCard = { borderRadius: radius.lg, padding: space.lg, gap: space.lg }
