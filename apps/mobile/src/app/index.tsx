import { Redirect } from "expo-router"
import * as React from "react"
import { View } from "react-native"
import { isSupported } from "@/lib/local/saf"
import { useSettings } from "@/lib/settings"
import { KEYS, readText } from "@/lib/storage"
import { usePalette } from "@/theme"

/* ------------------------------------------------------------------ *
 * the entry gate
 *
 * The onboarding screen is shown at the first launch and whenever the
 * folder permission is gone — but never again once the user has chosen to
 * skip it, which is what the "seen" flag records.
 * ------------------------------------------------------------------ */

export default function Index() {
  const palette = usePalette()
  const { settings } = useSettings()
  const [seen, setSeen] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    void (async () => setSeen((await readText(KEYS.onboarding)) === "seen"))()
  }, [])

  if (seen === null) return <View style={{ flex: 1, backgroundColor: palette.background }} />

  const needsFolder = isSupported() && !settings.localRoot
  if (!seen && needsFolder) return <Redirect href="/onboarding" />
  return <Redirect href="/(tabs)/library" />
}
