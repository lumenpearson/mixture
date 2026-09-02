"use client"

import * as React from "react"
import { toast } from "sonner"
import type {
  AspectRatio,
  CategoryDef,
  CategoryId,
  DeviceType,
  Insert,
  InsertStatus,
  Locale,
  PlaybackMode,
} from "@/lib/screenkit/types"
import {
  DEFAULT_CATEGORY_DEFS,
  INSERTS,
  categoryLabelFromDef,
  findCategoryDef,
  findInsert,
  hasEnglish,
} from "@/lib/screenkit/data"
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, translate } from "@/lib/screenkit/i18n"
import {
  EDIT_TOKEN_STORAGE_KEY,
  getEditToken,
  libraryClient,
  rpcErrorMessage,
  writeStorage,
} from "@/lib/rpc/client"
import {
  aspectToPb,
  deviceToPb,
  libraryFromPb,
  statusToPb,
  type LibraryData,
} from "@/lib/rpc/codec"
import {
  DEFAULT_LIBRARY_LIST_SETTINGS,
  LIBRARY_PAGE_SIZE_OPTIONS,
  type LibraryListSettings,
} from "./library-list-settings"

export type Section =
  | "overview"
  | "library"
  | "preview"
  | "timeline"
  | "prompts"
  | "style"
  | "cloud"
  | "about"

// each menu item gets its own explicitly-assigned url slug (no transliteration).
export const SECTION_SLUGS: Record<Section, string> = {
  overview: "overview",
  library: "library",
  preview: "preview",
  timeline: "changelog",
  prompts: "metadata",
  style: "appearance",
  cloud: "cloud",
  about: "info",
}

export function sectionFromSlug(slug?: string | null): Section | null {
  if (!slug) return null
  if (slug === "timeline") return "timeline"
  const entry = (Object.entries(SECTION_SLUGS) as [Section, string][]).find(
    ([, s]) => s === slug,
  )
  return entry ? entry[0] : null
}

/* ------------------------------------------------------------------ *
 * client-side library cache (stale-while-revalidate)
 * ------------------------------------------------------------------ */

const LIBRARY_CACHE_KEY = "screenkit-library-cache-v2"
const CONTENT_WIDTH_STORAGE_KEY = "screenkit-content-width-v1"
const FAVORITES_STORAGE_KEY = "screenkit-favorites-v1"
const LIBRARY_LIST_STORAGE_KEY = "screenkit-library-list-v1"

function readLibraryCache(): LibraryData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(LIBRARY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LibraryData
    if (parsed && Array.isArray(parsed.inserts) && Array.isArray(parsed.categories)) {
      return {
        categories: parsed.categories,
        inserts: parsed.inserts,
        persistent: Boolean(parsed.persistent),
        editLocked: Boolean(parsed.editLocked),
      }
    }
  } catch {
    // ignore
  }
  return null
}

function writeLibraryCache(data: LibraryData) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

function readFavorites(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

function readListSettings(): LibraryListSettings | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LIBRARY_LIST_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LibraryListSettings>
    const pageSize = (LIBRARY_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed.pageSize ?? 0)
      ? (parsed.pageSize as LibraryListSettings["pageSize"])
      : DEFAULT_LIBRARY_LIST_SETTINGS.pageSize
    return {
      sort: parsed.sort ?? DEFAULT_LIBRARY_LIST_SETTINGS.sort,
      view: parsed.view ?? DEFAULT_LIBRARY_LIST_SETTINGS.view,
      pageSize,
    }
  } catch {
    return null
  }
}

export type MessengerTheme = "dark" | "light"
export type MessengerVideoFormat = "mixed" | "vertical" | "horizontal" | "square"
export type ContentWidth = "narrow" | "default" | "wide"

