import "server-only"
import { createHash } from "node:crypto"
import { create } from "@bufbuild/protobuf"
import { Code, ConnectError, type HandlerContext, type ServiceImpl } from "@connectrpc/connect"
import { z } from "zod"
import {
  CloudService,
  EntryKind,
  EntrySchema,
  StatusSchema,
  type Entry,
  type Status,
} from "@mixture/protocol/cloud"
import { CLOUD_KEY_HEADER, CLOUD_TOKEN_HEADER } from "../headers"
import { RPC_MAX_MESSAGE_BYTES } from "../limits"
import {
  CLOUD_CONFIG_FILE,
  CLOUD_KEEP_FILE,
  canSee,
  configFromPb,
  configToPb,
  defaultCloudConfig,
  maxRole,
  parseCloudConfig,
  roleAtLeast,
  roleForKeyHash,
  roleForLogin,
  roleToPb,
  serializeCloudConfig,
  visibilityFor,
  visibilityToPb,
  type CloudConfig,
  type RoleName,
  type VisibilityName,
} from "./config"
import { normalizeCloudPath } from "./glob"
import { GitHubRepo, toConnectError, viewerLogin, type GitHubFile } from "./github"

/* ------------------------------------------------------------------ *
 * CloudService — a cloud drive over a private GitHub repository
 *
 * Files live in the repository root; `cloud.config.json` next to them decides
 * who sees what. The server token (MIXTURE_CLOUD_GITHUB_TOKEN) performs the
 * repository operations for callers who bring no token of their own; a caller
 * with a GitHub token is identified through it, a caller with a shared access
 * key is identified through the key's sha256 in the config.
 * ------------------------------------------------------------------ */

const DEFAULT_REPO = "lumenpearson/mixture-cloud"
const DEFAULT_BRANCH = "main"
const INLINE_READ_LIMIT = 3 * 1024 * 1024
const MAX_TREE_CHANGES = 400
const MAX_PATH_LENGTH = 512
const CACHE_TTL_MS = 20_000

type Settings = { owner: string; repo: string; branch: string; serverToken: string; extraOwners: string[] }

