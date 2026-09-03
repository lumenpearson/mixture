import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono"
import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import * as React from "react"
import { View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { I18nProvider } from "@/i18n"
import { LibraryProvider } from "@/lib/library"
import { SettingsProvider, useSettings } from "@/lib/settings"
import { ThemeProvider, useTheme } from "@/theme"

/* ------------------------------------------------------------------ *
 * the root layout
 *
 * Providers in dependency order: settings first (the theme and the
 * language read from it), then the palette, the dictionary and the
 * library. The splash screen stays up until both the saved settings and
 * the mono font are in, so the first frame is never the wrong colour.
 * ------------------------------------------------------------------ */

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ThemeProvider>
            <I18nProvider>
              <LibraryProvider>
                <Shell />
              </LibraryProvider>
            </I18nProvider>
          </ThemeProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function Shell() {
  const { palette, scheme } = useTheme()
  const { ready } = useSettings()
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  })

  React.useEffect(() => {
    if (ready && fontsLoaded) void SplashScreen.hideAsync()
  }, [ready, fontsLoaded])

  if (!ready || !fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />
  }

  return (
    <>
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: palette.background },
        }}
      />
    </>
  )
}
