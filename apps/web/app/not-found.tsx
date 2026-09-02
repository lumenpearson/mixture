import { AppShell } from "@/components/screenkit/app-shell"
import { fetchLibrary } from "@/lib/screenkit/library.server"

export default async function NotFound() {
  const { inserts, categories, persistent, editLocked } = await fetchLibrary()

  return (
    <AppShell
      initialInserts={inserts}
      initialCategories={categories}
      initialPersistent={persistent}
      initialEditLocked={editLocked}
      initialView="library"
      notFound
    />
  )
}
