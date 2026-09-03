import { Code, ConnectError, type HandlerContext } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import {
  CreateDirectoryRequestSchema,
  DeleteEntryRequestSchema,
  ListEntriesRequestSchema,
  MoveEntryRequestSchema,
  ReadFileRequestSchema,
  Role,
  StatEntryRequestSchema,
  WriteFileRequestSchema,
} from "@mixture/protocol/cloud"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CLOUD_KEY_HEADER, CLOUD_TOKEN_HEADER } from "../headers"
import type { CloudConfig } from "./config"

/* ------------------------------------------------------------------ *
 * CloudService — the decisions, not the network
 *
 * `service.ts` is the one place where a role, a path and a visibility are
 * enforced, so it is tested here against an in-memory stand-in for the GitHub
 * client: `./github` is mocked, every other module (config, glob, stream) is
 * the real one. The stub records every write and delete, so a test can prove
 * that a refused call never reached the repository at all.
 *
 * Every role or visibility case has its negative twin — the assertion that
 * fails when the check it guards is reverted.
 * ------------------------------------------------------------------ */

const OWNER = "acme"
const REPO = "drive"

type Files = Record<string, string>

type Recorder = {
  writes: string[]
  deletes: string[]
  commits: { paths: string[]; message: string }[]
}

const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64")
const shaOf = (path: string) => `sha-${path.replace(/[^a-z0-9]/gi, "-")}`

