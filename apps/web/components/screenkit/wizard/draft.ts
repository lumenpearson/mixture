import { normalizeHttpUrl } from "@/lib/media/url"
import { ASPECTS, DEVICES, STATUSES } from "@/lib/screenkit/data"
import { MAX_SOURCE_URL_LENGTH, isInsertKind, parseInsertSource } from "@/lib/screenkit/insert-kinds"
import type { AspectRatio, DeviceType, InsertKind, InsertSource, InsertStatus } from "@/lib/screenkit/types"

/* ------------------------------------------------------------------ *
 * the wizard draft
 *
 * Everything the creation wizard collects, in one flat object that is
 * saved to localStorage after every change (screenkit-wizard-draft-v1) so
 * a closed tab or a phone call does not lose the work.
 * ------------------------------------------------------------------ */

export const WIZARD_DRAFT_KEY = "screenkit-wizard-draft-v1"

export const WIZARD_STEPS = ["kind", "source", "identity", "texts", "review"] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export type WizardDraft = {
  version: 1
  step: WizardStep
  kind: InsertKind
  source: InsertSource
  /** the scene package chosen on the source step (scene kind only) */
  sceneKey: string
  titleRu: string
  titleEn: string
  slug: string
  category: string
  device: DeviceType
  aspect: AspectRatio
  status: InsertStatus
  episode: string
  scene: string
  date: string
  descriptionRu: string
  descriptionEn: string
  promptRu: string
  promptEn: string
  shortPromptRu: string
  shortPromptEn: string
  negativePromptRu: string
  negativePromptEn: string
  technicalNotesRu: string
  technicalNotesEn: string
  updatedAt: number
}

export type DraftDefaults = {
  category: string
  device: DeviceType
  aspect: AspectRatio
}

export function emptyDraft(defaults: DraftDefaults): WizardDraft {
  return {
    version: 1,
    step: "kind",
    kind: "scene",
    source: {},
    sceneKey: "",
    titleRu: "",
    titleEn: "",
    slug: "",
    category: defaults.category,
    device: defaults.device,
    aspect: defaults.aspect,
    status: "draft",
    episode: "ep-01",
    scene: "sc-01",
    date: new Date().toISOString().slice(0, 10),
    descriptionRu: "",
    descriptionEn: "",
    promptRu: "",
    promptEn: "",
    shortPromptRu: "",
    shortPromptEn: "",
    negativePromptRu: "",
    negativePromptEn: "",
    technicalNotesRu: "",
    technicalNotesEn: "",
    updatedAt: Date.now(),
  }
}

/** a draft counts as started once the user typed or picked anything */
export function isDraftStarted(draft: WizardDraft, defaults: DraftDefaults): boolean {
  const blank = emptyDraft(defaults)
  const keys = Object.keys(blank) as (keyof WizardDraft)[]
  return keys.some((key) => {
    if (key === "updatedAt" || key === "version" || key === "date") return false
    if (key === "source") return Object.keys(draft.source).length > 0
    return draft[key] !== blank[key]
  })
}

const DEVICE_IDS = DEVICES.map((device) => device.id)
const STATUS_IDS = STATUSES.map((status) => status.id)

const text = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback)

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(String(value)) ? (value as T) : fallback

/**
 * The source of a stored draft: the shape `parseInsertSource` accepts, with
 * the url kept as typed — the author may be halfway through "example.com",
 * and every consumer (the live preview, the review step, the submit) runs it
 * through `normalizeHttpUrl` before it reaches an element.
 */
function parseDraftSource(value: unknown): InsertSource {
  const parsed = parseInsertSource(value) ?? {}
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const url = text(raw.url).slice(0, MAX_SOURCE_URL_LENGTH)
  return url ? { ...parsed, url } : parsed
}

/**
 * A draft read back from an unstructured store, field by field. A truncated
 * write or a hand-edited value must not reach the dialog: `isDraftStarted`
 * reads `draft.source` and the steps read every string, so one missing field
 * used to kill the wizard on open — with the same draft still in storage.
 */
export function parseDraft(value: unknown, defaults: DraftDefaults): WizardDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (raw.version !== 1) return null
  const blank = emptyDraft(defaults)
  return {
    version: 1,
    step: oneOf(raw.step, WIZARD_STEPS, blank.step),
    kind: isInsertKind(raw.kind) ? raw.kind : blank.kind,
    source: parseDraftSource(raw.source),
    sceneKey: text(raw.sceneKey),
    titleRu: text(raw.titleRu),
    titleEn: text(raw.titleEn),
    slug: text(raw.slug),
    category: text(raw.category, blank.category),
    device: oneOf(raw.device, DEVICE_IDS, blank.device),
    aspect: oneOf(raw.aspect, ASPECTS, blank.aspect),
    status: oneOf(raw.status, STATUS_IDS, blank.status),
    episode: text(raw.episode, blank.episode),
    scene: text(raw.scene, blank.scene),
    date: text(raw.date, blank.date),
    descriptionRu: text(raw.descriptionRu),
    descriptionEn: text(raw.descriptionEn),
    promptRu: text(raw.promptRu),
    promptEn: text(raw.promptEn),
    shortPromptRu: text(raw.shortPromptRu),
    shortPromptEn: text(raw.shortPromptEn),
    negativePromptRu: text(raw.negativePromptRu),
    negativePromptEn: text(raw.negativePromptEn),
    technicalNotesRu: text(raw.technicalNotesRu),
    technicalNotesEn: text(raw.technicalNotesEn),
    updatedAt: typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
  }
}

export function loadDraft(defaults: DraftDefaults): WizardDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(WIZARD_DRAFT_KEY)
    if (!raw) return null
    return parseDraft(JSON.parse(raw), defaults)
  } catch {
    return null
  }
}

export function saveDraft(draft: WizardDraft) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }))
  } catch {
    // quota or private mode: the in-memory draft still works for this session
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(WIZARD_DRAFT_KEY)
  } catch {
    // ignore
  }
}

/** the i18n key of the first problem on a step, null when it is fine */
export function validateStep(draft: WizardDraft, step: WizardStep): string | null {
  switch (step) {
    case "source":
      if (draft.kind === "site" && !normalizeHttpUrl(draft.source.url)) return "wizard.error.url"
      if (draft.kind === "file" && !draft.source.path?.trim() && !normalizeHttpUrl(draft.source.url)) return "wizard.error.file"
      return null
    case "identity":
      if (!draft.titleRu.trim()) return "wizard.error.title"
      if (!draft.date.trim()) return "wizard.error.date"
      return null
    case "review":
      return validateStep(draft, "source") ?? validateStep(draft, "identity")
    default:
      return null
  }
}

export const splitLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

/** a url-safe slug from a title, for the slug placeholder */
export function suggestSlug(title: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l",
    м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
    щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  }
  return title
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}
