import "server-only"
import { timingSafeEqual } from "node:crypto"
import { Code, ConnectError, type HandlerContext, type ServiceImpl } from "@connectrpc/connect"
import { count, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { LibraryService } from "@mixture/protocol/library"
import { getDb, isDatabaseConfigured } from "@/lib/db"
import { screenkitCategories, screenkitInserts } from "@/lib/db/schema"
import { DEFAULT_CATEGORY_DEFS, INSERTS } from "@/lib/screenkit/data"
import { GENERATED_INSERT_CATEGORIES, GENERATED_INSERTS } from "@/lib/screenkit/generated-inserts"
import { fetchLibrary, isEditLocked } from "@/lib/screenkit/library.server"
import { aspectFromPb, deviceFromPb, libraryToPb, statusFromPb } from "./codec"
import { EDIT_TOKEN_HEADER } from "./headers"

/* ------------------------------------------------------------------ *
 * LibraryService — the insert library over ConnectRPC / gRPC-Web
 *
 * Reads are public. Mutations are gated by MIXTURE_EDIT_TOKEN when it is
 * configured (the token travels in `x-mixture-edit-token`); without the
 * variable the library stays open for everyone, exactly as before.
 * ------------------------------------------------------------------ */

const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-я]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "item"

// a user-supplied slug is taken verbatim (lowercased, dash-separated) with no
// transliteration — only latin letters, digits and dashes survive. returns null
// when the cleaned result is empty so we can fall back to the derived slug.
export const customSlug = (s: string | null | undefined): string | null => {
  if (!s) return null
  const cleaned = s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return cleaned.length ? cleaned : null
}

const ACCENT_VARS = [
  "var(--accent-blue)",
  "var(--accent-cyan)",
  "var(--accent-purple)",
  "var(--accent-red)",
  "var(--accent-orange)",
  "var(--accent-green)",
  "var(--accent-grey)",
] as const

const nonEmpty = z.string().trim().min(1)
const optional = z
  .string()
  .trim()
  .transform((v) => (v.length ? v : null))

const categorySchema = z.object({
  labelRu: nonEmpty.max(40),
  labelEn: optional,
  slug: optional,
  accent: z.string().trim(),
  tint: z.string().trim(),
  icon: optional,
})

const insertSchema = z.object({
  slug: optional,
  category: nonEmpty.max(60),
  episode: nonEmpty.max(24),
  scene: nonEmpty.max(24),
  date: nonEmpty.max(24),
  titleRu: nonEmpty.max(120),
  titleEn: optional,
  descriptionRu: z.string().trim().max(400),
  descriptionEn: optional,
  promptRu: z.string().trim().max(2000),
  promptEn: optional,
  shortPromptRu: z.string().trim().max(400),
  shortPromptEn: optional,
  negativePromptRu: z.string().trim().max(800),
  negativePromptEn: optional,
  technicalNotesRu: z.array(z.string().trim().max(200)).max(20),
  technicalNotesEn: z.array(z.string().trim().max(200)).max(20),
})

/* only css variables from the accent palette or a hex / rgba literal may be
   stored as a category color — anything else would be injected into inline
   styles for every visitor */
const ACCENT_RE = /^(var\(--accent-[a-z]+\)|#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i

export function uniqueId(base: string, taken: Set<string>): string {
  let id = base
  let n = 2
  while (taken.has(id)) {
    id = `${base}-${n}`
    n += 1
  }
  return id
}

function assertEditAllowed(ctx: HandlerContext) {
  if (!isEditLocked()) return
  const expected = Buffer.from(process.env.MIXTURE_EDIT_TOKEN ?? "", "utf8")
  const provided = Buffer.from(ctx.requestHeader.get(EDIT_TOKEN_HEADER) ?? "", "utf8")
  const ok = expected.length > 0 && expected.length === provided.length && timingSafeEqual(expected, provided)
  if (!ok) {
    throw new ConnectError("edit token required", Code.PermissionDenied)
  }
}

function assertDatabase() {
  if (!isDatabaseConfigured()) {
    throw new ConnectError("database is not configured on this deployment", Code.FailedPrecondition)
  }
}

function invalid(error: unknown): never {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0]
    const path = issue?.path.join(".")
    throw new ConnectError(`${path ? `${path}: ` : ""}${issue?.message ?? "invalid input"}`, Code.InvalidArgument)
  }
  throw error
}

async function respond() {
  revalidatePath("/")
  return { library: libraryToPb(await fetchLibrary()) }
}

