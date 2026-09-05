import type { ResolvedInsert, SceneComponent } from "@screenkit/core"
import { GENERATED_INSERT_PACKAGES } from "./generated-inserts"

const PACKAGES = GENERATED_INSERT_PACKAGES

const byPriority = (a: (typeof PACKAGES)[number], b: (typeof PACKAGES)[number]) =>
  (b.manifest.priority ?? 0) - (a.manifest.priority ?? 0)

/* module-level so `resolveScene` never mints a component identity: the canvas
   memoises what it returns and would otherwise remount the scene */
const NullScene: SceneComponent = () => null

/**
 * Resolve which scene renders a given insert.
 * Matching order (strongest first):
 *   1. the package the author picked in the wizard (`source.sceneKey`)
 *   2. a package whose `inserts` includes this insert.id
 *   3. a package whose `categories` includes insert.category
 *   4. the package marked `fallback`
 * Ties at the same level are broken by `priority` (higher wins).
 *
 * The explicit choice comes first because it is the only one a person made:
 * a new insert gets a fresh id and most packages declare no categories, so
 * without this rule the wizard's «отрисует сцена: …» named a package that
 * never ran. An unknown key falls through to the rules below it.
 */
export function resolveScene(insert: ResolvedInsert): SceneComponent {
  const matches = [...PACKAGES].sort(byPriority)

  const sceneKey = insert.source?.sceneKey
  if (sceneKey) {
    const chosen = matches.find((p) => p.manifest.key === sceneKey)
    if (chosen) return chosen.Scene
  }

  const byId = matches.find((p) => p.manifest.inserts?.includes(insert.id))
  if (byId) return byId.Scene

  const byCategory = matches.find((p) =>
    p.manifest.categories?.includes(insert.category),
  )
  if (byCategory) return byCategory.Scene

  const fallback = matches.find((p) => p.manifest.fallback)
  if (fallback) return fallback.Scene

  // last resort: render nothing rather than crash
  return matches[0]?.Scene ?? NullScene
}

/** all registered scene manifests (for tooling / listings) */
export const sceneManifests = PACKAGES.map((p) => p.manifest)
