import "server-only"
import { asc } from "drizzle-orm"
import { getDb, isDatabaseConfigured } from "@/lib/db"
import { screenkitCategories, screenkitInserts } from "@/lib/db/schema"
import type { LibraryData } from "@/lib/rpc/codec"
import { buildCategoryDefs, mergeInserts } from "./data"
import {
  GENERATED_INSERT_CATEGORIES,
  GENERATED_INSERTS,
} from "./generated-inserts"
import type {
  AspectRatio,
  CategoryDef,
  CategoryId,
  DeviceType,
  Insert,
  InsertStatus,
  LocalizedList,
  LocalizedText,
} from "./types"

const text = (ru: string, en: string | null): LocalizedText =>
  en && en.trim() ? { ru, en } : { ru }

const list = (ru: unknown, en: unknown): LocalizedList => {
  const r = Array.isArray(ru) ? (ru as string[]) : []
  const e = Array.isArray(en) ? (en as string[]) : null
  return e && e.length ? { ru: r, en: e } : { ru: r }
}

/** true when the server requires `x-mixture-edit-token` for mutations */
export function isEditLocked(): boolean {
  return typeof process.env.MIXTURE_EDIT_TOKEN === "string" && process.env.MIXTURE_EDIT_TOKEN.length > 0
}

export async function fetchCustomCategories(): Promise<CategoryDef[]> {
  const rows = await getDb()
    .select()
    .from(screenkitCategories)
    .orderBy(asc(screenkitCategories.createdAt))
  return rows.map((r) => ({
    id: r.id as CategoryId,
    accent: r.accentVar,
    tint: r.tint,
    icon: r.icon ?? undefined,
    label: text(r.labelRu, r.labelEn),
    custom: true,
  }))
}

export async function fetchCustomInserts(): Promise<Insert[]> {
  const rows = await getDb()
    .select()
    .from(screenkitInserts)
    .orderBy(asc(screenkitInserts.createdAt))
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    episode: r.episode,
    scene: r.scene,
    category: r.category as CategoryId,
    device: r.device as DeviceType,
    aspect: r.aspect as AspectRatio,
    status: r.status as InsertStatus,
    title: text(r.titleRu, r.titleEn),
    description: text(r.descriptionRu, r.descriptionEn),
    prompt: text(r.promptRu, r.promptEn),
    shortPrompt: text(r.shortPromptRu, r.shortPromptEn),
    negativePrompt: text(r.negativePromptRu, r.negativePromptEn),
    technicalNotes: list(r.technicalNotesRu, r.technicalNotesEn),
    custom: true,
  }))
}

/** the library that ships with the source tree (no database involved) */
export function builtInLibrary(): LibraryData {
  return {
    categories: buildCategoryDefs([...GENERATED_INSERT_CATEGORIES]),
    inserts: mergeInserts([...GENERATED_INSERTS]),
    persistent: false,
    editLocked: isEditLocked(),
  }
}

let warned = false

/**
 * Built-ins + generated packages + custom rows. Never throws: without a
 * database (or when it is unreachable) the built-in library is returned with
 * `persistent: false`, so pages, prerendering and the RPC layer keep working.
 */
export async function fetchLibrary(): Promise<LibraryData> {
  if (!isDatabaseConfigured()) return builtInLibrary()
  try {
    const [cats, ins] = await Promise.all([
      fetchCustomCategories(),
      fetchCustomInserts(),
    ])
    return {
      categories: buildCategoryDefs([...GENERATED_INSERT_CATEGORIES, ...cats]),
      inserts: mergeInserts([...GENERATED_INSERTS, ...ins]),
      persistent: true,
      editLocked: isEditLocked(),
    }
  } catch (error) {
    if (!warned) {
      warned = true
      console.warn(
        "[mixture] database unreachable, serving the built-in library only:",
        error instanceof Error ? error.message : error,
      )
    }
    return builtInLibrary()
  }
}
