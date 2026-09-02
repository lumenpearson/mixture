import "server-only"
import { Code, ConnectError } from "@connectrpc/connect"

/* ------------------------------------------------------------------ *
 * a small GitHub REST client for the cloud repository
 *
 * Only the endpoints the cloud drive needs: contents (list / read / write /
 * delete a single file), the git data API (one commit for multi-file moves
 * and recursive deletes) and repository / viewer lookups for access checks.
 * ------------------------------------------------------------------ */

const API = "https://api.github.com"

export type GitHubFile = {
  type: "file" | "dir" | "symlink" | "submodule"
  name: string
  path: string
  sha: string
  size: number
  download_url: string | null
  encoding?: string
  content?: string
}

export type GitHubRepoInfo = {
  full_name: string
  private: boolean
  default_branch: string
  owner: { login: string }
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; triage?: boolean; pull?: boolean }
}

export type TreeEntry = {
  path: string
  mode: "100644" | "100755" | "040000" | "160000" | "120000"
  type: "blob" | "tree" | "commit"
  sha: string | null
  size?: number
}

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly rateLimited = false,
  ) {
    super(message)
  }
}

export function toConnectError(error: unknown, fallback = "github request failed"): ConnectError {
  if (error instanceof ConnectError) return error
  if (error instanceof GitHubError) {
    if (error.rateLimited) return new ConnectError("github rate limit reached, try again later", Code.ResourceExhausted)
    if (error.status === 401) return new ConnectError("github token rejected", Code.Unauthenticated)
    if (error.status === 403) return new ConnectError("github refused the operation", Code.PermissionDenied)
    if (error.status === 404) return new ConnectError("not found in the cloud repository", Code.NotFound)
    if (error.status === 409) return new ConnectError("cloud repository changed underneath, retry", Code.Aborted)
    if (error.status === 422) return new ConnectError(error.message, Code.InvalidArgument)
    return new ConnectError(error.message, Code.Unavailable)
  }
  return new ConnectError(error instanceof Error ? error.message : fallback, Code.Unavailable)
}

