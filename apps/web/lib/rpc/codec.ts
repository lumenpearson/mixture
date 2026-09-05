import { create } from "@bufbuild/protobuf"
import {
  AspectRatio as PbAspectRatio,
  DeviceType as PbDeviceType,
  InsertStatus as PbInsertStatus,
  LocalizedListSchema,
  LocalizedTextSchema,
  type LocalizedList as PbLocalizedList,
  type LocalizedText as PbLocalizedText,
} from "@mixture/protocol/common"
import {
  CategoryDefSchema,
  InsertFit as PbInsertFit,
  InsertKind as PbInsertKind,
  InsertSchema,
  InsertSourceSchema,
  LibrarySchema,
  type CategoryDef as PbCategoryDef,
  type Insert as PbInsert,
  type InsertSource as PbInsertSource,
  type Library as PbLibrary,
} from "@mixture/protocol/library"
import type {
  AspectRatio,
  CategoryDef,
  CategoryId,
  DeviceType,
  Insert,
  InsertKind,
  InsertSource,
  InsertStatus,
  LocalizedList,
  LocalizedText,
} from "@/lib/screenkit/types"

/* ------------------------------------------------------------------ *
 * codec: domain types <-> mixture.*.v1 protobuf messages
 *
 * The domain keeps the plain TypeScript shapes the app has always used
 * (`@screenkit/core`), so every component stays unchanged; only the wire
 * format is protobuf. Enum tables live here so a new device or status is a
 * one-place change on each side.
 * ------------------------------------------------------------------ */

export type LibraryData = {
  categories: CategoryDef[]
  inserts: Insert[]
  /** false when the server is running without a database */
  persistent: boolean
  /** true when the server requires an edit token for mutations */
  editLocked: boolean
}

const DEVICE_TO_PB: Record<DeviceType, PbDeviceType> = {
  phone: PbDeviceType.PHONE,
  monitor: PbDeviceType.MONITOR,
  tv: PbDeviceType.TV,
  tablet: PbDeviceType.TABLET,
  projector: PbDeviceType.PROJECTOR,
  cctv: PbDeviceType.CCTV,
}

const ASPECT_TO_PB: Record<AspectRatio, PbAspectRatio> = {
  "9:16": PbAspectRatio.ASPECT_RATIO_9_16,
  "16:9": PbAspectRatio.ASPECT_RATIO_16_9,
  "4:3": PbAspectRatio.ASPECT_RATIO_4_3,
  "16:10": PbAspectRatio.ASPECT_RATIO_16_10,
}

const STATUS_TO_PB: Record<InsertStatus, PbInsertStatus> = {
  draft: PbInsertStatus.DRAFT,
  ready: PbInsertStatus.READY,
  "needs review": PbInsertStatus.NEEDS_REVIEW,
  shooting: PbInsertStatus.SHOOTING,
}

const KIND_TO_PB: Record<InsertKind, PbInsertKind> = {
  scene: PbInsertKind.SCENE,
  site: PbInsertKind.SITE,
  file: PbInsertKind.FILE,
}

type SourceFit = NonNullable<InsertSource["fit"]>

const FIT_TO_PB: Record<SourceFit, PbInsertFit> = {
  contain: PbInsertFit.CONTAIN,
  cover: PbInsertFit.COVER,
}

const invert = <K extends string, V extends number>(table: Record<K, V>) => {
  const out = new Map<V, K>()
  for (const key of Object.keys(table) as K[]) out.set(table[key], key)
  return out
}

const DEVICE_FROM_PB = invert(DEVICE_TO_PB)
const ASPECT_FROM_PB = invert(ASPECT_TO_PB)
const STATUS_FROM_PB = invert(STATUS_TO_PB)
const KIND_FROM_PB = invert(KIND_TO_PB)
const FIT_FROM_PB = invert(FIT_TO_PB)

export const deviceToPb = (d: DeviceType) => DEVICE_TO_PB[d]
export const aspectToPb = (a: AspectRatio) => ASPECT_TO_PB[a]
export const statusToPb = (s: InsertStatus) => STATUS_TO_PB[s]
/** an insert without an explicit kind goes on the wire as a packaged scene */
export const kindToPb = (k: InsertKind | undefined) => (k ? KIND_TO_PB[k] : PbInsertKind.SCENE)

/** null when the wire value is unknown / unspecified */
export const deviceFromPb = (d: PbDeviceType): DeviceType | null => DEVICE_FROM_PB.get(d) ?? null
export const aspectFromPb = (a: PbAspectRatio): AspectRatio | null => ASPECT_FROM_PB.get(a) ?? null
export const statusFromPb = (s: PbInsertStatus): InsertStatus | null => STATUS_FROM_PB.get(s) ?? null
export const kindFromPb = (k: PbInsertKind): InsertKind | null => KIND_FROM_PB.get(k) ?? null

