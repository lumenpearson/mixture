import {
  AspectRatio as PbAspectRatio,
  DeviceType as PbDeviceType,
  InsertStatus as PbInsertStatus,
  type LocalizedList as PbLocalizedList,
  type LocalizedText as PbLocalizedText,
} from "@mixture/protocol/common"
import type { CategoryDef as PbCategoryDef, Insert as PbInsert, Library as PbLibrary } from "@mixture/protocol/library"
import {
  EntryKind as PbEntryKind,
  Role as PbRole,
  type Entry as PbEntry,
  type Status as PbStatus,
} from "@mixture/protocol/cloud"
import type {
  AspectRatio,
  CategoryDef,
  CategoryId,
  DeviceType,
  Insert,
  InsertStatus,
  LocalizedList,
  LocalizedText,
} from "@screenkit/core"

/* ------------------------------------------------------------------ *
 * codec: mixture.*.v1 protobuf -> the domain shapes of @screenkit/core
 *
 * The read direction only. The app never builds an `Insert` message: the
 * one mutation it makes (`AddInsert`) takes flat scalar fields, so the
 * wizard sends those directly.
 *
 * Enum tables mirror apps/web/lib/rpc/codec.ts; keeping them side by side
 * means a new device or status is one line on each platform.
 * ------------------------------------------------------------------ */

const DEVICE_FROM_PB = new Map<PbDeviceType, DeviceType>([
  [PbDeviceType.PHONE, "phone"],
  [PbDeviceType.MONITOR, "monitor"],
  [PbDeviceType.TV, "tv"],
  [PbDeviceType.TABLET, "tablet"],
  [PbDeviceType.PROJECTOR, "projector"],
  [PbDeviceType.CCTV, "cctv"],
])

const ASPECT_FROM_PB = new Map<PbAspectRatio, AspectRatio>([
  [PbAspectRatio.ASPECT_RATIO_9_16, "9:16"],
  [PbAspectRatio.ASPECT_RATIO_16_9, "16:9"],
  [PbAspectRatio.ASPECT_RATIO_4_3, "4:3"],
  [PbAspectRatio.ASPECT_RATIO_16_10, "16:10"],
])

const STATUS_FROM_PB = new Map<PbInsertStatus, InsertStatus>([
  [PbInsertStatus.DRAFT, "draft"],
  [PbInsertStatus.READY, "ready"],
  [PbInsertStatus.NEEDS_REVIEW, "needs review"],
  [PbInsertStatus.SHOOTING, "shooting"],
])

export const DEVICE_TO_PB: Record<DeviceType, PbDeviceType> = {
  phone: PbDeviceType.PHONE,
  monitor: PbDeviceType.MONITOR,
  tv: PbDeviceType.TV,
  tablet: PbDeviceType.TABLET,
  projector: PbDeviceType.PROJECTOR,
  cctv: PbDeviceType.CCTV,
}

export const ASPECT_TO_PB: Record<AspectRatio, PbAspectRatio> = {
  "9:16": PbAspectRatio.ASPECT_RATIO_9_16,
  "16:9": PbAspectRatio.ASPECT_RATIO_16_9,
  "4:3": PbAspectRatio.ASPECT_RATIO_4_3,
  "16:10": PbAspectRatio.ASPECT_RATIO_16_10,
}

export const STATUS_TO_PB: Record<InsertStatus, PbInsertStatus> = {
  draft: PbInsertStatus.DRAFT,
  ready: PbInsertStatus.READY,
  "needs review": PbInsertStatus.NEEDS_REVIEW,
  shooting: PbInsertStatus.SHOOTING,
}

export const DEVICES: DeviceType[] = ["phone", "monitor", "tv", "tablet", "projector", "cctv"]
export const ASPECTS: AspectRatio[] = ["9:16", "16:9", "4:3", "16:10"]
export const STATUSES: InsertStatus[] = ["draft", "ready", "needs review", "shooting"]

function textFromPb(t: PbLocalizedText | undefined): LocalizedText {
  if (!t) return { ru: "" }
  return t.hasEn ? { ru: t.ru, en: t.en } : { ru: t.ru }
}

function listFromPb(l: PbLocalizedList | undefined): LocalizedList {
  if (!l) return { ru: [] }
  return l.hasEn ? { ru: l.ru, en: l.en } : { ru: l.ru }
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

export function insertFromPb(i: PbInsert): Insert {
  return {
    id: i.id,
    date: i.date,
    episode: i.episode,
    scene: i.scene,
    category: i.category as CategoryId,
    device: DEVICE_FROM_PB.get(i.device) ?? "phone",
    aspect: ASPECT_FROM_PB.get(i.aspect) ?? "9:16",
    status: STATUS_FROM_PB.get(i.status) ?? "draft",
    title: textFromPb(i.title),
    description: textFromPb(i.description),
    prompt: textFromPb(i.prompt),
    shortPrompt: textFromPb(i.shortPrompt),
    negativePrompt: textFromPb(i.negativePrompt),
    technicalNotes: listFromPb(i.technicalNotes),
    custom: i.custom ? true : undefined,
  }
}

export type LibraryData = {
  categories: CategoryDef[]
  inserts: Insert[]
  /** false when the server is running without a database */
  persistent: boolean
  /** true when the server requires an edit token for mutations */
  editLocked: boolean
}

export const EMPTY_LIBRARY: LibraryData = {
  categories: [],
  inserts: [],
  persistent: false,
  editLocked: false,
}

export function libraryFromPb(lib: PbLibrary | undefined): LibraryData {
  if (!lib) return EMPTY_LIBRARY
  return {
    categories: lib.categories.map(categoryFromPb),
    inserts: lib.inserts.map(insertFromPb),
    persistent: lib.persistent,
    editLocked: lib.editLocked,
  }
}

/* ------------------------------- cloud ------------------------------- */

export type CloudRole = "anonymous" | "viewer" | "editor" | "owner"

export const roleFromPb = (role: PbRole): CloudRole => {
  switch (role) {
    case PbRole.VIEWER:
      return "viewer"
    case PbRole.EDITOR:
      return "editor"
    case PbRole.OWNER:
      return "owner"
    default:
      return "anonymous"
  }
}

/** one row of the file manager, from either source */
export type FileEntry = {
  /** repository-relative posix path, or the SAF uri for a local file */
  path: string
  name: string
  directory: boolean
  size: number
  /** cloud blob sha, "" for local files */
  sha: string
  editable: boolean
  contentType: string
  downloadUrl: string
  source: "cloud" | "local"
}

export function entryFromPb(entry: PbEntry): FileEntry {
  return {
    path: entry.path,
    name: entry.name,
    directory: entry.kind === PbEntryKind.DIRECTORY,
    size: Number(entry.size),
    sha: entry.sha,
    editable: entry.editable,
    contentType: entry.contentType,
    downloadUrl: entry.downloadUrl,
    source: "cloud",
  }
}

export type CloudStatus = {
  configured: boolean
  repo: string
  branch: string
  login: string
  role: CloudRole
  message: string
  reachable: boolean
}

export const OFFLINE_STATUS: CloudStatus = {
  configured: false,
  repo: "",
  branch: "",
  login: "",
  role: "anonymous",
  message: "",
  reachable: false,
}

export function statusFromPb(status: PbStatus | undefined): CloudStatus {
  if (!status) return OFFLINE_STATUS
  return {
    configured: status.configured,
    repo: status.repo,
    branch: status.branch,
    login: status.login,
    role: roleFromPb(status.role),
    message: status.message,
    reachable: status.reachable,
  }
}
