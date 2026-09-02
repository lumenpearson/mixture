import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

/* ------------------------------------------------------------------ *
 * database client
 *
 * The pool is created lazily and only when DATABASE_URL is present, so a
 * build or a deployment without a database still serves the built-in
 * library instead of crashing at prerender time (that is exactly what took
 * the production build down before). Callers check `isDatabaseConfigured()`
 * and degrade gracefully.
 * ------------------------------------------------------------------ */

const globalForDb = globalThis as unknown as {
  __mixturePool?: Pool
  __mixtureDb?: ReturnType<typeof drizzle<typeof schema>>
}

export function isDatabaseConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0
}

function getPool(): Pool {
  if (!globalForDb.__mixturePool) {
    globalForDb.__mixturePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // serverless-friendly defaults: few connections, short idle life
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    })
  }
  return globalForDb.__mixturePool
}

/** the drizzle client; throws when DATABASE_URL is missing */
export function getDb() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured")
  }
  if (!globalForDb.__mixtureDb) {
    globalForDb.__mixtureDb = drizzle(getPool(), { schema })
  }
  return globalForDb.__mixtureDb
}