export class GitHubRepo {
  constructor(
    readonly token: string,
    readonly owner: string,
    readonly repo: string,
    readonly branch: string,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown, allow404 = false): Promise<T | null> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mixture-cloud",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    })
    if (res.status === 404 && allow404) return null
    if (!res.ok) {
      const remaining = res.headers.get("x-ratelimit-remaining")
      const rateLimited = res.status === 403 && remaining === "0"
      let message = `GitHub ${res.status}`
      try {
        const json = (await res.json()) as { message?: string }
        if (json.message) message = json.message
      } catch {
        // body was not json
      }
      throw new GitHubError(res.status, message, rateLimited)
    }
    if (res.status === 204) return null
    return (await res.json()) as T
  }

  private get base() {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`
  }

  private contentsUrl(path: string) {
    const encoded = path.split("/").map(encodeURIComponent).join("/")
    return `${this.base}/contents/${encoded}?ref=${encodeURIComponent(this.branch)}`
  }

  async info(): Promise<GitHubRepoInfo | null> {
    return this.request<GitHubRepoInfo>("GET", this.base, undefined, true)
  }

  /** create the repository under the token's own account (the owner must match) */
  async createRepository(description: string, isPrivate: boolean): Promise<{ html_url: string }> {
    const result = await this.request<{ html_url: string }>("POST", "/user/repos", {
      name: this.repo,
      description,
      private: isPrivate,
      auto_init: true,
      default_branch: this.branch,
    })
    if (!result) throw new GitHubError(500, "empty response from github")
    return result
  }

  /** a directory listing (array) or a single file record; null when missing */
  async contents(path: string): Promise<GitHubFile | GitHubFile[] | null> {
    return this.request<GitHubFile | GitHubFile[]>("GET", this.contentsUrl(path), undefined, true)
  }

  async file(path: string): Promise<GitHubFile | null> {
    const result = await this.contents(path)
    if (!result || Array.isArray(result)) return null
    return result
  }

  async directory(path: string): Promise<GitHubFile[] | null> {
    const result = await this.contents(path)
    if (!result) return null
    return Array.isArray(result) ? result : null
  }

  /** raw bytes of a blob by sha (works past the 1 MB contents limit) */
  async blob(sha: string): Promise<Uint8Array> {
    const result = await this.request<{ content: string; encoding: string; size: number }>(
      "GET",
      `${this.base}/git/blobs/${sha}`,
    )
    if (!result) throw new GitHubError(404, "blob not found")
    return new Uint8Array(Buffer.from(result.content, "base64"))
  }

  async putFile(
    path: string,
    content: Uint8Array,
    message: string,
    sha?: string,
  ): Promise<{ content: GitHubFile; commit: { sha: string } }> {
    const encoded = path.split("/").map(encodeURIComponent).join("/")
    const result = await this.request<{ content: GitHubFile; commit: { sha: string } }>(
      "PUT",
      `${this.base}/contents/${encoded}`,
      {
        message,
        content: Buffer.from(content).toString("base64"),
        branch: this.branch,
        ...(sha ? { sha } : {}),
      },
    )
    if (!result) throw new GitHubError(500, "empty response from github")
    return result
  }

  async deleteFile(path: string, sha: string, message: string): Promise<{ commit: { sha: string } }> {
    const encoded = path.split("/").map(encodeURIComponent).join("/")
    const result = await this.request<{ commit: { sha: string } }>("DELETE", `${this.base}/contents/${encoded}`, {
      message,
      sha,
      branch: this.branch,
    })
    if (!result) throw new GitHubError(500, "empty response from github")
    return result
  }

  /** every blob under the branch (recursive tree walk) */
  async tree(): Promise<{ sha: string; entries: TreeEntry[]; truncated: boolean }> {
    const ref = await this.request<{ object: { sha: string } }>(
      "GET",
      `${this.base}/git/ref/heads/${encodeURIComponent(this.branch)}`,
    )
    if (!ref) throw new GitHubError(404, "branch not found")
    const commit = await this.request<{ tree: { sha: string } }>("GET", `${this.base}/git/commits/${ref.object.sha}`)
    if (!commit) throw new GitHubError(404, "commit not found")
    const tree = await this.request<{ sha: string; tree: TreeEntry[]; truncated: boolean }>(
      "GET",
      `${this.base}/git/trees/${commit.tree.sha}?recursive=1`,
    )
    if (!tree) throw new GitHubError(404, "tree not found")
    return { sha: ref.object.sha, entries: tree.tree, truncated: tree.truncated }
  }

  /**
   * One commit that applies several path changes at once: a `sha` reuses an
   * existing blob (move / copy), `null` deletes the path. Used for renames and
   * recursive deletes so the history stays one commit per user action.
   */
  async commitChanges(changes: { path: string; sha: string | null }[], message: string): Promise<string> {
    const ref = await this.request<{ object: { sha: string } }>(
      "GET",
      `${this.base}/git/ref/heads/${encodeURIComponent(this.branch)}`,
    )
    if (!ref) throw new GitHubError(404, "branch not found")
    const parent = ref.object.sha
    const parentCommit = await this.request<{ tree: { sha: string } }>("GET", `${this.base}/git/commits/${parent}`)
    if (!parentCommit) throw new GitHubError(404, "commit not found")

    const tree = await this.request<{ sha: string }>("POST", `${this.base}/git/trees`, {
      base_tree: parentCommit.tree.sha,
      tree: changes.map((change) => ({ path: change.path, mode: "100644", type: "blob", sha: change.sha })),
    })
    if (!tree) throw new GitHubError(500, "tree creation failed")

    const commit = await this.request<{ sha: string }>("POST", `${this.base}/git/commits`, {
      message,
      tree: tree.sha,
      parents: [parent],
    })
    if (!commit) throw new GitHubError(500, "commit creation failed")

    await this.request("PATCH", `${this.base}/git/refs/heads/${encodeURIComponent(this.branch)}`, {
      sha: commit.sha,
      force: false,
    })
    return commit.sha
  }
}

type Viewer = { login: string; at: number }
const viewerCache = new Map<string, Viewer>()
const VIEWER_TTL_MS = 5 * 60_000

/** the login behind a token; cached per token for a few minutes */
export async function viewerLogin(token: string): Promise<string> {
  const key = Buffer.from(token).toString("base64url").slice(-32)
  const cached = viewerCache.get(key)
  if (cached && Date.now() - cached.at < VIEWER_TTL_MS) return cached.login
  const res = await fetch(`${API}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mixture-cloud",
    },
    cache: "no-store",
  })
  if (!res.ok) throw new GitHubError(res.status, "github token rejected")
  const json = (await res.json()) as { login?: string }
  const login = json.login ?? ""
  viewerCache.set(key, { login, at: Date.now() })
  return login
}
