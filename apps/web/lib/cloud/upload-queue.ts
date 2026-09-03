import { RPC_MAX_MESSAGE_BYTES } from "@/lib/rpc/limits"
import { joinPath, normalizePath, pathProblem, uniqueName, type PathProblem } from "./paths"

/* ------------------------------------------------------------------ *
 * upload queue — the state machine behind the visible upload list
 *
 * Everything here is pure. Two routes carry the bytes:
 *   - "rpc"    — WriteFile through ConnectRPC, capped by RPC_MAX_MESSAGE_BYTES
 *                because a Vercel function accepts about 4.5 MB of body
 *   - "direct" — a base64 PUT to the GitHub contents API made by the browser
 *                with the caller's own token, so the server body cap does not
 *                apply. Only a caller who brought a token can take it; a
 *                key-based caller has no GitHub credential of their own and
 *                stays on the capped route.
 * ------------------------------------------------------------------ */

/** GitHub refuses a contents-API write well before this; it is the ceiling we admit to */
export const DIRECT_UPLOAD_LIMIT = 90 * 1024 * 1024

export const UPLOAD_LIMIT_RPC = RPC_MAX_MESSAGE_BYTES

export type UploadRoute = "rpc" | "direct" | "too-large"

export type UploadStatus = "pending" | "conflict" | "uploading" | "done" | "error" | "cancelled" | "skipped"

export type UploadItem = {
  id: string
  /** the file name as it will appear in the repository */
  name: string
  /** the full repository path the bytes land on */
  path: string
  size: number
  status: UploadStatus
  /** 0..1; only the direct route reports real progress */
  progress: number
  error: string | null
  route: UploadRoute
  /** blob sha of the file being replaced, "" for a new file */
  sha: string
  file: File
}

export type ExistingEntry = { path: string; sha: string }

/** which transport a file of this size may use */
export function uploadRoute(size: number, canUploadDirectly: boolean): UploadRoute {
  if (size <= UPLOAD_LIMIT_RPC) return "rpc"
  if (!canUploadDirectly) return "too-large"
  return size <= DIRECT_UPLOAD_LIMIT ? "direct" : "too-large"
}

export type UploadCandidate = {
  file: File
  /** path relative to the drop target, "a/b.png" for a dropped folder */
  relativePath: string
}

export type BuildOptions = {
  basePath: string
  existing: readonly ExistingEntry[]
  canUploadDirectly: boolean
  /** monotonic id source so two files with the same name stay distinct */
  idPrefix?: string
}

export type RejectedCandidate = { name: string; reason: PathProblem }

let counter = 0

/**
 * Turn dropped or picked files into queue items: resolve their target paths,
 * mark the ones that would overwrite something as `conflict`, and reject the
 * paths the server would reject anyway.
 */
export function buildUploadItems(
  candidates: readonly UploadCandidate[],
  options: BuildOptions,
): { items: UploadItem[]; rejected: RejectedCandidate[] } {
  const bySha = new Map(options.existing.map((entry) => [entry.path.toLowerCase(), entry.sha]))
  const items: UploadItem[] = []
  const rejected: RejectedCandidate[] = []
  for (const candidate of candidates) {
    const relative = normalizePath(candidate.relativePath || candidate.file.name)
    const path = joinPath(options.basePath, relative)
    const problem = pathProblem(path)
    if (problem) {
      rejected.push({ name: relative || candidate.file.name, reason: problem })
      continue
    }
    const sha = bySha.get(path.toLowerCase()) ?? ""
    counter += 1
    items.push({
      id: `${options.idPrefix ?? "up"}-${counter}`,
      name: path.split("/").pop() ?? path,
      path,
      size: candidate.file.size,
      status: sha ? "conflict" : "pending",
      progress: 0,
      error: null,
      route: uploadRoute(candidate.file.size, options.canUploadDirectly),
      sha,
      file: candidate.file,
    })
  }
  return { items, rejected }
}

export function patchItem(items: readonly UploadItem[], id: string, patch: Partial<UploadItem>): UploadItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

export type ConflictResolution = "overwrite" | "keep-both" | "skip"

/** apply an overwrite prompt answer to one queued item */
export function resolveConflict(
  items: readonly UploadItem[],
  id: string,
  resolution: ConflictResolution,
  taken: readonly string[],
): UploadItem[] {
  return items.map((item) => {
    if (item.id !== id || item.status !== "conflict") return item
    if (resolution === "skip") return { ...item, status: "skipped" as const }
    if (resolution === "overwrite") return { ...item, status: "pending" as const }
    const parent = item.path.slice(0, Math.max(0, item.path.length - item.name.length - 1))
    const name = uniqueName(item.name, taken.map((p) => p.split("/").pop() ?? p))
    return { ...item, status: "pending" as const, name, path: joinPath(parent, name), sha: "" }
  })
}

/** the next item the runner should send, or null when the queue is idle */
export function nextPending(items: readonly UploadItem[]): UploadItem | null {
  return items.find((item) => item.status === "pending" && item.route !== "too-large") ?? null
}

export type QueueSummary = {
  total: number
  done: number
  failed: number
  skipped: number
  conflicts: number
  pending: number
  active: boolean
  /** 0..1 across every item, weighted by bytes */
  progress: number
  bytes: number
}

export function summarize(items: readonly UploadItem[]): QueueSummary {
  let done = 0
  let failed = 0
  let skipped = 0
  let conflicts = 0
  let pending = 0
  let active = false
  let bytes = 0
  let moved = 0
  for (const item of items) {
    bytes += item.size
    if (item.status === "done") {
      done += 1
      moved += item.size
    } else if (item.status === "error" || item.route === "too-large") failed += 1
    else if (item.status === "skipped" || item.status === "cancelled") skipped += 1
    else if (item.status === "conflict") conflicts += 1
    else if (item.status === "pending") pending += 1
    else if (item.status === "uploading") {
      active = true
      moved += item.size * item.progress
    }
  }
  return {
    total: items.length,
    done,
    failed,
    skipped,
    conflicts,
    pending,
    active,
    progress: bytes > 0 ? Math.min(1, moved / bytes) : items.length ? 1 : 0,
    bytes,
  }
}

/** true once nothing is left to send (the panel may collapse itself) */
export const queueIsFinished = (items: readonly UploadItem[]) =>
  items.length > 0 && items.every((item) => item.status === "done" || item.status === "skipped" || item.status === "cancelled")

export const retryable = (item: UploadItem) => item.status === "error" || item.status === "cancelled"