function githubStub(files: Files, recorder: Recorder, login: string) {
  const listOf = (path: string) => {
    const prefix = path ? `${path}/` : ""
    const names = new Set<string>()
    for (const key of Object.keys(files)) {
      if (!key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      if (!rest) continue
      names.add(rest.split("/")[0] as string)
    }
    return [...names].map((name) => {
      const full = `${prefix}${name}`
      const isDir = files[full] === undefined
      return {
        type: isDir ? "dir" : "file",
        name,
        path: full,
        sha: shaOf(full),
        size: isDir ? 0 : (files[full] as string).length,
        download_url: isDir ? null : `https://raw.example/${full}`,
      }
    })
  }

  class FakeRepo {
    constructor(
      readonly token: string,
      readonly owner: string,
      readonly repo: string,
      readonly branch: string,
    ) {}

    async info() {
      return {
        full_name: `${OWNER}/${REPO}`,
        private: true,
        default_branch: "main",
        owner: { login: OWNER },
        // no collaborator rights: the config access lists are what decides
        permissions: { admin: false, push: false, pull: false },
      }
    }

    async contents(path: string) {
      const content = files[path]
      if (content !== undefined) {
        return {
          type: "file",
          name: path.split("/").pop(),
          path,
          sha: shaOf(path),
          size: content.length,
          download_url: `https://raw.example/${path}`,
          encoding: "base64",
          content: b64(content),
        }
      }
      const listing = listOf(path)
      return listing.length ? listing : null
    }

    async file(path: string) {
      const found = await this.contents(path)
      return found && !Array.isArray(found) ? found : null
    }

    async directory(path: string) {
      const found = await this.contents(path)
      return Array.isArray(found) ? found : null
    }

    async blob(sha: string) {
      const entry = Object.entries(files).find(([path]) => shaOf(path) === sha)
      return new Uint8Array(Buffer.from(entry?.[1] ?? "", "utf8"))
    }

    async tree() {
      const entries = Object.keys(files).map((path) => ({
        path,
        mode: "100644",
        type: "blob",
        sha: shaOf(path),
        size: (files[path] as string).length,
      }))
      return { sha: "head", entries, truncated: false }
    }

    async putFile(path: string, content: Uint8Array, message: string) {
      recorder.writes.push(path)
      files[path] = Buffer.from(content).toString("utf8")
      return {
        content: { name: path.split("/").pop(), path, sha: shaOf(path), size: content.byteLength, download_url: null },
        commit: { sha: `commit-${recorder.writes.length}` },
      }
    }

    async deleteFile(path: string) {
      recorder.deletes.push(path)
      delete files[path]
      return { commit: { sha: `commit-delete-${recorder.deletes.length}` } }
    }

    async commitChanges(changes: { path: string; sha: string | null }[], message: string) {
      recorder.commits.push({ paths: changes.map((change) => change.path), message })
      for (const change of changes) {
        if (change.sha === null) delete files[change.path]
        else files[change.path] = "moved"
      }
      return "commit-tree"
    }

    async createRepository() {
      return { html_url: `https://github.com/${OWNER}/${REPO}` }
    }
  }

  return { FakeRepo, login }
}

type Caller = { token?: string; key?: string }

function context(caller: Caller): HandlerContext {
  const headers = new Headers()
  if (caller.token) headers.set(CLOUD_TOKEN_HEADER, caller.token)
  if (caller.key) headers.set(CLOUD_KEY_HEADER, caller.key)
  return { requestHeader: headers } as unknown as HandlerContext
}

type Service = typeof import("./service").cloudServiceImpl

/**
 * A fresh service module per scenario: `service.ts` caches the repository and
 * its config for 20 s per token, and a stale cache between cases would hide
 * exactly the decisions under test.
 */
async function loadService(options: {
  files?: Files
  config?: Partial<CloudConfig>
  login?: string
}): Promise<{ service: Service; recorder: Recorder; files: Files }> {
  const recorder: Recorder = { writes: [], deletes: [], commits: [] }
  const config = {
    version: 1,
    defaultVisibility: "private",
    rules: [],
    access: { owners: [OWNER], editors: [], viewers: [], allowAnonymousPublic: true, keys: [] },
    ...options.config,
  }
  const files: Files = { "cloud.config.json": JSON.stringify(config), ...options.files }

  vi.resetModules()
  vi.doMock("server-only", () => ({}))
  vi.doMock("./github", async () => {
    const actual = await vi.importActual<typeof import("./github")>("./github")
    const { FakeRepo } = githubStub(files, recorder, options.login ?? "")
    return { ...actual, GitHubRepo: FakeRepo, viewerLogin: async () => options.login ?? "" }
  })

  const { cloudServiceImpl } = await import("./service")
  return { service: cloudServiceImpl, recorder, files }
}

const codeOf = async (call: Promise<unknown>): Promise<Code | undefined> => {
  try {
    await call
    return undefined
  } catch (error) {
    return error instanceof ConnectError ? error.code : undefined
  }
}

beforeEach(() => {
  vi.stubEnv("MIXTURE_CLOUD_REPO", `${OWNER}/${REPO}`)
  vi.stubEnv("MIXTURE_CLOUD_BRANCH", "main")
  vi.stubEnv("MIXTURE_CLOUD_GITHUB_TOKEN", "server-token")
  vi.stubEnv("MIXTURE_CLOUD_OWNERS", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock("./github")
  vi.doUnmock("server-only")
})

/* ------------------------------ paths ------------------------------ */

describe("path validation", () => {
  const cases: [string, string][] = [
    ["traversal", "../etc/passwd"],
    ["the git directory", ".git/config"],
    ["the git directory in any case", ".GIT/hooks/pre-commit"],
    ["a control character", "renders/a\u0007.png"],
    ["an over-long path", `${"a".repeat(513)}.png`],
  ]

  for (const [label, path] of cases) {
    it(`refuses ${label} before any github call`, async () => {
      const { service, recorder } = await loadService({ login: OWNER })
      expect(await codeOf(service.statEntry(create(StatEntryRequestSchema, { path }), context({ token: "t" })))).toBe(
        Code.InvalidArgument,
      )
      expect(recorder.writes).toEqual([])
    })
  }

  // the negative twin of the loop above: an ordinary path is not refused
  it("accepts an ordinary path", async () => {
    const { service } = await loadService({ files: { "renders/a.png": "x" }, login: OWNER })
    const response = await service.statEntry(
      create(StatEntryRequestSchema, { path: "renders/a.png" }),
      context({ token: "t" }),
    )
    expect(response.entry?.path).toBe("renders/a.png")
  })

  it("refuses to touch cloud.config.json as a file", async () => {
    const { service, recorder } = await loadService({ login: OWNER })
    const request = create(WriteFileRequestSchema, { path: "cloud.config.json", content: new Uint8Array([1]) })
    expect(await codeOf(service.writeFile(request, context({ token: "t" })))).toBe(Code.InvalidArgument)
    expect(recorder.writes).toEqual([])
  })
})

/* ------------------------------ roles ------------------------------ */

describe("roles", () => {
  const files = { "renders/a.png": "bytes" }
  const viewerConfig = { access: { owners: [OWNER], editors: [], viewers: ["watcher"], allowAnonymousPublic: true, keys: [] } }

  it("lets a viewer read and refuses every mutation", async () => {
    const { service, recorder } = await loadService({ files, config: viewerConfig, login: "watcher" })
    const caller = context({ token: "t" })
    const read = await service.readFile(create(ReadFileRequestSchema, { path: "renders/a.png" }), caller)
    expect(Buffer.from(read.content).toString("utf8")).toBe("bytes")

    const write = service.writeFile(
      create(WriteFileRequestSchema, { path: "renders/a.png", content: new Uint8Array([1]) }),
      caller,
    )
    expect(await codeOf(write)).toBe(Code.PermissionDenied)
    expect(
      await codeOf(service.deleteEntry(create(DeleteEntryRequestSchema, { path: "renders/a.png" }), caller)),
    ).toBe(Code.PermissionDenied)
    expect(
      await codeOf(service.createDirectory(create(CreateDirectoryRequestSchema, { path: "new" }), caller)),
    ).toBe(Code.PermissionDenied)
    // nothing reached the repository
    expect(recorder.writes).toEqual([])
    expect(recorder.deletes).toEqual([])
  })

  // the negative twin: the same call from an editor goes through, so the
  // refusals above are the role check and not a broken stub
  it("lets an editor write", async () => {
    const { service, recorder } = await loadService({
      files,
      config: { access: { owners: [OWNER], editors: ["hand"], viewers: [], allowAnonymousPublic: true, keys: [] } },
      login: "hand",
    })
    const response = await service.writeFile(
      create(WriteFileRequestSchema, { path: "renders/b.png", content: new Uint8Array([1, 2]) }),
      context({ token: "t" }),
    )
    expect(response.entry?.path).toBe("renders/b.png")
    expect(recorder.writes).toEqual(["renders/b.png"])
  })

  it("reports the caller's role in the status", async () => {
    const { service } = await loadService({ config: viewerConfig, login: "watcher" })
    const status = await service.getStatus({ $typeName: "mixture.cloud.v1.GetStatusRequest" }, context({ token: "t" }))
    expect(status.status?.role).toBe(Role.VIEWER)
    expect(status.status?.login).toBe("watcher")
  })
})

/* ---------------------------- visibility ---------------------------- */

describe("hidden entries answer like missing ones", () => {
  const hidden = {
    files: { "private/notes.txt": "secret", "public/a.png": "bytes" },
    config: {
      rules: [
        { pattern: "public/**", visibility: "public" as const },
        { pattern: "private/**", visibility: "hidden" as const },
      ],
      access: { owners: [OWNER], editors: ["hand"], viewers: [], allowAnonymousPublic: true, keys: [] },
    },
    login: "hand",
  }

  it("hides the entry from stat, read and the listing", async () => {
    const { service } = await loadService(hidden)
    const caller = context({ token: "t" })
    expect(
      await codeOf(service.statEntry(create(StatEntryRequestSchema, { path: "private/notes.txt" }), caller)),
    ).toBe(Code.NotFound)
    expect(await codeOf(service.readFile(create(ReadFileRequestSchema, { path: "private/notes.txt" }), caller))).toBe(
      Code.NotFound,
    )
    const listing = await service.listEntries(create(ListEntriesRequestSchema, { path: "" }), caller)
    expect(listing.entries.map((entry) => entry.path)).toEqual(["public"])
  })

  it("refuses to overwrite, delete or move a hidden entry, and touches nothing", async () => {
    const { service, recorder } = await loadService(hidden)
    const caller = context({ token: "t" })
    expect(
      await codeOf(
        service.writeFile(
          create(WriteFileRequestSchema, { path: "private/notes.txt", content: new Uint8Array([1]) }),
          caller,
        ),
      ),
    ).toBe(Code.NotFound)
    expect(
      await codeOf(service.deleteEntry(create(DeleteEntryRequestSchema, { path: "private/notes.txt" }), caller)),
    ).toBe(Code.NotFound)
    expect(
      await codeOf(service.moveEntry(create(MoveEntryRequestSchema, { from: "private/notes.txt", to: "b.txt" }), caller)),
    ).toBe(Code.NotFound)
    expect(recorder.writes).toEqual([])
    expect(recorder.deletes).toEqual([])
    expect(recorder.commits).toEqual([])
  })

  it("answers a hidden move destination exactly like a free one", async () => {
    const { service } = await loadService(hidden)
    const caller = context({ token: "t" })
    const taken = await codeOf(
      service.moveEntry(create(MoveEntryRequestSchema, { from: "public/a.png", to: "private/notes.txt" }), caller),
    )
    const free = await codeOf(
      service.moveEntry(create(MoveEntryRequestSchema, { from: "public/a.png", to: "private/nothing.txt" }), caller),
    )
    // an existence oracle would answer already_exists for one and not_found
    // for the other
    expect(taken).toBe(Code.NotFound)
    expect(free).toBe(Code.NotFound)
  })

  it("refuses a folder inside the hidden tree", async () => {
    const { service, recorder } = await loadService(hidden)
    expect(
      await codeOf(service.createDirectory(create(CreateDirectoryRequestSchema, { path: "private/new" }), context({ token: "t" }))),
    ).toBe(Code.NotFound)
    expect(recorder.writes).toEqual([])
  })

  // the negative twin: the owner sees and edits the same paths, so the
  // refusals above are the visibility gate and not a broken path
  it("lets the owner read and edit the hidden tree", async () => {
    const { service, recorder } = await loadService({ ...hidden, login: OWNER })
    const caller = context({ token: "t" })
    const stat = await service.statEntry(create(StatEntryRequestSchema, { path: "private/notes.txt" }), caller)
    expect(stat.entry?.path).toBe("private/notes.txt")
    await service.writeFile(
      create(WriteFileRequestSchema, { path: "private/notes.txt", content: new Uint8Array([1]) }),
      caller,
    )
    expect(recorder.writes).toEqual(["private/notes.txt"])
  })

  it("hides a folder named by a hidden rule from the listing and from ListEntries", async () => {
    const { service } = await loadService({
      files: { "secret/plan.txt": "x", "public/a.png": "y" },
      config: {
        rules: [
          { pattern: "public/**", visibility: "public" as const },
          { pattern: "secret", visibility: "hidden" as const },
          { pattern: "secret/**", visibility: "hidden" as const },
        ],
        access: { owners: [OWNER], editors: [], viewers: ["watcher"], allowAnonymousPublic: true, keys: [] },
      },
      login: "watcher",
    })
    const caller = context({ token: "t" })
    const root = await service.listEntries(create(ListEntriesRequestSchema, { path: "" }), caller)
    expect(root.entries.map((entry) => entry.name)).not.toContain("secret")
    expect(await codeOf(service.listEntries(create(ListEntriesRequestSchema, { path: "secret" }), caller))).toBe(
      Code.NotFound,
    )
  })
})

/* ------------------------------ anonymous ------------------------------ */

describe("anonymous callers", () => {
  it("see public files and nothing else", async () => {
    const { service } = await loadService({
      files: { "public/a.png": "x", "renders/b.png": "y" },
      config: { rules: [{ pattern: "public/**", visibility: "public" as const }] },
    })
    const caller = context({})
    const listing = await service.listEntries(create(ListEntriesRequestSchema, { path: "" }), caller)
    expect(listing.entries.map((entry) => entry.name)).toEqual(["public"])
    expect(await codeOf(service.readFile(create(ReadFileRequestSchema, { path: "renders/b.png" }), caller))).toBe(
      Code.NotFound,
    )
  })

  // the negative twin: with allowAnonymousPublic off even the public file goes
  it("see nothing when allowAnonymousPublic is off", async () => {
    const { service } = await loadService({
      files: { "public/a.png": "x" },
      config: {
        rules: [{ pattern: "public/**", visibility: "public" as const }],
        access: { owners: [OWNER], editors: [], viewers: [], allowAnonymousPublic: false, keys: [] },
      },
    })
    const caller = context({})
    const listing = await service.listEntries(create(ListEntriesRequestSchema, { path: "" }), caller)
    expect(listing.entries).toEqual([])
    expect(await codeOf(service.readFile(create(ReadFileRequestSchema, { path: "public/a.png" }), caller))).toBe(
      Code.NotFound,
    )
  })

  it("never receive a download url", async () => {
    const { service } = await loadService({
      files: { "public/a.png": "x" },
      config: { rules: [{ pattern: "public/**", visibility: "public" as const }] },
    })
    const listing = await service.listEntries(create(ListEntriesRequestSchema, { path: "public" }), context({}))
    expect(listing.entries[0]?.downloadUrl).toBe("")
  })
})

/* ------------------------------ config ------------------------------ */

describe("cloud.config.json", () => {
  it("is not listed as a file", async () => {
    const { service } = await loadService({ files: { "a.png": "x" }, login: OWNER })
    const listing = await service.listEntries(create(ListEntriesRequestSchema, { path: "" }), context({ token: "t" }))
    expect(listing.entries.map((entry) => entry.name)).toEqual(["a.png"])
  })

  it("needs the owner role to be written", async () => {
    const { service, recorder } = await loadService({
      config: { access: { owners: [OWNER], editors: ["hand"], viewers: [], allowAnonymousPublic: true, keys: [] } },
      login: "hand",
    })
    const caller = context({ token: "t" })
    const config = await service.getConfig({ $typeName: "mixture.cloud.v1.GetConfigRequest" }, caller)
    expect(config.config).toBeDefined()
    expect(
      await codeOf(
        service.updateConfig(
          { $typeName: "mixture.cloud.v1.UpdateConfigRequest", config: config.config, sha: "" },
          caller,
        ),
      ),
    ).toBe(Code.PermissionDenied)
    expect(recorder.writes).toEqual([])
  })

  it("never lets the last owner lock everyone out", async () => {
    const { service, files } = await loadService({ login: OWNER })
    const caller = context({ token: "t" })
    const current = await service.getConfig({ $typeName: "mixture.cloud.v1.GetConfigRequest" }, caller)
    const emptied = { ...current.config!, access: { ...current.config!.access!, owners: [] } }
    await service.updateConfig(
      { $typeName: "mixture.cloud.v1.UpdateConfigRequest", config: emptied, sha: "" },
      caller,
    )
    const written = JSON.parse(files["cloud.config.json"] as string) as CloudConfig
    expect(written.access.owners).toEqual([OWNER])
  })
})
