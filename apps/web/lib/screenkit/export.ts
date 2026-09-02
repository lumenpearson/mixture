import { resolveInsert } from "./data"
import type { Insert, Locale, ResolvedInsert } from "./types"

/* ------------------------------------------------------------------ *
 * export helpers: prompt sheets as plain text and the whole library as json
 * ------------------------------------------------------------------ */

export function buildPromptSheet(insert: ResolvedInsert, locale: Locale): string {
  const lines = [
    `# ${insert.title}`,
    `id: ${insert.id}`,
    `episode / scene: ${insert.episode} · ${insert.scene}`,
    `date: ${insert.date}`,
    `device: ${insert.device} · ${insert.aspect} · ${insert.status}`,
    `language: ${locale}`,
    "",
    "## prompt",
    insert.prompt,
    "",
    "## short prompt",
    insert.shortPrompt,
    "",
    "## negative prompt",
    insert.negativePrompt,
    "",
    "## technical notes",
    ...insert.technicalNotes.map((note) => `- ${note}`),
    "",
  ]
  return lines.join("\n")
}

export function downloadText(filename: string, content: string, type = "text/plain") {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

/** every insert's resolved prompt sheet, as a json array */
export function exportPromptSheets(inserts: Insert[], locale: Locale) {
  const rows = inserts.map((insert) => {
    const resolved = resolveInsert(insert, locale)
    return {
      id: resolved.id,
      title: resolved.title,
      episode: resolved.episode,
      scene: resolved.scene,
      date: resolved.date,
      category: resolved.category,
      device: resolved.device,
      aspect: resolved.aspect,
      status: resolved.status,
      prompt: resolved.prompt,
      shortPrompt: resolved.shortPrompt,
      negativePrompt: resolved.negativePrompt,
      technicalNotes: resolved.technicalNotes,
    }
  })
  downloadText(`screenkit-prompts-${locale}.json`, `${JSON.stringify(rows, null, 2)}\n`, "application/json")
}
