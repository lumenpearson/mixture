import { MaterialCommunityIcons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import * as React from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { alpha, font, radius, space, type, useTheme } from "@/theme"
import { PressableScale } from "./pressable"
import type { IconName } from "./primitives"

/* ------------------------------------------------------------------ *
 * bottom sheet and context menu
 *
 * The touch answer to the radix context menu on the web. The model is the
 * same one `context-menu/model.ts` uses — a flat list of actions with a
 * `group` key — so the builder decides what a long press offers and this
 * component only draws it: a separator and a faint caption per group,
 * danger items in the danger colour.
 * ------------------------------------------------------------------ */

export type MenuAction = {
  id: string
  label: string
  icon?: IconName
  group: "open" | "edit" | "organise" | "danger"
  danger?: boolean
  disabled?: boolean
  run: () => void
}

const GROUP_ORDER: MenuAction["group"][] = ["open", "edit", "organise", "danger"]

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}) {
  const { palette, scheme } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(120)}
        style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="close" />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(220)}
          exiting={SlideOutDown.duration(160)}
          style={{
            backgroundColor: alpha(palette.panel, 0.86),
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: palette.panelBorder,
            paddingBottom: insets.bottom + space.md,
            maxHeight: "80%",
            overflow: "hidden",
          }}
        >
          {/* the one place the glass treatment is worth its cost: the sheet
              sits over the listing it acts on */}
          <BlurView
            intensity={40}
            tint={scheme === "light" ? "light" : "dark"}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              marginTop: space.md,
              backgroundColor: palette.panelBorder,
            }}
          />
          {title ? (
            <Text
              numberOfLines={1}
              style={{
                paddingHorizontal: space.xl,
                paddingTop: space.md,
                fontFamily: font.regular,
                fontSize: type.micro,
                color: palette.textFaint,
              }}
            >
              {title}
            </Text>
          ) : null}
          <ScrollView contentContainerStyle={{ padding: space.md }}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

export function ContextMenu({
  visible,
  onClose,
  title,
  actions,
  groupLabels,
}: {
  visible: boolean
  onClose: () => void
  title?: string
  actions: MenuAction[]
  groupLabels: Record<MenuAction["group"], string>
}) {
  const { palette } = useTheme()

  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: actions.filter((action) => action.group === group),
  })).filter((entry) => entry.items.length > 0)

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      {groups.map(({ group, items }, index) => (
        <View key={group}>
          {index > 0 ? (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: palette.panelBorder,
                marginVertical: space.sm,
              }}
            />
          ) : null}
          <Text
            style={{
              paddingHorizontal: space.md,
              paddingBottom: 4,
              fontFamily: font.regular,
              fontSize: type.tiny,
              color: palette.textFaint,
            }}
          >
            {groupLabels[group]}
          </Text>
          {items.map((action) => {
            const color = action.danger ? palette.danger : palette.foreground
            return (
              <PressableScale
                key={action.id}
                disabled={action.disabled}
                onPress={() => {
                  onClose()
                  action.run()
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingHorizontal: space.md,
                  paddingVertical: 12,
                  borderRadius: radius.sm,
                  opacity: action.disabled ? 0.4 : 1,
                }}
              >
                {action.icon ? (
                  <MaterialCommunityIcons name={action.icon} size={18} color={color} />
                ) : (
                  <View style={{ width: 18 }} />
                )}
                <Text style={{ fontFamily: font.regular, fontSize: type.base, color }}>
                  {action.label}
                </Text>
              </PressableScale>
            )
          })}
        </View>
      ))}
      {groups.length === 0 ? (
        <Text
          style={{
            padding: space.md,
            fontFamily: font.regular,
            fontSize: type.small,
            color: alpha(palette.textMuted, 0.9),
          }}
        >
          —
        </Text>
      ) : null}
    </BottomSheet>
  )
}
