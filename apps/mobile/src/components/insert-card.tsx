import { MaterialCommunityIcons } from "@expo/vector-icons"
import type { CategoryDef, Insert } from "@screenkit/core"
import * as React from "react"
import { StyleSheet, Text, View } from "react-native"
import { alpha, font, radius, space, statusAccent, type, useTheme } from "@/theme"
import { PressableScale } from "./pressable"
import { IconTile, StatusBadge, type IconName } from "./primitives"

/* the library card: title, one line of context, status and the category dot */

const DEVICE_ICON: Record<string, IconName> = {
  phone: "cellphone",
  monitor: "monitor",
  tv: "television",
  tablet: "tablet",
  projector: "projector",
  cctv: "cctv",
}

export const InsertCard = React.memo(function InsertCard({
  insert,
  title,
  category,
  favorite,
  statusLabel,
  onPress,
  onLongPress,
}: {
  insert: Insert
  title: string
  category?: CategoryDef
  favorite: boolean
  statusLabel: string
  onPress: () => void
  onLongPress: () => void
}) {
  const { palette } = useTheme()
  const accent = category?.accent?.startsWith("var(") ? palette.accentCyan : (category?.accent ?? palette.accentGrey)

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.panelBorder,
        backgroundColor: alpha(palette.panelSoft, 0.85),
      }}
    >
      <IconTile icon={DEVICE_ICON[insert.device] ?? "monitor"} accent={accent} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: font.medium, fontSize: type.base, color: palette.foreground }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: font.regular, fontSize: type.micro, color: palette.textFaint }}
        >
          {insert.episode} · {insert.scene} · {insert.aspect}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <StatusBadge label={statusLabel} accent={statusAccent(insert.status, palette)} />
        {favorite ? (
          <MaterialCommunityIcons name="star" size={14} color={palette.accentOrange} />
        ) : null}
      </View>
    </PressableScale>
  )
})
