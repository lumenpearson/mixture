"use client"

import { resolveScene } from "@/lib/screenkit/insert-registry"
import type { ResolvedInsert } from "@/lib/screenkit/types"
import * as React from "react"
import { FileScreen } from "./kinds/file-screen"
import { SiteScreen } from "./kinds/site-screen"
import type { PreviewSettings } from "./store"

/**
 * Renders the "screen content" of a prop insert. Scene inserts resolve to
 * one of the workspace insert-scene packages (packages/inserts/*); site
 * inserts embed a website; file inserts show a file from the cloud drive
 * or a direct url.
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
  const Scene = React.useMemo(() => (insert.kind === "scene" ? resolveScene(insert) : null), [insert])
  if (insert.kind === "site") return <SiteScreen insert={insert} />
  if (insert.kind === "file") return <FileScreen insert={insert} />
  if (!Scene) return null
  // eslint-disable-next-line react-hooks/static-components -- a module-level component of an insert package, never a fresh identity
  return <Scene insert={insert} settings={settings as unknown as Record<string, unknown>} />
}