function settings(): Settings {
  const raw = (process.env.MIXTURE_CLOUD_REPO ?? DEFAULT_REPO).trim()
  const [owner = "lumenpearson", repo = "mixture-cloud"] = raw.split("/")
  return {
    owner,
    repo,
    branch: (process.env.MIXTURE_CLOUD_BRANCH ?? DEFAULT_BRANCH).trim() || DEFAULT_BRANCH,
    serverToken: (process.env.MIXTURE_CLOUD_GITHUB_TOKEN ?? "").trim(),
    extraOwners: (process.env.MIXTURE_CLOUD_OWNERS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

type Session = {
  repo: GitHubRepo | null
  reachable: boolean
  login: string
  role: RoleName
  config: CloudConfig
  configSha: string
  message: string
}

type CachedRepo = {
  at: number
  reachable: boolean
  ownerLogin: string
  permissions: { admin: boolean; push: boolean; pull: boolean }
  config: CloudConfig
  configSha: string
  configError: string | null
}

const repoCache = new Map<string, CachedRepo>()

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

async function loadRepo(repo: GitHubRepo, ownerFallback: string, bust = false): Promise<CachedRepo> {
  const key = `${repo.owner}/${repo.repo}@${repo.branch}:${sha256(repo.token).slice(0, 16)}`
  const cached = repoCache.get(key)
  if (cached && !bust && Date.now() - cached.at < CACHE_TTL_MS) return cached

  const info = await repo.info()
  let config = defaultCloudConfig(ownerFallback)
  let configSha = ""
  let configError: string | null = null
  if (info) {
    const file = await repo.file(CLOUD_CONFIG_FILE).catch(() => null)
    if (file?.content) {
      const parsed = parseCloudConfig(Buffer.from(file.content, "base64").toString("utf8"), info.owner.login)
      config = parsed.config
      configError = parsed.error
      configSha = file.sha
    } else {
      config = defaultCloudConfig(info.owner.login)
    }
  }
  const entry: CachedRepo = {
    at: Date.now(),
    reachable: Boolean(info),
    ownerLogin: info?.owner.login ?? ownerFallback,
    permissions: {
      admin: Boolean(info?.permissions?.admin),
      push: Boolean(info?.permissions?.push),
      pull: Boolean(info?.permissions?.pull),
    },
    config,
    configSha,
    configError,
  }
  repoCache.set(key, entry)
  return entry
}

function invalidateRepoCache() {
  repoCache.clear()
}

async function resolveSession(ctx: HandlerContext): Promise<Session> {
  const cfg = settings()
  const callerToken = (ctx.requestHeader.get(CLOUD_TOKEN_HEADER) ?? "").trim()
  const callerKey = (ctx.requestHeader.get(CLOUD_KEY_HEADER) ?? "").trim()
  const token = callerToken || cfg.serverToken

  if (!token) {
    return {
      repo: null,
      reachable: false,
      login: "",
      role: "anonymous",
      config: defaultCloudConfig(cfg.owner),
      configSha: "",
      message: "no github token: set MIXTURE_CLOUD_GITHUB_TOKEN on the server or connect a token in the cloud tab",
    }
  }

  const repo = new GitHubRepo(token, cfg.owner, cfg.repo, cfg.branch)
  let loaded: CachedRepo
  try {
    loaded = await loadRepo(repo, cfg.owner)
  } catch (error) {
    throw toConnectError(error)
  }

  let login = ""
  let role: RoleName = "anonymous"

  if (callerToken) {
    try {
      login = await viewerLogin(callerToken)
    } catch (error) {
      throw toConnectError(error)
    }
    role = roleForLogin(login, loaded.config)
    const lower = login.toLowerCase()
    if (lower === loaded.ownerLogin.toLowerCase() || lower === cfg.owner.toLowerCase()) role = "owner"
    if (cfg.extraOwners.some((o) => o.toLowerCase() === lower)) role = "owner"
    // collaborator rights on the repository itself count as well
    if (loaded.permissions.admin) role = maxRole(role, "owner")
    else if (loaded.permissions.push) role = maxRole(role, "editor")
    else if (loaded.permissions.pull) role = maxRole(role, "viewer")
  } else if (callerKey) {
    const hash = sha256(callerKey)
    role = roleForKeyHash(hash, loaded.config)
    if (role === "anonymous") {
      throw new ConnectError("access key not recognised", Code.Unauthenticated)
    }
    const keyName = loaded.config.access.keys.find((k) => k.keyHash.replace(/^sha256:/, "").toLowerCase() === hash)?.name
    login = `key:${keyName ?? "?"}`
  }

  let message = ""
  if (!loaded.reachable) {
    message = `repository ${cfg.owner}/${cfg.repo} is not reachable with the current token`
  } else if (loaded.configError) {
    message = `cloud.config.json is invalid, defaults in effect: ${loaded.configError}`
  } else if (role === "anonymous" && !loaded.config.access.allowAnonymousPublic) {
    message = "sign in with a github token or an access key to see files"
  }

  return {
    repo: loaded.reachable ? repo : null,
    reachable: loaded.reachable,
    login,
    role,
    config: loaded.config,
    configSha: loaded.configSha,
    message,
  }
}

function statusOf(session: Session): Status {
  const cfg = settings()
  return create(StatusSchema, {
    configured: session.repo !== null || session.reachable,
    repo: `${cfg.owner}/${cfg.repo}`,
    branch: cfg.branch,
    login: session.login,
    role: roleToPb(session.role),
    message: session.message,
    reachable: session.reachable,
  })
}

function requireRepo(session: Session): GitHubRepo {
  if (!session.repo) {
    throw new ConnectError(session.message || "cloud repository is not configured", Code.FailedPrecondition)
  }
  return session.repo
}

function requireRole(session: Session, role: RoleName) {
  if (!roleAtLeast(session.role, role)) {
    throw new ConnectError(`this action needs the ${role} role`, Code.PermissionDenied)
  }
}

const CONTROL_CHARS = /[\x00-\x1f\x7f]/

function cleanPath(input: string, allowRoot: boolean): string {
  const path = normalizeCloudPath(input)
  if (!path) {
    if (allowRoot) return ""
    throw new ConnectError("path: required", Code.InvalidArgument)
  }
  if (path.length > MAX_PATH_LENGTH) throw new ConnectError("path: too long", Code.InvalidArgument)
  for (const segment of path.split("/")) {
    if (segment === ".." || segment === ".git" || CONTROL_CHARS.test(segment)) {
      throw new ConnectError("path: forbidden segment", Code.InvalidArgument)
    }
  }
  return path
}

function isSystemFile(path: string): boolean {
  const name = path.split("/").pop() ?? path
  return path === CLOUD_CONFIG_FILE || name === CLOUD_KEEP_FILE
}

function assertUserPath(path: string) {
  if (path === CLOUD_CONFIG_FILE) {
    throw new ConnectError("cloud.config.json is managed through the access settings", Code.InvalidArgument)
  }
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  json: "application/json",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  yaml: "text/yaml",
  yml: "text/yaml",
  ts: "text/typescript",
  tsx: "text/typescript",
  js: "text/javascript",
  css: "text/css",
  html: "text/html",
  zip: "application/zip",
}

export function contentTypeFor(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? ""
  return CONTENT_TYPES[ext] ?? "application/octet-stream"
}

/** directories inherit the most permissive visibility of their subtree rules */
function directoryVisibility(path: string, config: CloudConfig): VisibilityName {
  const own = visibilityFor(path, config)
  const child = visibilityFor(`${path}/*`, config)
  const rank: Record<VisibilityName, number> = { hidden: 0, private: 1, public: 2 }
  return rank[child] > rank[own] ? child : own
}

function toEntry(file: GitHubFile, session: Session): Entry | null {
  const isDir = file.type === "dir"
  const visibility = isDir ? directoryVisibility(file.path, session.config) : visibilityFor(file.path, session.config)
  if (!canSee(session.role, visibility, session.config)) return null
  return create(EntrySchema, {
    path: file.path,
    name: file.name,
    kind: isDir ? EntryKind.DIRECTORY : EntryKind.FILE,
    size: BigInt(file.size ?? 0),
    sha: file.sha,
    visibility: visibilityToPb(visibility),
    editable: roleAtLeast(session.role, "editor"),
    contentType: isDir ? "inode/directory" : contentTypeFor(file.name),
    downloadUrl: roleAtLeast(session.role, "viewer") ? (file.download_url ?? "") : "",
  })
}

function sortEntries(entries: Entry[]): Entry[] {
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === EntryKind.DIRECTORY ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
  })
}

function commitLabel(session: Session): string {
  return session.login ? ` [${session.login}]` : ""
}

function directoryEntry(path: string, session: Session): Entry {
  return create(EntrySchema, {
    path,
    name: path.split("/").pop() ?? path,
    kind: EntryKind.DIRECTORY,
    visibility: visibilityToPb(directoryVisibility(path, session.config)),
    editable: roleAtLeast(session.role, "editor"),
    contentType: "inode/directory",
  })
}

export const cloudServiceImpl: ServiceImpl<typeof CloudService> = {
  async getStatus(_req, ctx) {
    const session = await resolveSession(ctx)
    return { status: statusOf(session) }
  },

  async initRepository(req, ctx) {
    const cfg = settings()
    const callerToken = (ctx.requestHeader.get(CLOUD_TOKEN_HEADER) ?? "").trim()
    const token = callerToken || cfg.serverToken
    if (!token) {
      throw new ConnectError("a github token is required to create the cloud repository", Code.Unauthenticated)
    }
    const repo = new GitHubRepo(token, cfg.owner, cfg.repo, cfg.branch)
    try {
      // the token must belong to the configured owner; creating under another
      // account would silently produce a repository the app never reads
      const login = callerToken ? await viewerLogin(callerToken) : cfg.owner
      if (login.toLowerCase() !== cfg.owner.toLowerCase()) {
        throw new ConnectError(`the token belongs to ${login}, the cloud repository owner is ${cfg.owner}`, Code.PermissionDenied)
      }
      let created = false
      let htmlUrl = `https://github.com/${cfg.owner}/${cfg.repo}`
      const existing = await repo.info()
      if (!existing) {
        const result = await repo.createRepository(
          "Private cloud drive storage for mixture · screenkit (files in the root, access rules in cloud.config.json)",
          req.private || true,
        )
        htmlUrl = result.html_url
        created = true
      }
      // seed the default config (and a public folder) when they are missing
      const config = await repo.file(CLOUD_CONFIG_FILE)
      if (!config) {
        await repo.putFile(
          CLOUD_CONFIG_FILE,
          new TextEncoder().encode(serializeCloudConfig(defaultCloudConfig(cfg.owner))),
          "cloud: add default access config",
        )
        await repo.putFile(`public/${CLOUD_KEEP_FILE}`, new Uint8Array(), "cloud: create public folder").catch(() => null)
      }
      invalidateRepoCache()
      const session = await resolveSession(ctx)
      return { status: statusOf(session), created, htmlUrl }
    } catch (error) {
      throw toConnectError(error)
    }
  },

  async listEntries(req, ctx) {
    const session = await resolveSession(ctx)
    const path = cleanPath(req.path, true)
    if (!session.repo) {
      return { path, entries: [], status: statusOf(session) }
    }
    if (path && !canSee(session.role, directoryVisibility(path, session.config), session.config)) {
      throw new ConnectError("not found in the cloud repository", Code.NotFound)
    }
    let listing: GitHubFile[] | null
    try {
      listing = await session.repo.directory(path)
    } catch (error) {
      throw toConnectError(error)
    }
    if (!listing) {
      if (!path) return { path, entries: [], status: statusOf(session) }
      throw new ConnectError("folder not found", Code.NotFound)
    }
    const entries = listing
      .filter((file) => !isSystemFile(file.path))
      .map((file) => toEntry(file, session))
      .filter((entry): entry is Entry => entry !== null)
    return { path, entries: sortEntries(entries), status: statusOf(session) }
  },

  async getTree(req, ctx) {
    const session = await resolveSession(ctx)
    const repo = requireRepo(session)
    const prefix = cleanPath(req.prefix, true)
    try {
      const { sha, entries, truncated } = await repo.tree()
      const scope = prefix ? `${prefix}/` : ""
      const visible = entries
        .filter((e) => (e.type === "blob" || e.type === "tree") && (!scope || e.path.startsWith(scope)))
        .filter((e) => !isSystemFile(e.path))
        .map((e) =>
          toEntry(
            {
              type: e.type === "tree" ? "dir" : "file",
              name: e.path.split("/").pop() ?? e.path,
              path: e.path,
              sha: e.sha ?? "",
              size: e.size ?? 0,
              download_url: null,
            },
            session,
          ),
        )
        .filter((entry): entry is Entry => entry !== null)
      return { entries: sortEntries(visible), truncated, sha }
    } catch (error) {
      throw toConnectError(error)
    }
  },

  async statEntry(req, ctx) {
    const session = await resolveSession(ctx)
    const repo = requireRepo(session)
    const path = cleanPath(req.path, false)
    assertUserPath(path)
    let found: GitHubFile | GitHubFile[] | null
    try {
      found = await repo.contents(path)
    } catch (error) {
      throw toConnectError(error)
    }
    // a directory listing means the path is a folder: describe it from the
    // config rules instead of the (arbitrary) first child record
    if (Array.isArray(found)) {
      const entry = directoryEntry(path, session)
      if (!canSee(session.role, directoryVisibility(path, session.config), session.config)) {
        throw new ConnectError("not found in the cloud repository", Code.NotFound)
      }
      return { entry }
    }
    // an entry the caller may not see answers exactly like a missing one, so
    // stat cannot be used to probe for hidden paths
    const entry = found && !isSystemFile(found.path) ? toEntry(found, session) : null
    if (!entry) throw new ConnectError("not found in the cloud repository", Code.NotFound)
    return { entry }
  },

  async readFile(req, ctx) {
    const session = await resolveSession(ctx)
    const repo = requireRepo(session)
    const path = cleanPath(req.path, false)
    assertUserPath(path)
    let file: GitHubFile | null
    try {
      file = await repo.file(path)
    } catch (error) {
      throw toConnectError(error)
    }
    // an invisible file answers exactly like a missing one
    const entry = file ? toEntry(file, session) : null
    if (!file || !entry) throw new ConnectError("file not found", Code.NotFound)

    if (file.size > INLINE_READ_LIMIT) {
      return { entry, content: new Uint8Array(), truncated: true }
    }
    try {
      const content =
        file.content && file.encoding === "base64"
          ? new Uint8Array(Buffer.from(file.content, "base64"))
          : await repo.blob(file.sha)
      return { entry, content, truncated: false }
    } catch (error) {
      throw toConnectError(error)
    }
  },

  async writeFile(req, ctx) {
    const session = await resolveSession(ctx)
    const repo = requireRepo(session)
    requireRole(session, "editor")
    const path = cleanPath(req.path, false)
    assertUserPath(path)
    if (req.content.byteLength > RPC_MAX_MESSAGE_BYTES) {
      throw new ConnectError("file is larger than the upload limit", Code.InvalidArgument)
    }
    try {
      let sha = req.sha.trim()
      if (!sha) {
        const existing = await repo.file(path)
        sha = existing?.sha ?? ""
      }
      const message = req.message.trim() || `cloud: ${sha ? "update" : "upload"} ${path}${commitLabel(session)}`
      const result = await repo.putFile(path, req.content, message, sha || undefined)
      const entry = toEntry({ ...result.content, type: "file" }, session)
      return { entry: entry ?? undefined, commitSha: result.commit.sha }
    } catch (error) {
      throw toConnectError(error)
    }
  },

  async deleteEntry(req, ctx) {
    const session = await resolveSession(ctx)
    const repo = requireRepo(session)
    requireRole(session, "editor")
    const path = cleanPath(req.path, false)
    assertUserPath(path)
    try {
      const target = await repo.contents(path)
      if (!target) throw new ConnectError("not found in the cloud repository", Code.NotFound)
      if (!Array.isArray(target)) {
        const result = await repo.deleteFile(
          path,
          req.sha.trim() || target.sha,
          `cloud: delete ${path}${commitLabel(session)}`,
        )
        return { commitSha: result.commit.sha }
      }
      // a folder: one commit that drops every blob under it
      const { entries, truncated } = await repo.tree()
      const prefix = `${path}/`
      const blobs = entries.filter((e) => e.type === "blob" && e.path.startsWith(prefix))
      if (truncated || blobs.length > MAX_TREE_CHANGES) {
        throw new ConnectError("folder is too large to delete in one step", Code.ResourceExhausted)
      }
      if (blobs.length === 0) throw new ConnectError("folder not found", Code.NotFound)
      const commitSha = await repo.commitChanges(
        blobs.map((b) => ({ path: b.path, sha: null })),
        `cloud: delete folder ${path}${commitLabel(session)}`,
      )
      return { commitSha }
    } catch (error) {
      throw toConnectError(error)
    }
  },

  async moveEntry(req, ctx) {
    const session = await resolveSession(ctx)
    const repo = requireRepo(session)
    requireRole(session, "editor")
    const from = cleanPath(req.from, false)
    const to = cleanPath(req.to, false)
    assertUserPath(from)
    assertUserPath(to)
    if (from === to) throw new ConnectError("source and destination are the same", Code.InvalidArgument)
    if (to.startsWith(`${from}/`)) throw new ConnectError("cannot move a folder into itself", Code.InvalidArgument)
    try {
      const existing = await repo.contents(to)
      if (existing) throw new ConnectError("destination already exists", Code.AlreadyExists)
      const source = await repo.contents(from)
      if (!source) throw new ConnectError("not found in the cloud repository", Code.NotFound)

      if (!Array.isArray(source)) {
        await repo.commitChanges(
          [
            { path: to, sha: source.sha },
            { path: from, sha: null },
          ],
          `cloud: move ${from} -> ${to}${commitLabel(session)}`,
        )
        const moved = await repo.file(to)
        const entry = moved ? toEntry(moved, session) : null
        return { entry: entry ?? undefined }
      }

      const { entries, truncated } = await repo.tree()
      const prefix = `${from}/`
      const blobs = entries.filter((e) => e.type === "blob" && e.path.startsWith(prefix))
      if (truncated || blobs.length * 2 > MAX_TREE_CHANGES) {
        throw new ConnectError("folder is too large to move in one step", Code.ResourceExhausted)
      }
      await repo.commitChanges(
        blobs.flatMap((b) => [
          { path: `${to}/${b.path.slice(prefix.length)}`, sha: b.sha },
          { path: b.path, sha: null },
        ]),
        `cloud: move folder ${from} -> ${to}${commitLabel(session)}`,
      )
      return { entry: directoryEntry(to, session) }
    } catch (error) {
      throw toConnectError(error)
    }
  },

  async createDirectory(req, ctx) {
    const session = await resolveSession(ctx)
    const repo = requireRepo(session)
    requireRole(session, "editor")
    const path = cleanPath(req.path, false)
    try {
      const existing = await repo.contents(path)
      if (existing) throw new ConnectError("folder already exists", Code.AlreadyExists)
      await repo.putFile(
        `${path}/${CLOUD_KEEP_FILE}`,
        new Uint8Array(),
        `cloud: create folder ${path}${commitLabel(session)}`,
      )
      return { entry: directoryEntry(path, session) }
    } catch (error) {
      throw toConnectError(error)
    }
  },

  async getConfig(_req, ctx) {
    const session = await resolveSession(ctx)
    requireRepo(session)
    requireRole(session, "editor")
    return { config: configToPb(session.config, session.role !== "owner"), sha: session.configSha }
  },

  async updateConfig(req, ctx) {
    const session = await resolveSession(ctx)
    const repo = requireRepo(session)
    requireRole(session, "owner")
    if (!req.config) throw new ConnectError("config: required", Code.InvalidArgument)
    let next: CloudConfig
    try {
      next = configFromPb(req.config, session.config)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issue = error.issues[0]
        throw new ConnectError(`${issue?.path.join(".")}: ${issue?.message}`, Code.InvalidArgument)
      }
      throw error
    }
    // never let the last owner lock everyone out
    if (next.access.owners.length === 0) {
      next.access.owners = [session.login && !session.login.startsWith("key:") ? session.login : settings().owner]
    }
    const sha = req.sha.trim() || session.configSha
    try {
      const result = await repo.putFile(
        CLOUD_CONFIG_FILE,
        new TextEncoder().encode(serializeCloudConfig(next)),
        `cloud: update access config${commitLabel(session)}`,
        sha || undefined,
      )
      invalidateRepoCache()
      return { config: configToPb(next, false), sha: result.content.sha }
    } catch (error) {
      throw toConnectError(error)
    }
  },
}
