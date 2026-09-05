import { create } from "@bufbuild/protobuf"
import {
  ConfigSchema,
  Role as PbRole,
  Visibility as PbVisibility,
  type Config as PbConfig,
} from "@mixture/protocol/cloud"
import { z } from "zod"
import { matchGlob, normalizeCloudPath } from "./glob"

/* ------------------------------------------------------------------ *
 * cloud.config.json — visibility and access for the cloud drive
 *
 * The file lives in the root of the cloud repository next to the files it
 * governs, so the configuration is versioned with the data. Everything here
 * is pure: parsing, defaults and rule evaluation; no IO.
 * ------------------------------------------------------------------ */

export const CLOUD_CONFIG_FILE = "cloud.config.json"
export const CLOUD_KEEP_FILE = ".gitkeep"

export type VisibilityName = "private" | "public" | "hidden"
export type RoleName = "anonymous" | "viewer" | "editor" | "owner"

const visibilitySchema = z.enum(["private", "public", "hidden"])
const roleSchema = z.enum(["viewer", "editor", "owner"])
const login = z.string().trim().min(1).max(64)

export const cloudConfigSchema = z.object({
  version: z.literal(1).default(1),
  defaultVisibility: visibilitySchema.default("private"),
  rules: z
    .array(
      z.object({
        pattern: z.string().trim().min(1).max(200),
        visibility: visibilitySchema,
      }),
    )
    .max(200)
    .default([]),
  access: z
    .object({
      owners: z.array(login).max(50).default([]),
      editors: z.array(login).max(200).default([]),
      viewers: z.array(login).max(500).default([]),
      allowAnonymousPublic: z.boolean().default(true),
      keys: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(64),
            role: roleSchema,
            keyHash: z
              .string()
              .trim()
              .regex(/^(sha256:)?[0-9a-f]{64}$/i, "keyHash must be a sha256 hex digest"),
          }),
        )
        .max(100)
        .default([]),
    })
    .default({}),
})

export type CloudConfig = z.infer<typeof cloudConfigSchema>

export function defaultCloudConfig(owner: string): CloudConfig {
  return cloudConfigSchema.parse({
    version: 1,
    defaultVisibility: "private",
    rules: [
      { pattern: "public/**", visibility: "public" },
      { pattern: ".gitkeep", visibility: "hidden" },
    ],
    access: {
      owners: owner ? [owner] : [],
      editors: [],
      viewers: [],
      allowAnonymousPublic: true,
      keys: [],
    },
  })
}

/** parse the JSON text of cloud.config.json; falls back to defaults on damage */
export function parseCloudConfig(text: string, owner: string): { config: CloudConfig; error: string | null } {
  try {
    const parsed = cloudConfigSchema.parse(JSON.parse(text))
    return { config: parsed, error: null }
  } catch (error) {
    return {
      config: defaultCloudConfig(owner),
      error: error instanceof Error ? error.message : "invalid cloud.config.json",
    }
  }
}

