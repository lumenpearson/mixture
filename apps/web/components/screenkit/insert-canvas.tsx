"use client"

/* eslint-disable react-hooks/static-components -- the registry looks up an
   existing module-level scene component; nothing is created during render */
import { resolveScene } from "@/lib/screenkit/insert-registry"
import type { ResolvedInsert } from "@/lib/screenkit/types"
import * as React from "react"
import type { PreviewSettings } from "./store"

/**
 * Renders the "screen content" of a prop insert by resolving it to one of the
 * workspace insert-scene packages (packages/inserts/*). The actual scenes live
 * in their own packages; this just picks the right one and renders it.
 */
export function InsertCanvas({
  insert,
  settings,
}: {
  insert: ResolvedInsert
  settings?: PreviewSettings
}) {
  // the registry only looks up an existing, module-level scene component (no
  // component is created here); memoising keeps its identity stable across
  // renders so the scene keeps its own state
  const Scene = React.useMemo(() => resolveScene(insert), [insert])
  return <Scene insert={insert} settings={settings as unknown as Record<string, unknown>} />
}
