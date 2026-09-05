/**
 * check-protocol-generation.mjs
 *
 * Regenerates the Protobuf bindings in packages/protocol/src/gen and fails when
 * the result differs from the committed tree. Run after any `.proto` edit:
 *
 *   pnpm --filter @mixture/protocol generate
 *   pnpm check:protocol-generation
 */
import { createHash } from "node:crypto"
import { execSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const protocolDir = path.resolve(__dirname, "..", "packages", "protocol")
const genDir = path.join(protocolDir, "src", "gen")

async function walk(dir) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else files.push(full)
  }
  return files.sort()
}

async function digest() {
  const hash = createHash("sha256")
  for (const file of await walk(genDir)) {
    hash.update(path.relative(genDir, file))
    hash.update("\0")
    hash.update(await fs.readFile(file))
    hash.update("\0")
  }
  return hash.digest("hex")
}

const before = await digest()
execSync("pnpm exec buf generate", { cwd: protocolDir, stdio: "inherit" })
const after = await digest()

if (before !== after) {
  console.error(
    "[protocol] generated bindings are stale: run `pnpm --filter @mixture/protocol generate` and commit packages/protocol/src/gen",
  )
  process.exit(1)
}

console.log("[protocol] generated bindings are up to date")