export type PreviewSettings = {
  device: DeviceType
  mode: PlaybackMode
  aspect: AspectRatio
  brightness: number
  noise: number
  reflections: boolean
  scanlines: boolean
  timestamp: boolean
  // messenger-only controls (optional: scenes fall back to their defaults)
  messengerTheme?: MessengerTheme
  messengerMotion?: boolean
  messengerDelay?: number
  messengerVideoFormat?: MessengerVideoFormat
  messengerHiddenNumber?: boolean
}

export type Filters = {
  search: string
  category: CategoryId | "all"
  device: DeviceType | "all"
  status: InsertStatus | "all"
  favoritesOnly: boolean
}

export type NewCategoryInput = {
  labelRu: string
  labelEn?: string
  slug?: string
  accent?: string
  tint?: string
  icon?: string
}

export type NewInsertInput = {
  slug?: string
  category: string
  device: DeviceType
  aspect: AspectRatio
  status: InsertStatus
  episode: string
  scene: string
  date: string
  titleRu: string
  titleEn?: string
  descriptionRu?: string
  descriptionEn?: string
  promptRu?: string
  promptEn?: string
  shortPromptRu?: string
  shortPromptEn?: string
  negativePromptRu?: string
  negativePromptEn?: string
  technicalNotesRu?: string[]
  technicalNotesEn?: string[]
}

