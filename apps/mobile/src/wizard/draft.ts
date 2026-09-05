import type { AspectRatio, DeviceType, InsertKind, InsertSource, InsertStatus } from "@screenkit/core"
import type { TKey } from "@/i18n"

/* ------------------------------------------------------------------ *
 * the wizard draft
 *
 * The same flat object apps/web/components/screenkit/wizard/draft.ts
 * keeps in localStorage, persisted here to AsyncStorage under the same
 * key. Five steps, one screen each; the draft survives the app being
 * killed mid-way, which on a phone is the normal case, not the edge one.
 * ------------------------------------------------------------------ */

export const WIZARD_STEPS = ["kind", "basics", "source", "prompts", "review"] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export type WizardDraft = {
  version: 1
  step: WizardStep
  kind: InsertKind
  source: InsertSource
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
  negativePromptRu: string
  technicalNotesRu: string
  updatedAt: number
}

export function emptyDraft(category = ""): WizardDraft {
  return {
    version: 1,
    step: "kind",
    kind: "scene",
    source: {},
    titleRu: "",
    titleEn: "",
    slug: "",
    category,
    device: "phone",
    aspect: "9:16",
    status: "draft",
    episode: "ep-01",
    scene: "sc-01",
    date: new Date().toISOString().slice(0, 10),
    descriptionRu: "",
    descriptionEn: "",
    promptRu: "",
    promptEn: "",
    shortPromptRu: "",
    negativePromptRu: "",
    technicalNotesRu: "",
    updatedAt: Date.now(),
  }
}

/** a draft counts as started once the user typed or picked anything */
export function isDraftStarted(draft: WizardDraft): boolean {
  const blank = emptyDraft(draft.category)
  const keys = Object.keys(blank) as (keyof WizardDraft)[]
  return keys.some((key) => {
    if (key === "updatedAt" || key === "version" || key === "date" || key === "category") return false
    if (key === "source") return Object.keys(draft.source).length > 0
    return draft[key] !== blank[key]
  })
}

/** accept bare hosts and refuse anything but http(s); "" when invalid */
export function normalizeHttpUrl(value: string | undefined): string {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(withScheme)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

/** the i18n key of the first problem on a step, null when it is fine */
export function validateStep(draft: WizardDraft, step: WizardStep): TKey | null {
  switch (step) {
    case "basics":
      if (!draft.titleRu.trim()) return "wizard.error.title"
      if (!draft.date.trim()) return "wizard.error.date"
      return null
    case "source":
      if (draft.kind === "site" && !normalizeHttpUrl(draft.source.url)) return "wizard.error.url"
      if (draft.kind === "file" && !draft.source.path?.trim() && !normalizeHttpUrl(draft.source.url))
        return "wizard.error.file"
      return null
    case "review":
      return validateStep(draft, "basics") ?? validateStep(draft, "source")
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
