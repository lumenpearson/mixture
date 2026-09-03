"use client"

import type { InsertKind } from "@/lib/screenkit/types"

/* minimalist line art for the three insert kinds. everything is drawn in
   currentColor so the cards can tint it with the category accent. */

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

export function SceneArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden {...common}>
      <rect x="10" y="8" width="100" height="64" rx="8" />
      <rect x="22" y="20" width="40" height="8" rx="4" />
      <rect x="22" y="34" width="60" height="8" rx="4" opacity="0.6" />
      <rect x="22" y="48" width="28" height="8" rx="4" opacity="0.35" />
      <circle cx="92" cy="24" r="6" />
      <path d="M86 60 l6 -8 l6 8" />
    </svg>
  )
}

export function SiteArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden {...common}>
      <rect x="10" y="8" width="100" height="64" rx="8" />
      <path d="M10 22 H110" />
      <circle cx="20" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="27" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="34" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <rect x="44" y="11.5" width="56" height="7" rx="3.5" opacity="0.6" />
      <circle cx="60" cy="47" r="14" />
      <path d="M46 47 H74 M60 33 C52 42 52 52 60 61 C68 52 68 42 60 33" opacity="0.7" />
    </svg>
  )
}

export function FileArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden {...common}>
      <path d="M34 8 H72 L90 26 V64 a8 8 0 0 1 -8 8 H34 a8 8 0 0 1 -8 -8 V16 a8 8 0 0 1 8 -8 Z" />
      <path d="M72 8 V26 H90" />
      <path d="M50 38 l14 8 l-14 8 Z" fill="currentColor" stroke="none" opacity="0.85" />
      <path d="M40 58 H80" opacity="0.5" />
    </svg>
  )
}

export const KIND_ART: Record<InsertKind, (props: { className?: string }) => React.JSX.Element> = {
  scene: SceneArt,
  site: SiteArt,
  file: FileArt,
}