export const libraryServiceImpl: ServiceImpl<typeof LibraryService> = {
  async getLibrary() {
    return { library: libraryToPb(await fetchLibrary()) }
  },

  async addCategory(req, ctx) {
    assertEditAllowed(ctx)
    assertDatabase()
    let data: z.infer<typeof categorySchema>
    try {
      data = categorySchema.parse(req)
    } catch (error) {
      invalid(error)
    }
    if (data.accent && !ACCENT_RE.test(data.accent)) {
      throw new ConnectError("accent: unsupported color value", Code.InvalidArgument)
    }
    if (data.tint && !ACCENT_RE.test(data.tint)) {
      throw new ConnectError("tint: unsupported color value", Code.InvalidArgument)
    }

    const db = getDb()
    const existing = await db.select({ id: screenkitCategories.id }).from(screenkitCategories)
    const taken = new Set<string>([
      ...DEFAULT_CATEGORY_DEFS.map((c) => String(c.id)),
      ...GENERATED_INSERT_CATEGORIES.map((c) => String(c.id)),
      ...existing.map((c) => c.id),
    ])
    const id = uniqueId(customSlug(data.slug) ?? slug(data.labelEn ?? data.labelRu), taken)
    const accent = data.accent.length ? data.accent : ACCENT_VARS[taken.size % ACCENT_VARS.length]

    await db.insert(screenkitCategories).values({
      id,
      accentVar: accent,
      tint: data.tint.length ? data.tint : "rgba(255,255,255,0.06)",
      icon: data.icon,
      labelRu: data.labelRu,
      labelEn: data.labelEn,
    })

    return { ...(await respond()), id }
  },

  async addInsert(req, ctx) {
    assertEditAllowed(ctx)
    assertDatabase()
    let data: z.infer<typeof insertSchema>
    try {
      data = insertSchema.parse(req)
    } catch (error) {
      invalid(error)
    }
    const device = deviceFromPb(req.device)
    const aspect = aspectFromPb(req.aspect)
    const status = statusFromPb(req.status)
    if (!device) throw new ConnectError("device: unspecified", Code.InvalidArgument)
    if (!aspect) throw new ConnectError("aspect: unspecified", Code.InvalidArgument)
    if (!status) throw new ConnectError("status: unspecified", Code.InvalidArgument)

    const db = getDb()
    const [existing, categories] = await Promise.all([
      db.select({ id: screenkitInserts.id }).from(screenkitInserts),
      db.select({ id: screenkitCategories.id }).from(screenkitCategories),
    ])
    const knownCategories = new Set<string>([
      ...DEFAULT_CATEGORY_DEFS.map((c) => String(c.id)),
      ...GENERATED_INSERT_CATEGORIES.map((c) => String(c.id)),
      ...categories.map((c) => c.id),
    ])
    if (!knownCategories.has(data.category)) {
      throw new ConnectError("category: unknown category", Code.InvalidArgument)
    }
    const taken = new Set<string>([
      ...INSERTS.map((i) => i.id),
      ...GENERATED_INSERTS.map((i) => i.id),
      ...existing.map((i) => i.id),
    ])
    const id = uniqueId(customSlug(data.slug) ?? slug(data.titleEn ?? data.titleRu), taken)
    const notesRu = data.technicalNotesRu.filter(Boolean)
    const notesEn = data.technicalNotesEn.filter(Boolean)

    await db.insert(screenkitInserts).values({
      id,
      date: data.date,
      episode: data.episode,
      scene: data.scene,
      category: data.category,
      device,
      aspect,
      status,
      titleRu: data.titleRu,
      titleEn: data.titleEn,
      descriptionRu: data.descriptionRu,
      descriptionEn: data.descriptionEn,
      promptRu: data.promptRu,
      promptEn: data.promptEn,
      shortPromptRu: data.shortPromptRu,
      shortPromptEn: data.shortPromptEn,
      negativePromptRu: data.negativePromptRu,
      negativePromptEn: data.negativePromptEn,
      technicalNotesRu: notesRu,
      technicalNotesEn: notesEn.length ? notesEn : null,
    })

    return { ...(await respond()), id }
  },

  async deleteInsert(req, ctx) {
    assertEditAllowed(ctx)
    assertDatabase()
    const id = req.id.trim()
    if (!id) throw new ConnectError("id: required", Code.InvalidArgument)
    const result = await getDb().delete(screenkitInserts).where(eq(screenkitInserts.id, id))
    if (!result.rowCount) {
      throw new ConnectError("only inserts added on the site can be deleted", Code.NotFound)
    }
    return respond()
  },

  async deleteCategory(req, ctx) {
    assertEditAllowed(ctx)
    assertDatabase()
    const id = req.id.trim()
    if (!id) throw new ConnectError("id: required", Code.InvalidArgument)
    const db = getDb()
    const [{ used }] = await db
      .select({ used: count() })
      .from(screenkitInserts)
      .where(eq(screenkitInserts.category, id))
    if (used > 0) {
      throw new ConnectError("category still has inserts; delete them first", Code.FailedPrecondition)
    }
    const result = await db.delete(screenkitCategories).where(eq(screenkitCategories.id, id))
    if (!result.rowCount) {
      throw new ConnectError("only categories added on the site can be deleted", Code.NotFound)
    }
    return respond()
  },

  async resetLibrary(_req, ctx) {
    assertEditAllowed(ctx)
    assertDatabase()
    const db = getDb()
    await db.delete(screenkitInserts)
    await db.delete(screenkitCategories)
    return respond()
  },
}
