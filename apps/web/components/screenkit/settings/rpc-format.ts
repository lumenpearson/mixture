/* ------------------------------------------------------------------ *
 * pure helpers for the connection settings card
 *
 * They live outside `rpc-settings.tsx` so the test can import them without
 * pulling in react, radix and the whole settings card.
 * ------------------------------------------------------------------ */

/**
 * replace `{name}` placeholders in a dictionary string.
 *
 * An unknown placeholder is left as written rather than blanked: a missing
 * value then shows up as `{ms}` in the interface instead of a silent gap.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  )
}

/**
 * the rows the log table shows: the newest `limit` entries, newest first.
 * `rpcLog.get()` is oldest-last, and the table reads top-down.
 */
export function recentCalls<T>(entries: readonly T[], limit: number): T[] {
  if (limit <= 0) return []
  return entries.slice(Math.max(0, entries.length - limit)).reverse()
}
