import * as React from "react"
import { StyleSheet, Text, View } from "react-native"
import { accentForKind, formatBytes, iconForKind, mediaKindOf } from "@/lib/files"
import type { FileEntry } from "@/lib/rpc/codec"
import { alpha, font, radius, space, type, useTheme } from "@/theme"
import { PressableScale } from "./pressable"
import { IconTile, type IconName } from "./primitives"

/* one file or folder, in the list or in the grid — memoised so a long
   listing keeps scrolling at 60 fps while a request is in flight */

export const EntryRow = React.memo(function EntryRow({
  entry,
  mode,
  onPress,
  onLongPress,
}: {
  entry: FileEntry
  mode: "list" | "grid"
  onPress: () => void
  onLongPress: () => void
}) {
  const { palette } = useTheme()
  const kind = entry.directory ? "folder" : mediaKindOf(entry.name, entry.contentType)
  const accent = accentForKind(kind, palette)
  const icon = iconForKind(kind) as IconName
  const meta = entry.directory ? "" : formatBytes(entry.size)

  const surface = {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.panelBorder,
    backgroundColor: alpha(palette.panelSoft, 0.85),
  }

  if (mode === "grid") {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}
        style={{ flex: 1, margin: 4, padding: space.md, alignItems: "center", gap: 8, ...surface }}
      >
        <IconTile icon={icon} accent={accent} size={44} />
        <Text
          numberOfLines={2}
          style={{
            fontFamily: font.regular,
            fontSize: type.micro,
            color: palette.foreground,
            textAlign: "center",
          }}
        >
          {entry.name}
        </Text>
        {meta ? (
          <Text style={{ fontFamily: font.regular, fontSize: type.tiny, color: palette.textFaint }}>
            {meta}
          </Text>
        ) : null}
      </PressableScale>
    )
  }

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        marginVertical: 3,
        ...surface,
      }}
    >
      <IconTile icon={icon} accent={accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: font.regular, fontSize: type.base, color: palette.foreground }}
        >
          {entry.name}
        </Text>
        <Text style={{ fontFamily: font.regular, fontSize: type.tiny, color: palette.textFaint }}>
          {entry.directory ? "—" : meta}
        </Text>
      </View>
    </PressableScale>
  )
})