export function serializeCloudConfig(config: CloudConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`
}

const ROLE_RANK: Record<RoleName, number> = { anonymous: 0, viewer: 1, editor: 2, owner: 3 }

export function roleAtLeast(role: RoleName, required: RoleName): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required]
}

export function maxRole(a: RoleName, b: RoleName): RoleName {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b
}

type RuleMatch = { visibility: VisibilityName; explicit: boolean }

/** the last rule matching this exact path, or the default when none does */
function ownRule(path: string, config: CloudConfig): RuleMatch {
  const clean = normalizeCloudPath(path)
  let visibility: VisibilityName = config.defaultVisibility
  let explicit = false
  for (const rule of config.rules) {
    if (matchGlob(rule.pattern, clean)) {
      visibility = rule.visibility
      explicit = true
    }
  }
  return { visibility, explicit }
}

/**
 * The visibility of a repository path, and whether a rule (not the default)
 * decided it.
 *
 * `hidden` is inherited downwards. A rule that names a folder (`secret`)
 * matches the folder and nothing else — gitignore-style patterns without a
 * slash match a name, not a subtree — so without inheritance hiding a folder
 * would hide its name while every file under it stayed readable to anyone who
 * guessed one. The nearest rule that names an ancestor decides: a later,
 * narrower rule (`secret/brief.pdf public`) still wins, so an opening in a
 * hidden folder stays expressible.
 */
export function visibilityRuleFor(path: string, config: CloudConfig): RuleMatch {
  const own = ownRule(path, config)
  if (own.explicit) return own
  const segments = normalizeCloudPath(path).split("/")
  for (let cut = segments.length - 1; cut > 0; cut -= 1) {
    const ancestor = ownRule(segments.slice(0, cut).join("/"), config)
    if (!ancestor.explicit) continue
    return ancestor.visibility === "hidden" ? { visibility: "hidden", explicit: true } : own
  }
  return own
}

/** the visibility of a repository path under the config rules (last match wins) */
export function visibilityFor(path: string, config: CloudConfig): VisibilityName {
  return visibilityRuleFor(path, config).visibility
}

const VISIBILITY_RANK: Record<VisibilityName, number> = { hidden: 0, private: 1, public: 2 }

/**
 * The visibility of a *folder*, which is not the visibility of its own path:
 * a folder exists to be walked into, so `public/**` has to keep the `public`
 * folder itself reachable even when the default is stricter.
 *
 * Three cases, in this order:
 *   1. a rule puts the folder itself in the hidden tree — it stays hidden,
 *      whatever its subtree says. Widening here is what used to make a folder
 *      unhideable: the subtree probe fell back to the (more permissive)
 *      default and undid the rule, and a folder name is often the secret;
 *   2. nothing names the folder: its subtree decides, so `public/** public`
 *      opens the folder and `secret/** hidden` closes it;
 *   3. both are named: the more permissive of the two wins, so a private
 *      folder holding a public subtree stays reachable.
 */
export function directoryVisibility(path: string, config: CloudConfig): VisibilityName {
  const own = visibilityRuleFor(path, config)
  // `${path}/*` stands for an arbitrary direct child: it matches the same
  // subtree rules a real child would
  const child = visibilityRuleFor(`${path}/*`, config)
  // `explicit` matters: `defaultVisibility: "hidden"` must not swallow the
  // `public/**` folder, or the files it opens could never be walked to
  if (own.explicit && own.visibility === "hidden") return "hidden"
  if (!own.explicit && child.explicit) return child.visibility
  return VISIBILITY_RANK[child.visibility] > VISIBILITY_RANK[own.visibility] ? child.visibility : own.visibility
}

/** whether a role may see (list and read) an entry with the given visibility */
export function canSee(role: RoleName, visibility: VisibilityName, config: CloudConfig): boolean {
  if (visibility === "hidden") return role === "owner"
  if (visibility === "public") {
    return role !== "anonymous" || config.access.allowAnonymousPublic
  }
  return roleAtLeast(role, "viewer")
}

/** the role a GitHub login gets from the access lists (not counting repo permissions) */
export function roleForLogin(loginName: string, config: CloudConfig): RoleName {
  const name = loginName.toLowerCase()
  const has = (list: string[]) => list.some((entry) => entry.toLowerCase() === name)
  if (has(config.access.owners)) return "owner"
  if (has(config.access.editors)) return "editor"
  if (has(config.access.viewers)) return "viewer"
  return "anonymous"
}

/** the role granted by a shared access key hash (sha256 hex of the raw key) */
export function roleForKeyHash(hash: string, config: CloudConfig): RoleName {
  const normalized = hash.toLowerCase().replace(/^sha256:/, "")
  const entry = config.access.keys.find(
    (key) => key.keyHash.toLowerCase().replace(/^sha256:/, "") === normalized,
  )
  return entry ? entry.role : "anonymous"
}

/* ------------------------------ proto mapping ------------------------------ */

const VIS_TO_PB: Record<VisibilityName, PbVisibility> = {
  private: PbVisibility.PRIVATE,
  public: PbVisibility.PUBLIC,
  hidden: PbVisibility.HIDDEN,
}
const VIS_FROM_PB = new Map<PbVisibility, VisibilityName>(
  (Object.keys(VIS_TO_PB) as VisibilityName[]).map((k) => [VIS_TO_PB[k], k]),
)

const ROLE_TO_PB: Record<RoleName, PbRole> = {
  anonymous: PbRole.ANONYMOUS,
  viewer: PbRole.VIEWER,
  editor: PbRole.EDITOR,
  owner: PbRole.OWNER,
}
const ROLE_FROM_PB = new Map<PbRole, RoleName>(
  (Object.keys(ROLE_TO_PB) as RoleName[]).map((k) => [ROLE_TO_PB[k], k]),
)

export const visibilityToPb = (v: VisibilityName) => VIS_TO_PB[v]
export const visibilityFromPb = (v: PbVisibility): VisibilityName => VIS_FROM_PB.get(v) ?? "private"
export const roleToPb = (r: RoleName) => ROLE_TO_PB[r]
export const roleFromPb = (r: PbRole): RoleName => ROLE_FROM_PB.get(r) ?? "anonymous"

export function configToPb(config: CloudConfig, redactKeys: boolean): PbConfig {
  return create(ConfigSchema, {
    version: config.version,
    defaultVisibility: visibilityToPb(config.defaultVisibility),
    rules: config.rules.map((rule) => ({ pattern: rule.pattern, visibility: visibilityToPb(rule.visibility) })),
    access: {
      owners: config.access.owners,
      editors: config.access.editors,
      viewers: config.access.viewers,
      allowAnonymousPublic: config.access.allowAnonymousPublic,
      keys: config.access.keys.map((key) => ({
        name: key.name,
        role: roleToPb(key.role),
        keyHash: redactKeys ? "" : key.keyHash,
      })),
    },
  })
}

/** proto -> config; throws a ZodError when the message is not a valid config */
export function configFromPb(pb: PbConfig, previous: CloudConfig): CloudConfig {
  return cloudConfigSchema.parse({
    version: 1,
    defaultVisibility: visibilityFromPb(pb.defaultVisibility),
    rules: pb.rules.map((rule) => ({ pattern: rule.pattern, visibility: visibilityFromPb(rule.visibility) })),
    access: {
      owners: pb.access?.owners ?? [],
      editors: pb.access?.editors ?? [],
      viewers: pb.access?.viewers ?? [],
      allowAnonymousPublic: pb.access?.allowAnonymousPublic ?? true,
      keys: (pb.access?.keys ?? []).map((key) => {
        const role = roleFromPb(key.role)
        // a redacted hash ("") keeps the previously stored value for that key name
        const keyHash = key.keyHash || previous.access.keys.find((k) => k.name === key.name)?.keyHash || ""
        return { name: key.name, role: role === "anonymous" ? "viewer" : role, keyHash }
      }),
    },
  })
}
