import { pathProblem } from "./paths"

/* ------------------------------------------------------------------ *
 * direct browser upload to the GitHub contents API
 *
 * The RPC route runs through a Vercel function, whose request body tops out
 * around 4.5 MB. A caller who pasted their own GitHub token already holds a
 * credential GitHub accepts, so for large files the browser PUTs the bytes to
 * api.github.com itself and the server cap never applies. A caller who only
 * has a shared access key has no GitHub credential and stays on the RPC route.
 *
 * Rules this file keeps:
 *   - the token is only ever sent to `https://api.github.com` (hardcoded), and
 *     never logged, echoed into an error message or stored anywhere new;
 *   - the same path rules the server enforces are applied here, because this
 *     request does not pass through `cloud/service.ts`;
 *   - GitHub is still the authority: a token without push rights gets a 403
 *     from GitHub, so this route cannot grant write access the caller lacks.
 * ------------------------------------------------------------------ */

const GITHUB_API = "https://api.github.com"

export type DirectUploadOptions = {
  token: string
  /** "owner/name" */
  repo: string
  branch: string
  path: string
  file: Blob
  message: string
  /** blob sha of the file being replaced; omit for a new file */
  sha?: string
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export type DirectUploadResult = { sha: string; commitSha: string }

export class DirectUploadError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "DirectUploadError"
  }
}

function encodeBase64(bytes: Uint8Array): string {
  // 32k at a time: String.fromCharCode(...bytes) on a whole large file
  // overflows the argument stack
  const CHUNK = 0x8000
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK))
  }
  return btoa(binary)
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/")
}

/** a short reason for a GitHub failure that never contains the token */
function reasonFor(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as { message?: string }
    if (json.message) return json.message
  } catch {
    // body was not json
  }
  if (status === 401) return "github token rejected"
  if (status === 403) return "github refused the upload"
  if (status === 404) return "cloud repository not found for this token"
  if (status === 409) return "cloud repository changed underneath, retry"
  if (status === 413) return "github refused the upload: file too large"
  return `github ${status}`
}

/**
 * PUT one file straight to the contents API. Resolves with the new blob and
 * commit sha; rejects with a DirectUploadError carrying the HTTP status.
 */
export async function uploadDirect(options: DirectUploadOptions): Promise<DirectUploadResult> {
  const problem = pathProblem(options.path)
  if (problem) throw new DirectUploadError(400, `path rejected: ${problem}`)
  const [owner, name] = options.repo.split("/")
  if (!owner || !name) throw new DirectUploadError(400, "cloud repository is not configured")

  const bytes = new Uint8Array(await options.file.arrayBuffer())
  const body = JSON.stringify({
    message: options.message,
    content: encodeBase64(bytes),
    branch: options.branch,
    ...(options.sha ? { sha: options.sha } : {}),
  })

  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/${encodePath(options.path)}`

  // XHR rather than fetch: it is the only browser API that reports how many
  // bytes of the request body have gone out, which is what the queue shows
  return new Promise<DirectUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url, true)
    xhr.setRequestHeader("Accept", "application/vnd.github+json")
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.setRequestHeader("X-GitHub-Api-Version", "2022-11-28")
    xhr.setRequestHeader("Authorization", `Bearer ${options.token}`)

    const abort = () => xhr.abort()
    options.signal?.addEventListener("abort", abort, { once: true })
    const cleanup = () => options.signal?.removeEventListener("abort", abort)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) options.onProgress?.(event.loaded / event.total)
    }
    xhr.onerror = () => {
      cleanup()
      reject(new DirectUploadError(0, "network error while talking to github"))
    }
    xhr.onabort = () => {
      cleanup()
      reject(new DirectUploadError(0, "upload cancelled"))
    }
    xhr.onload = () => {
      cleanup()
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new DirectUploadError(xhr.status, reasonFor(xhr.status, xhr.responseText)))
        return
      }
      try {
        const json = JSON.parse(xhr.responseText) as { content?: { sha?: string }; commit?: { sha?: string } }
        options.onProgress?.(1)
        resolve({ sha: json.content?.sha ?? "", commitSha: json.commit?.sha ?? "" })
      } catch {
        reject(new DirectUploadError(xhr.status, "github returned an unreadable response"))
      }
    }
    xhr.send(body)
  })
}
