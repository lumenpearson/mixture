import type { AspectRatio, DeviceType } from "@screenkit/core"
import * as React from "react"
import { StyleSheet, View } from "react-native"
import { radius, useTheme } from "@/theme"

/* ------------------------------------------------------------------ *
 * the device frame
 *
 * A bezel with the insert's aspect ratio, the phone-sized version of
 * apps/web/components/screenkit/device-frame.tsx. `cctv` and `projector`
 * keep a squarer bezel; everything else gets the same soft frame.
 * ------------------------------------------------------------------ */

const RATIO: Record<AspectRatio, number> = {
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "16:10": 16 / 10,
}

export function DeviceFrame({
  aspect,
  device,
  children,
}: {
  aspect: AspectRatio
  device: DeviceType
  children: React.ReactNode
}) {
  const { palette } = useTheme()
  const bezel = device === "phone" ? 10 : device === "cctv" ? 6 : 12

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: RATIO[aspect] ?? 9 / 16,
        padding: bezel,
        borderRadius: device === "phone" ? radius.lg : radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.panelBorder,
        backgroundColor: palette.sidebar,
      }}
    >
      <View
        style={{
          flex: 1,
          overflow: "hidden",
          borderRadius: device === "phone" ? radius.md : radius.sm,
          backgroundColor: palette.background,
        }}
      >
        {children}
      </View>
    </View>
  )
}
