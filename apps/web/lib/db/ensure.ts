import "server-only"
import { sql } from "drizzle-orm"
import { getDb, isDatabaseConfigured } from "./index"

/* ------------------------------------------------------------------ *
 * schema top-up
 *
 * The project ships no migration tooling: the tables are created by hand and
 * `lib/db/schema.ts` is the description of what they should look like. When a
 * column is added to that description, an already deployed database still
 * lacks it, and a deployment must not need a maintenance window to catch up.
 *
 * So every entry point that touches the library awaits `ensureSchema()` first.
 * It runs `ADD COLUMN IF NOT EXISTS` once per process (a module-level promise
 * keeps concurrent requests to a single round trip) and is a no-op afterwards.
 * The plain SQL is mirrored in `apps/web/drizzle/0001_insert_kinds.sql` for
 * anyone who prefers to run it by hand.
 * ------------------------------------------------------------------ */

const STATEMENTS = [
  `ALTER TABLE "screenkit_inserts" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'scene'`,
  `ALTER TABLE "screenkit_inserts" ADD COLUMN IF NOT EXISTS "source" jsonb`,
]

let pending: Promise<void> | null = null
let warned = false

async function run(): Promise<void> {
  const db = getDb()
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

/**
 * Brings `screenkit_inserts` up to the columns the code reads. Never throws:
 * a database that refuses the ALTER (no rights, unreachable) must not turn a
 * read into an error — `fetchLibrary()` still has to answer with the built-in
 * library, and a mutation still has to fail on its own merits. A failed
 * attempt is not cached, so the next request tries again.
 */
export function ensureSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return Promise.resolve()
  if (!pending) {
    pending = run().catch((error: unknown) => {
      pending = null
      if (!warned) {
        warned = true
        console.warn(
          "[mixture] could not top up the insert schema:",
          error instanceof Error ? error.message : error,
        )
      }
    })
  }
  return pending
}