export function sourceToPb(s: InsertSource): PbInsertSource {
  return create(InsertSourceSchema, {
    url: s.url,
    path: s.path,
    fit: s.fit ? FIT_TO_PB[s.fit] : PbInsertFit.UNSPECIFIED,
    zoom: s.zoom,
    scroll: s.scroll,
    autoplay: s.autoplay,
    loop: s.loop,
    muted: s.muted,
    background: s.background,
    sceneKey: s.sceneKey,
  })
}

/**
 * Every scalar of InsertSource carries explicit presence on the wire, so a
 * flag the author switched off survives as `false` while one never touched
 * stays absent — the per-kind defaults are `true` and would otherwise win.
 */
export function sourceFromPb(s: PbInsertSource | undefined): InsertSource {
  if (!s) return {}
  const out: InsertSource = {}
  if (s.url !== undefined) out.url = s.url
  if (s.path !== undefined) out.path = s.path
  const fit = FIT_FROM_PB.get(s.fit)
  if (fit) out.fit = fit
  if (s.zoom !== undefined) out.zoom = s.zoom
  if (s.scroll !== undefined) out.scroll = s.scroll
  if (s.autoplay !== undefined) out.autoplay = s.autoplay
  if (s.loop !== undefined) out.loop = s.loop
  if (s.muted !== undefined) out.muted = s.muted
  if (s.background !== undefined) out.background = s.background
  if (s.sceneKey !== undefined) out.sceneKey = s.sceneKey
  return out
}

export function textToPb(t: LocalizedText): PbLocalizedText {
  const hasEn = typeof t.en === "string"
  return create(LocalizedTextSchema, { ru: t.ru, en: hasEn ? t.en : "", hasEn })
}

export function textFromPb(t: PbLocalizedText | undefined): LocalizedText {
  if (!t) return { ru: "" }
  return t.hasEn ? { ru: t.ru, en: t.en } : { ru: t.ru }
}

export function listToPb(l: LocalizedList): PbLocalizedList {
  const hasEn = Array.isArray(l.en)
  return create(LocalizedListSchema, { ru: l.ru, en: hasEn ? l.en : [], hasEn })
}

export function listFromPb(l: PbLocalizedList | undefined): LocalizedList {
  if (!l) return { ru: [] }
  return l.hasEn ? { ru: l.ru, en: l.en } : { ru: l.ru }
}

export function categoryToPb(c: CategoryDef): PbCategoryDef {
  return create(CategoryDefSchema, {
    id: String(c.id),
    accent: c.accent,
    tint: c.tint,
    icon: c.icon ?? "",
    label: textToPb(c.label),
    custom: Boolean(c.custom),
  })
}

export function categoryFromPb(c: PbCategoryDef): CategoryDef {
  return {
    id: c.id as CategoryId,
    accent: c.accent,
    tint: c.tint,
    icon: c.icon ? c.icon : undefined,
    label: textFromPb(c.label),
    custom: c.custom ? true : undefined,
  }
}

export function insertToPb(i: Insert): PbInsert {
  return create(InsertSchema, {
    id: i.id,
    date: i.date,
    episode: i.episode,
    scene: i.scene,
    category: String(i.category),
    device: deviceToPb(i.device),
    aspect: aspectToPb(i.aspect),
    status: statusToPb(i.status),
    title: textToPb(i.title),
    description: textToPb(i.description),
    prompt: textToPb(i.prompt),
    shortPrompt: textToPb(i.shortPrompt),
    negativePrompt: textToPb(i.negativePrompt),
    technicalNotes: listToPb(i.technicalNotes),
    custom: Boolean(i.custom),
    kind: kindToPb(i.kind),
    source: i.source ? sourceToPb(i.source) : undefined,
  })
}

export function insertFromPb(i: PbInsert): Insert {
  return {
    id: i.id,
    date: i.date,
    episode: i.episode,
    scene: i.scene,
    category: i.category as CategoryId,
    device: deviceFromPb(i.device) ?? "phone",
    aspect: aspectFromPb(i.aspect) ?? "9:16",
    status: statusFromPb(i.status) ?? "draft",
    title: textFromPb(i.title),
    description: textFromPb(i.description),
    prompt: textFromPb(i.prompt),
    shortPrompt: textFromPb(i.shortPrompt),
    negativePrompt: textFromPb(i.negativePrompt),
    technicalNotes: listFromPb(i.technicalNotes),
    custom: i.custom ? true : undefined,
    // an unspecified kind is what inserts written before this field looked
    // like: a packaged scene
    kind: kindFromPb(i.kind) ?? "scene",
    source: i.source ? sourceFromPb(i.source) : undefined,
  }
}

export function libraryToPb(data: LibraryData): PbLibrary {
  return create(LibrarySchema, {
    categories: data.categories.map(categoryToPb),
    inserts: data.inserts.map(insertToPb),
    persistent: data.persistent,
    editLocked: data.editLocked,
  })
}

export function libraryFromPb(lib: PbLibrary | undefined): LibraryData {
  if (!lib) return { categories: [], inserts: [], persistent: false, editLocked: false }
  return {
    categories: lib.categories.map(categoryFromPb),
    inserts: lib.inserts.map(insertFromPb),
    persistent: lib.persistent,
    editLocked: lib.editLocked,
  }
}