type Ctx = {
  section: Section
  setSection: (s: Section) => void

  selectedId: string
  setSelectedId: (id: string) => void

  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>

  libraryListSettings: LibraryListSettings
  setLibraryListSettings: React.Dispatch<React.SetStateAction<LibraryListSettings>>

  contentWidth: ContentWidth
  setContentWidth: (width: ContentWidth) => void

  preview: PreviewSettings
  setPreview: React.Dispatch<React.SetStateAction<PreviewSettings>>

  mobileNavOpen: boolean
  setMobileNavOpen: (v: boolean) => void

  openInPreview: (id: string) => void
  /** move the preview selection by ±n within the current library order */
  stepInsert: (delta: number) => void

  // dynamic, server-backed library data (defaults + custom)
  inserts: Insert[]
  categories: CategoryDef[]
  getInsert: (id: string) => Insert | undefined
  catDef: (id: CategoryId) => CategoryDef | undefined
  catLabel: (id: CategoryId) => string
  libraryBusy: boolean
  /** false when the deployment has no database: mutations are unavailable */
  persistent: boolean
  /** true when the server requires an edit token for mutations */
  editLocked: boolean
  editToken: string
  setEditToken: (token: string) => void
  addCategory: (input: NewCategoryInput) => Promise<void>
  addInsert: (input: NewInsertInput) => Promise<void>
  deleteInsert: (id: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  resetLibrary: () => Promise<void>
  refreshLibrary: () => Promise<void>
  hasCustom: boolean

  // favourites (local to this browser)
  favorites: ReadonlySet<string>
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void

  // site language (persisted)
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string

  // per-insert language override, independent of the site language
  insertLocaleOverrides: Record<string, Locale>
  setInsertLocale: (id: string, l: Locale) => void
  insertLocaleFor: (id: string) => Locale
}

const ScreenkitContext = React.createContext<Ctx | null>(null)

export function ScreenkitProvider({
  children,
  initialInserts,
  initialCategories,
  initialPersistent,
  initialEditLocked,
  initialSelectedId,
  initialView,
  initialCategory,
}: {
  children: React.ReactNode
  initialInserts?: Insert[]
  initialCategories?: CategoryDef[]
  initialPersistent?: boolean
  initialEditLocked?: boolean
  /** when provided, open straight into this insert's preview (deep link) */
  initialSelectedId?: string
  /** menu-item slug to open on load (?view=…) */
  initialView?: string
  /** library category slug to open on load (?cat=…) */
  initialCategory?: string
}) {
  const [inserts, setInserts] = React.useState<Insert[]>(initialInserts ?? INSERTS)
  const [categories, setCategories] = React.useState<CategoryDef[]>(
    initialCategories ?? DEFAULT_CATEGORY_DEFS,
  )
  const [persistent, setPersistent] = React.useState(Boolean(initialPersistent))
  const [editLocked, setEditLocked] = React.useState(Boolean(initialEditLocked))
  const [editToken, setEditTokenState] = React.useState("")
  const [libraryBusy, setLibraryBusy] = React.useState(false)

  const allInserts = initialInserts ?? INSERTS
  const allCategories = initialCategories ?? DEFAULT_CATEGORY_DEFS
  const deepLinked =
    initialSelectedId && allInserts.some((i) => i.id === initialSelectedId)
      ? initialSelectedId
      : null
  const viewSection = sectionFromSlug(initialView)
  const initialCat =
    initialCategory && allCategories.some((c) => c.id === initialCategory)
      ? (initialCategory as CategoryId)
      : "all"
  const [section, setSection] = React.useState<Section>(
    deepLinked ? "preview" : (viewSection ?? "overview"),
  )
  const [selectedId, setSelectedId] = React.useState<string>(
    deepLinked ?? allInserts[0]?.id ?? "",
  )
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE)
  const [contentWidth, setContentWidthState] = React.useState<ContentWidth>("default")
  const [insertLocaleOverrides, setInsertLocaleOverrides] = React.useState<
    Record<string, Locale>
  >({})
  const [favorites, setFavorites] = React.useState<ReadonlySet<string>>(() => new Set())

  const [filters, setFilters] = React.useState<Filters>({
    search: "",
    category: initialCat,
    device: "all",
    status: "all",
    favoritesOnly: false,
  })
  const [libraryListSettings, setLibraryListSettings] =
    React.useState<LibraryListSettings>(DEFAULT_LIBRARY_LIST_SETTINGS)

  const first =
    (deepLinked ? allInserts.find((i) => i.id === deepLinked) : null) ??
    allInserts[0]
  const [preview, setPreview] = React.useState<PreviewSettings>({
    device: first?.device ?? "phone",
    mode: "clean",
    aspect: first?.aspect ?? "9:16",
    brightness: 70,
    noise: 0,
    reflections: false,
    scanlines: false,
    timestamp: false,
    messengerTheme: "dark",
    messengerMotion: false,
    messengerDelay: 4,
    messengerVideoFormat: "mixed",
    messengerHiddenNumber: true,
  })

  // keep the url in sync with the active menu item so every section/category
  // is addressable by its own slug (no cyrillic transliteration involved).
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    params.set("view", SECTION_SLUGS[section])
    if (section !== "timeline") {
      for (const key of ["log", "sort", "page", "per", "branch", "author", "q"]) params.delete(key)
    }
    if (section !== "cloud") params.delete("path")
    if (section === "library" && filters.category !== "all") {
      params.set("cat", String(filters.category))
    } else {
      params.delete("cat")
    }
    if ((section === "preview" || section === "prompts") && selectedId) {
      params.set("insert", selectedId)
    } else {
      params.delete("insert")
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    )
  }, [section, filters.category, selectedId])

  // hydrate site locale, layout width, favourites and list settings from storage
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
      if (stored === "ru" || stored === "en") setLocaleState(stored)
      const width = window.localStorage.getItem(CONTENT_WIDTH_STORAGE_KEY)
      if (width === "narrow" || width === "default" || width === "wide") {
        setContentWidthState(width)
      }
    } catch {
      // ignore
    }
    setFavorites(new Set(readFavorites()))
    const list = readListSettings()
    if (list) setLibraryListSettings(list)
    setEditTokenState(getEditToken())
  }, [])

  // persist list settings whenever they change (after hydration)
  const listHydrated = React.useRef(false)
  React.useEffect(() => {
    if (!listHydrated.current) {
      listHydrated.current = true
      return
    }
    try {
      window.localStorage.setItem(LIBRARY_LIST_STORAGE_KEY, JSON.stringify(libraryListSettings))
    } catch {
      // ignore
    }
  }, [libraryListSettings])

  // keep <html lang> in step with the site language for assistive tech
  React.useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, l)
    } catch {
      // ignore
    }
  }, [])

  const setContentWidth = React.useCallback((width: ContentWidth) => {
    setContentWidthState(width)
    try {
      window.localStorage.setItem(CONTENT_WIDTH_STORAGE_KEY, width)
    } catch {
      // ignore
    }
  }, [])

  const setEditToken = React.useCallback((token: string) => {
    const clean = token.trim()
    setEditTokenState(clean)
    writeStorage(EDIT_TOKEN_STORAGE_KEY, clean)
  }, [])

  const t = React.useCallback((key: string) => translate(locale, key), [locale])

  const getInsert = React.useCallback(
    (id: string) => findInsert(inserts, id),
    [inserts],
  )
  const catDef = React.useCallback(
    (id: CategoryId) => findCategoryDef(categories, id),
    [categories],
  )
  const catLabel = React.useCallback(
    (id: CategoryId) => {
      const def = findCategoryDef(categories, id)
      return def ? categoryLabelFromDef(def, locale) : String(id)
    },
    [categories, locale],
  )

  const apply = React.useCallback((data: LibraryData) => {
    setCategories(data.categories)
    setInserts(data.inserts)
    setPersistent(data.persistent)
    setEditLocked(data.editLocked)
    writeLibraryCache(data)
  }, [])

  /* every mutation goes through the same wrapper: busy flag, apply the fresh
     library the server returns, surface failures as a toast and rethrow so
     the calling dialog can stay open */
  const mutate = React.useCallback(
    async (run: () => Promise<{ library?: Parameters<typeof libraryFromPb>[0] }>, fallback: string) => {
      setLibraryBusy(true)
      try {
        const response = await run()
        apply(libraryFromPb(response.library))
      } catch (error) {
        const message = rpcErrorMessage(error, fallback)
        toast.error(message)
        throw error
      } finally {
        setLibraryBusy(false)
      }
    },
    [apply],
  )

  const addCategory = React.useCallback(
    (input: NewCategoryInput) =>
      mutate(
        () =>
          libraryClient().addCategory({
            labelRu: input.labelRu,
            labelEn: input.labelEn ?? "",
            slug: input.slug ?? "",
            accent: input.accent ?? "",
            tint: input.tint ?? "",
            icon: input.icon ?? "",
          }),
        "could not add the category",
      ),
    [mutate],
  )

  const addInsert = React.useCallback(
    (input: NewInsertInput) =>
      mutate(
        () =>
          libraryClient().addInsert({
            slug: input.slug ?? "",
            category: input.category,
            device: deviceToPb(input.device),
            aspect: aspectToPb(input.aspect),
            status: statusToPb(input.status),
            episode: input.episode,
            scene: input.scene,
            date: input.date,
            titleRu: input.titleRu,
            titleEn: input.titleEn ?? "",
            descriptionRu: input.descriptionRu ?? "",
            descriptionEn: input.descriptionEn ?? "",
            promptRu: input.promptRu ?? "",
            promptEn: input.promptEn ?? "",
            shortPromptRu: input.shortPromptRu ?? "",
            shortPromptEn: input.shortPromptEn ?? "",
            negativePromptRu: input.negativePromptRu ?? "",
            negativePromptEn: input.negativePromptEn ?? "",
            technicalNotesRu: input.technicalNotesRu ?? [],
            technicalNotesEn: input.technicalNotesEn ?? [],
          }),
        "could not add the insert",
      ),
    [mutate],
  )

  const deleteInsert = React.useCallback(
    (id: string) => mutate(() => libraryClient().deleteInsert({ id }), "could not delete the insert"),
    [mutate],
  )

  const deleteCategory = React.useCallback(
    (id: string) => mutate(() => libraryClient().deleteCategory({ id }), "could not delete the category"),
    [mutate],
  )

  const resetLibrary = React.useCallback(
    () => mutate(() => libraryClient().resetLibrary({}), "could not reset the library"),
    [mutate],
  )

  const refreshLibrary = React.useCallback(async () => {
    try {
      const response = await libraryClient().getLibrary({})
      apply(libraryFromPb(response.library))
    } catch {
      // keep whatever we have; the next navigation retries
    }
  }, [apply])

  // keep data fresh on mount (in case props were stale / not provided)
  React.useEffect(() => {
    // server provided data -> just mirror it into the cache for later paints
    if (initialInserts && initialCategories) {
      writeLibraryCache({
        categories: allCategories,
        inserts: allInserts,
        persistent: Boolean(initialPersistent),
        editLocked: Boolean(initialEditLocked),
      })
      return
    }
    // no server data -> paint instantly from cache, then revalidate in the bg
    const cached = readLibraryCache()
    if (cached) apply(cached)
    void refreshLibrary()
    // allCategories / allInserts are derived from the (stable) initial props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, refreshLibrary, initialInserts, initialCategories])

  const setInsertLocale = React.useCallback((id: string, l: Locale) => {
    setInsertLocaleOverrides((prev) => ({ ...prev, [id]: l }))
  }, [])

  // resolve the language to use for a given insert's content:
  // explicit override wins, otherwise follow the site language,
  // but never request english on an insert that has no translation.
  const insertLocaleFor = React.useCallback(
    (id: string): Locale => {
      const insert = findInsert(inserts, id)
      const english = insert ? hasEnglish(insert) : false
      const wanted = insertLocaleOverrides[id] ?? locale
      return wanted === "en" && !english ? "ru" : wanted
    },
    [insertLocaleOverrides, locale, inserts],
  )

  const openInPreview = React.useCallback(
    (id: string) => {
      const insert = findInsert(inserts, id)
      setSelectedId(id)
      if (insert) {
        setPreview((p) => ({
          ...p,
          device: insert.device,
          aspect: insert.aspect,
        }))
      }
      setSection("preview")
      setMobileNavOpen(false)
    },
    [inserts],
  )

  const stepInsert = React.useCallback(
    (delta: number) => {
      if (!inserts.length) return
      const index = Math.max(0, inserts.findIndex((i) => i.id === selectedId))
      const next = inserts[(index + delta + inserts.length) % inserts.length]
      if (!next) return
      setSelectedId(next.id)
      setPreview((p) => ({ ...p, device: next.device, aspect: next.aspect }))
    },
    [inserts, selectedId],
  )

  const isFavorite = React.useCallback((id: string) => favorites.has(id), [favorites])

  const toggleFavorite = React.useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const hasCustom = React.useMemo(
    () => categories.some((c) => c.custom) || inserts.some((i) => i.custom),
    [categories, inserts],
  )

  const value: Ctx = {
    section,
    setSection,
    selectedId,
    setSelectedId,
    filters,
    setFilters,
    libraryListSettings,
    setLibraryListSettings,
    contentWidth,
    setContentWidth,
    preview,
    setPreview,
    mobileNavOpen,
    setMobileNavOpen,
    openInPreview,
    stepInsert,
    inserts,
    categories,
    getInsert,
    catDef,
    catLabel,
    libraryBusy,
    persistent,
    editLocked,
    editToken,
    setEditToken,
    addCategory,
    addInsert,
    deleteInsert,
    deleteCategory,
    resetLibrary,
    refreshLibrary,
    hasCustom,
    favorites,
    isFavorite,
    toggleFavorite,
    locale,
    setLocale,
    t,
    insertLocaleOverrides,
    setInsertLocale,
    insertLocaleFor,
  }

  return (
    <ScreenkitContext.Provider value={value}>
      {children}
    </ScreenkitContext.Provider>
  )
}

export function useScreenkit() {
  const ctx = React.useContext(ScreenkitContext)
  if (!ctx) throw new Error("useScreenkit must be used within ScreenkitProvider")
  return ctx
}
