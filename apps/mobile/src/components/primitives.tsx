import { MaterialCommunityIcons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import * as React from "react"
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import { alpha, font, glass, radius, space, type, useTheme } from "@/theme"
import { PressableScale } from "./pressable"

/* ------------------------------------------------------------------ *
 * primitives
 *
 * The android port of apps/web/components/screenkit/primitives.tsx:
 * IconTile, SegmentedControl, SectionHeading, Explain, Pill, KeyVal and
 * StatusBadge, plus `Surface` — the panel the web gets for free from the
 * `.bg-panel-soft` + glass utilities in glass.css. Everything is mono and
 * lowercase; no component here holds state beyond the press animation.
 * ------------------------------------------------------------------ */

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"]

/** a translucent panel with the soft border glow of `glass-muted-glow` */
export function Surface({
  children,
  style,
  tone = "soft",
  blur = false,
}: {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  tone?: "soft" | "panel" | "control"
  blur?: boolean
}) {
  const { palette, scheme } = useTheme()
  const base =
    tone === "panel" ? palette.panel : tone === "control" ? palette.control : palette.panelSoft
  const surface: ViewStyle = {
    backgroundColor: alpha(base, glass.alpha),
    borderColor: palette.panelBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    // the halo the web draws with box-shadow; android keeps it cheap
    shadowColor: palette.ring,
    shadowOpacity: glass.glow * 0.5,
    shadowRadius: 12,
    elevation: 0,
  }
  if (!blur) return <View style={[surface, style]}>{children}</View>
  return (
    <BlurView
      intensity={glass.blur * 2}
      tint={scheme === "light" ? "light" : "dark"}
      style={[surface, { overflow: "hidden" }, style]}
    >
      {children}
    </BlurView>
  )
}

export function SectionHeading({ title, style }: { title: string; style?: StyleProp<TextStyle> }) {
  const { palette } = useTheme()
  return (
    <Text
      numberOfLines={2}
      style={[
        { fontFamily: font.bold, fontSize: type.large, color: palette.foreground },
        style,
      ]}
    >
      {title}
    </Text>
  )
}

export function Explain({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { palette } = useTheme()
  return (
    <Text
      style={[
        { fontFamily: font.regular, fontSize: type.body, lineHeight: 20, color: palette.textMuted },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme()
  return (
    <Text style={{ fontFamily: font.regular, fontSize: type.tiny, color: palette.textFaint }}>
      {children}
    </Text>
  )
}

export function IconTile({
  icon,
  accent,
  active,
  size = 36,
}: {
  icon: IconName
  accent: string
  active?: boolean
  size?: number
}) {
  const { palette } = useTheme()
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? accent : alpha(accent, 0.14),
        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
        borderColor: palette.panelBorder,
      }}
    >
      <MaterialCommunityIcons
        name={icon}
        size={Math.round(size * 0.5)}
        color={active ? palette.controlActiveForeground : accent}
      />
    </View>
  )
}

export type SegmentOption<T extends string> = { value: T; label: string }

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: "sm" | "md"
}) {
  const { palette } = useTheme()
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.panelBorder,
        backgroundColor: palette.control,
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              borderRadius: radius.sm,
              paddingVertical: size === "sm" ? 6 : 10,
              paddingHorizontal: 8,
              backgroundColor: active ? palette.controlActive : "transparent",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                textAlign: "center",
                fontFamily: font.medium,
                fontSize: size === "sm" ? type.micro : type.small,
                color: active ? palette.controlActiveForeground : palette.textSecondary,
              }}
            >
              {option.label}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}

export function Pill({
  children,
  accent,
  active,
  onPress,
}: {
  children: React.ReactNode
  accent?: string
  active?: boolean
  onPress?: () => void
}) {
  const { palette } = useTheme()
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? "transparent" : palette.panelBorder,
        backgroundColor: active ? palette.controlActive : palette.panelSoft,
      }}
    >
      {accent ? (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          fontFamily: font.regular,
          fontSize: type.micro,
          color: active ? palette.controlActiveForeground : palette.textSecondary,
        }}
      >
        {children}
      </Text>
    </View>
  )
  if (!onPress) return body
  return <PressableScale onPress={onPress}>{body}</PressableScale>
}

export function StatusBadge({ label, accent }: { label: string; accent: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.panelBorder,
        backgroundColor: palette.panelSoft,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
      <Text style={{ fontFamily: font.regular, fontSize: type.micro, color: accent }}>{label}</Text>
    </View>
  )
}

export function KeyVal({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme()
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.lg,
        paddingVertical: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: alpha(palette.panelBorder, 0.6),
      }}
    >
      <Text style={{ fontFamily: font.regular, fontSize: type.micro, color: palette.textFaint }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          textAlign: "right",
          fontFamily: font.regular,
          fontSize: type.small,
          color: palette.textSecondary,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

/** the primary action button: the web's `bg-control-active` pill */
export function ActionButton({
  label,
  icon,
  onPress,
  disabled,
  tone = "primary",
}: {
  label: string
  icon?: IconName
  onPress: () => void
  disabled?: boolean
  tone?: "primary" | "quiet" | "danger"
}) {
  const { palette } = useTheme()
  const background =
    tone === "primary" ? palette.controlActive : tone === "danger" ? alpha(palette.danger, 0.16) : palette.control
  const color =
    tone === "primary" ? palette.controlActiveForeground : tone === "danger" ? palette.danger : palette.foreground
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: radius.sm,
        backgroundColor: background,
        borderWidth: tone === "primary" ? 0 : StyleSheet.hairlineWidth,
        borderColor: palette.panelBorder,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={color} /> : null}
      <Text style={{ fontFamily: font.medium, fontSize: type.base, color }}>{label}</Text>
    </PressableScale>
  )
}
