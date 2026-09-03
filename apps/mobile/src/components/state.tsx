import { MaterialCommunityIcons } from "@expo/vector-icons"
import { ActivityIndicator, Text, View } from "react-native"
import { alpha, font, radius, space, type, useTheme } from "@/theme"
import { ActionButton, type IconName } from "./primitives"

/* the three screen states the shell repeats: busy, empty, failed */

export function Busy({ label }: { label: string }) {
  const { palette } = useTheme()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.lg }}>
      <ActivityIndicator size="small" color={palette.accentCyan} />
      <Text style={{ fontFamily: font.regular, fontSize: type.small, color: palette.textMuted }}>
        {label}
      </Text>
    </View>
  )
}

export function Empty({ label, icon = "tray" }: { label: string; icon?: IconName }) {
  const { palette } = useTheme()
  return (
    <View style={{ alignItems: "center", gap: space.sm, paddingVertical: 48 }}>
      <MaterialCommunityIcons name={icon} size={28} color={palette.textFaint} />
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: type.small,
          color: palette.textMuted,
          textAlign: "center",
          paddingHorizontal: space.xl,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

export function Failure({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel?: string
  onRetry?: () => void
}) {
  const { palette } = useTheme()
  return (
    <View
      style={{
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.md,
        backgroundColor: alpha(palette.danger, 0.1),
      }}
    >
      <Text style={{ fontFamily: font.regular, fontSize: type.small, color: palette.danger }}>
        {message}
      </Text>
      {onRetry && retryLabel ? (
        <ActionButton label={retryLabel} tone="quiet" icon="refresh" onPress={onRetry} />
      ) : null}
    </View>
  )
}
