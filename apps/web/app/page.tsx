import { AppShell } from "@/components/screenkit/app-shell"
import { fetchLibrary } from "@/lib/screenkit/library.server"

export const dynamic = "force-dynamic"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ insert?: string; view?: string; cat?: string }>
}) {
  const { inserts, categories, persistent, editLocked } = await fetchLibrary()
  const { insert, view, cat } = await searchParams
  return (
    <AppShell
      initialInserts={inserts}
      initialCategories={categories}
      initialPersistent={persistent}
      initialEditLocked={editLocked}
      initialSelectedId={insert}
      initialView={view}
      initialCategory={cat}
    />
  )
}
