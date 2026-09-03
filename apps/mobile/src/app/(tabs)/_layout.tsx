import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Tabs } from "expo-router"
import { StyleSheet } from "react-native"
import { useI18n } from "@/i18n"
import { font, type, useTheme } from "@/theme"

/* the four sections of the shell, as a tab bar: the phone equivalent of
   the primary rail in apps/web/components/screenkit/rail.tsx */

export default function TabsLayout() {
  const { t } = useI18n()
  const { palette } = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.foreground,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarLabelStyle: { fontFamily: font.regular, fontSize: type.tiny, textTransform: "lowercase" },
        tabBarStyle: {
          backgroundColor: palette.sidebar,
          borderTopColor: palette.sidebarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      <Tabs.Screen
        name="library"
        options={{
          title: t("nav.library"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="preview"
        options={{
          title: t("nav.preview"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cellphone-play" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="cloud"
        options={{
          title: t("nav.cloud"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cloud-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav.settings"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="tune-variant" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  )
}
