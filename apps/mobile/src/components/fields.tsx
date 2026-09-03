import * as React from "react"
import { StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { alpha, font, radius, space, type, useTheme } from "@/theme"
import { ActionButton, Explain, Label } from "./primitives"
import { BottomSheet } from "./sheet"

/* form controls in the shell's language: mono, lowercase, one column */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      {children}
      {hint ? <Explain style={{ fontSize: type.micro }}>{hint}</Explain> : null}
    </View>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize = "none",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  keyboardType?: "default" | "url" | "numeric"
  autoCapitalize?: "none" | "sentences"
}) {
  const { palette } = useTheme()
  return (
    <Field label={label}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.textFaint}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={{
          minHeight: multiline ? 96 : 44,
          textAlignVertical: multiline ? "top" : "center",
          paddingHorizontal: space.md,
          paddingVertical: 10,
          borderRadius: radius.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.panelBorder,
          backgroundColor: palette.control,
          color: palette.foreground,
          fontFamily: font.regular,
          fontSize: type.base,
        }}
      />
    </Field>
  )
}

export function ToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string
  description?: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  const { palette } = useTheme()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.regular, fontSize: type.base, color: palette.foreground }}>
          {title}
        </Text>
        {description ? <Explain style={{ fontSize: type.micro }}>{description}</Explain> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.panelBorder, true: alpha(palette.accentCyan, 0.6) }}
        thumbColor={value ? palette.accentCyan : palette.textFaint}
      />
    </View>
  )
}

/** the touch stand-in for `window.prompt`, used for rename / new folder */
export function PromptSheet({
  visible,
  title,
  initial = "",
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  title: string
  initial?: string
  confirmLabel: string
  cancelLabel: string
  onCancel: () => void
  onConfirm: (value: string) => void
}) {
  const [value, setValue] = React.useState(initial)

  React.useEffect(() => {
    if (visible) setValue(initial)
  }, [visible, initial])

  return (
    <BottomSheet visible={visible} onClose={onCancel} title={title}>
      <View style={{ gap: space.md, padding: space.sm }}>
        <TextField label={title} value={value} onChange={setValue} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <ActionButton label={cancelLabel} tone="quiet" onPress={onCancel} />
          </View>
          <View style={{ flex: 1 }}>
            <ActionButton
              label={confirmLabel}
              onPress={() => onConfirm(value.trim())}
              disabled={!value.trim()}
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  )
}
