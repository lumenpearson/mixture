import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/* ------------------------------------------------------------------ *
 * every browser storage key is documented
 *
 * CLAUDE.md and .agents/conventions.md enumerate what this app keeps in the
 * browser, and the next person to read them treats that list as the whole
 * truth. It stopped being true once: eight keys added across the feature
 * waves — the transport settings, the player, the desktop chrome, the wizard
 * draft — never reached the list. A prose list nothing checks drifts, so this
 * test checks it.
 *
 * A new key is not a failure to work around: add it to the list in CLAUDE.md
 * with a word about what it holds.
 * ------------------------------------------------------------------ */

const ROOT = join(__dirname, "..", "..")
const REPO = join(ROOT, "..", "..")
const SOURCE_DIRS = ["app", "components", "lib"]
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "generated"])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

/** `"screenkit-foo"` on a line that names a storage key or touches storage */
const KEY_LITERAL = /"((?:screenkit|mixture)[a-z0-9.:_-]*)"/g
const STORAGE_LINE = /(_KEY\b|Key\s*=|getItem|setItem|removeItem|storageKey)/

function usedKeys(): Set<string> {
  const keys = new Set<string>()
  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!STORAGE_LINE.test(line)) continue
        for (const match of line.matchAll(KEY_LITERAL)) {
          // a bare prefix is a namespace, not a key
          if (match[1].length > "mixture".length) keys.add(match[1])
        }
      }
    }
  }
  return keys
}

function documentedKeys(): Set<string> {
  const text = readFileSync(join(REPO, "CLAUDE.md"), "utf8")
  const keys = new Set<string>()
  for (const match of text.matchAll(/`((?:screenkit|mixture)[a-z0-9.:_-]*)`/g)) keys.add(match[1])
  return keys
}

describe("browser storage keys", () => {
  it("are all named in CLAUDE.md", () => {
    const documented = documentedKeys()
    const missing = [...usedKeys()].filter((key) => !documented.has(key)).sort()
    expect(missing).toEqual([])
  })

  it("finds the keys at all, so an empty scan cannot pass silently", () => {
    const used = usedKeys()
    expect(used.size).toBeGreaterThan(15)
    expect(used).toContain("screenkit-locale")
    expect(used).toContain("mixture-edit-token")
  })
})
