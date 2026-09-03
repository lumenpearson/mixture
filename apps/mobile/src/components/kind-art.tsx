import type { InsertKind } from "@screenkit/core"
import * as React from "react"
import Svg, { Circle, Path, Rect } from "react-native-svg"

/* ------------------------------------------------------------------ *
 * minimalist line art for the three insert kinds
 *
 * The same drawings as apps/web/components/screenkit/wizard/kind-art.tsx,
 * redrawn with react-native-svg. Every stroke takes the colour passed in
 * so the wizard cards can tint them with the category accent.
 * ------------------------------------------------------------------ */

type ArtProps = { color: string; width?: number; height?: number }

const stroke = {
  fill: "none",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

export function SceneArt({ color, width = 120, height = 80 }: ArtProps) {
  return (
    <Svg viewBox="0 0 120 80" width={width} height={height}>
      <Rect x={10} y={8} width={100} height={64} rx={8} stroke={color} {...stroke} />
      <Rect x={22} y={20} width={40} height={8} rx={4} stroke={color} {...stroke} />
      <Rect x={22} y={34} width={60} height={8} rx={4} stroke={color} opacity={0.6} {...stroke} />
      <Rect x={22} y={48} width={28} height={8} rx={4} stroke={color} opacity={0.35} {...stroke} />
      <Circle cx={92} cy={24} r={6} stroke={color} {...stroke} />
      <Path d="M86 60 l6 -8 l6 8" stroke={color} {...stroke} />
    </Svg>
  )
}

export function SiteArt({ color, width = 120, height = 80 }: ArtProps) {
  return (
    <Svg viewBox="0 0 120 80" width={width} height={height}>
      <Rect x={10} y={8} width={100} height={64} rx={8} stroke={color} {...stroke} />
      <Path d="M10 22 H110" stroke={color} {...stroke} />
      <Circle cx={20} cy={15} r={1.6} fill={color} />
      <Circle cx={27} cy={15} r={1.6} fill={color} />
      <Circle cx={34} cy={15} r={1.6} fill={color} />
      <Rect x={44} y={11.5} width={56} height={7} rx={3.5} stroke={color} opacity={0.6} {...stroke} />
      <Circle cx={60} cy={47} r={14} stroke={color} {...stroke} />
      <Path
        d="M46 47 H74 M60 33 C52 42 52 52 60 61 C68 52 68 42 60 33"
        stroke={color}
        opacity={0.7}
        {...stroke}
      />
    </Svg>
  )
}

export function FileArt({ color, width = 120, height = 80 }: ArtProps) {
  return (
    <Svg viewBox="0 0 120 80" width={width} height={height}>
      <Path
        d="M34 8 H72 L90 26 V64 a8 8 0 0 1 -8 8 H34 a8 8 0 0 1 -8 -8 V16 a8 8 0 0 1 8 -8 Z"
        stroke={color}
        {...stroke}
      />
      <Path d="M72 8 V26 H90" stroke={color} {...stroke} />
      <Path d="M50 38 l14 8 l-14 8 Z" fill={color} opacity={0.85} />
      <Path d="M40 58 H80" stroke={color} opacity={0.5} {...stroke} />
    </Svg>
  )
}

export const KIND_ART: Record<InsertKind, (props: ArtProps) => React.JSX.Element> = {
  scene: SceneArt,
  site: SiteArt,
  file: FileArt,
}
