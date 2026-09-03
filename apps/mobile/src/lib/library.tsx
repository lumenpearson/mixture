import type { CategoryDef, Insert, Locale } from "@screenkit/core"
import * as React from "react"
import { useSettings } from "./settings"
import { libraryClient, rpcErrorMessage, setRpcConfig } from "./rpc/client"
import {
  ASPECT_TO_PB,
  DEVICE_TO_PB,
  EMPTY_LIBRARY,
  STATUS_TO_PB,
  libraryFromPb,
  type LibraryData,
} from "./rpc/codec"
import { KEYS, readJson, writeJson } from "./storage"

/* ------------------------------------------------------------------ *
 * the library
 *
 * The single caller of LibraryService, the same rule the web store
 * follows. The last successful answer is cached in AsyncStorage so the
 * list is on screen before the request finishes — a phone opens the app
 * on a train more often than a laptop does.
 * ------------------------------------------------------------------ */

export type AddInsertInput = {
  slug: string
  category: string
  device: Insert["device"]
  aspect: Insert["aspect"]
  status: Insert["status"]
  episode: string
  scene: string
  date: string
  titleRu: string
  titleEn: string
  descriptionRu: string
  descriptionEn: string
  promptRu: string
  promptEn: string
  shortPromptRu: string
  negativePromptRu: string
  technicalNotesRu: string[]
}

type LibraryValue = {
  data: LibraryData
  loading: boolean
  error: string
  favorites: string[]
  /** the insert the preview tab shows, "" when none was opened yet */
  selectedId: string
  select: (id: string) => void
  refresh: () => Promise<void>
  toggleFavorite: (id: string) => void
  addInsert: (input: AddInsertInput) => Promise<string>
  categoryOf: (id: string) => CategoryDef | undefined
  pick: (text: { ru: string; en?: string }) => string
}

const LibraryContext = React.createContext<LibraryValue | null>(null)

const CACHE_KEY = "screenkit-mobile-library-v1"

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { settings, ready } = useSettings()
  const [data, setData] = React.useState<LibraryData>(EMPTY_LIBRARY)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [favorites, setFavorites] = React.useState<string[]>([])
  const [selectedId, setSelectedId] = React.useState("")

  // every transport-shaped setting flows into the module-level rpc config
  // before any client call is made
  const rpcKey = [
    settings.rpcBaseUrl,
    settings.rpcFormat,
    settings.rpcTimeoutMs,
    settings.editToken,
    settings.cloudToken,
    settings.cloudKey,
  ].join("|")

  React.useEffect(() => {
    setRpcConfig({
      baseUrl: settings.rpcBaseUrl,
      format: settings.rpcFormat,
      timeoutMs: settings.rpcTimeoutMs,
      editToken: settings.editToken,
      cloudToken: settings.cloudToken,
      cloudKey: settings.cloudKey,
    })
  }, [
    settings.rpcBaseUrl,
    settings.rpcFormat,
    settings.rpcTimeoutMs,
    settings.editToken,
    settings.cloudToken,
    settings.cloudKey,
  ])

  React.useEffect(() => {
    void (async () => {
      const [cached, saved] = await Promise.all([
        readJson<LibraryData>(CACHE_KEY),
        readJson<string[]>(KEYS.favorites),
      ])
      if (cached) setData(cached)
      if (saved) setFavorites(saved)
    })()
  }, [])

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await libraryClient().getLibrary({})
      const next = libraryFromPb(response.library)
      setData(next)
      void writeJson(CACHE_KEY, next)
    } catch (caught) {
      setError(rpcErrorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!ready) return
    void refresh()
    // rpcKey covers every field the transport and the credentials are built
    // from; refresh itself is stable
  }, [ready, rpcKey, refresh])

  const toggleFavorite = React.useCallback((id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      void writeJson(KEYS.favorites, next)
      return next
    })
  }, [])

  const addInsert = React.useCallback(async (input: AddInsertInput) => {
    const response = await libraryClient().addInsert({
      slug: input.slug,
      category: input.category,
      device: DEVICE_TO_PB[input.device],
      aspect: ASPECT_TO_PB[input.aspect],
      status: STATUS_TO_PB[input.status],
      episode: input.episode,
      scene: input.scene,
      date: input.date,
      titleRu: input.titleRu,
      titleEn: input.titleEn,
      descriptionRu: input.descriptionRu,
      descriptionEn: input.descriptionEn,
      promptRu: input.promptRu,
      promptEn: input.promptEn,
      shortPromptRu: input.shortPromptRu,
      shortPromptEn: "",
      negativePromptRu: input.negativePromptRu,
      negativePromptEn: "",
      technicalNotesRu: input.technicalNotesRu,
      technicalNotesEn: [],
    })
    const next = libraryFromPb(response.library)
    setData(next)
    void writeJson(CACHE_KEY, next)
    return response.id
  }, [])

  const content: Locale = settings.locale === "en" ? "en" : "ru"

  const value = React.useMemo<LibraryValue>(
    () => ({
      data,
      loading,
      error,
      favorites,
      selectedId,
      select: setSelectedId,
      refresh,
      toggleFavorite,
      addInsert,
      categoryOf: (id) => data.categories.find((category) => String(category.id) === id),
      pick: (text) => (content === "en" ? (text.en ?? text.ru) : text.ru),
    }),
    [data, loading, error, favorites, selectedId, refresh, toggleFavorite, addInsert, content],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryValue {
  const value = React.useContext(LibraryContext)
  if (!value) throw new Error("useLibrary() outside LibraryProvider")
  return value
}
