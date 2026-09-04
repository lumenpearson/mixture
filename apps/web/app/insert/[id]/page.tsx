import { ScreenState } from "@/components/screenkit/screen-state"
import { fetchLibrary } from "@/lib/screenkit/library.server"
import { notFound } from "next/navigation"

/* ------------------------------------------------------------------ *
 * the fullscreen screen state of one insert
 *
 * On the web this is rendered per request: an id may belong to a row added
 * through the library rpc, and that row exists only in the database.
 *
 * The desktop bundle is a static export, where a route is a file: the ids
 * that exist at build time — the built-in catalogue plus the generated
 * scene packages, the same set `fetchLibrary()` returns without
 * DATABASE_URL — are rendered ahead of time and nothing else is routable.
 * A custom insert therefore has no fullscreen page inside the shell; it is
 * still listed and previewed in the library like any other.
 * ------------------------------------------------------------------ */

const desktop = process.env.MIXTURE_DESKTOP_BUILD === "1"

/* Route segment config is parsed out of the source, not evaluated, so these
   two have to be literals: `scripts/build-desktop.mjs` rewrites them to
   "force-static" and false for the export and puts the file back afterwards.
   `generateStaticParams` is an ordinary function and can read the flag. */
export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function generateStaticParams() {
  if (!desktop) return []
  const { inserts } = await fetchLibrary()
  return inserts.map((insert) => ({ id: insert.id }))
}

export default async function InsertScreenStatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { inserts } = await fetchLibrary()
  const insert = inserts.find((i) => i.id === id)
  if (!insert) notFound()
  return <ScreenState insert={insert} />
}
