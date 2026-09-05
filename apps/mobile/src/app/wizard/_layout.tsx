import { Stack } from "expo-router"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLibrary } from "@/lib/library"
import { useTheme } from "@/theme"
import { WizardProgress } from "@/wizard/chrome"
import { WizardProvider } from "@/wizard/context"

/* the wizard stack: one provider, one progress bar, five screens */

export default function WizardLayout() {
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()
  const { data } = useLibrary()
  const defaultCategory = data.categories.length > 0 ? String(data.categories[0].id) : ""

  return (
    <WizardProvider defaultCategory={defaultCategory}>
      <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
        <WizardProgress />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: palette.background },
          }}
        />
      </View>
    </WizardProvider>
  )
}
