"use client"

import { DirectUploadError, uploadDirect } from "@/lib/cloud/github-upload"
import {
  buildUploadItems,
  nextPending,
  patchItem,
  resolveConflict,
  takenPaths,
  type ConflictResolution,
  type ExistingEntry,
  type UploadCandidate,
  type UploadItem,
} from "@/lib/cloud/upload-queue"
import { rpcErrorMessage } from "@/lib/rpc/client"
import * as React from "react"
import { GITHUB_PROVIDER_ID, type CloudProvider } from "./provider"

/* ------------------------------------------------------------------ *
 * the upload runner
 *
 * One file at a time, in queue order: GitHub commits per write, and firing
 * ten writes at once against one branch produces conflicts (409) rather than
 * speed. Each item takes one of two routes — the capped RPC or, for a caller
 * with their own GitHub token, a direct PUT to the contents API.
 * ------------------------------------------------------------------ */

export type UploadEnvironment = {
  provider: CloudProvider
  /** "owner/name" of the cloud repository, from Status */
  repo: string
  branch: string
  /** the caller's own GitHub token; "" when they only hold an access key */
  token: string
  /**
   * whether the direct PUT to api.github.com is available *for this provider*.
   * The manager computes it; the runner checks it again before sending,
   * because a route chosen when the queue was built must never outlive the
   * source it was chosen for — the bytes would land in the cloud repository
   * while the manager is pointed at a folder on the user's disk.
   */
  canUploadDirectly: boolean
}

/** how often a progress event is allowed to re-render the queue */
const PROGRESS_INTERVAL_MS = 120

export function useUploads(environment: UploadEnvironment, onQueueDrained: () => void) {
  const [items, setItems] = React.useState<UploadItem[]>([])
  const running = React.useRef(false)
  const aborts = React.useRef(new Map<string, AbortController>())
  // the runner outlives any one render, so it reads the environment and the
  // refresh callback through refs kept in step by an effect that is declared
  // first and therefore commits before the runner effect below
  const environmentRef = React.useRef(environment)
  const drainedRef = React.useRef(onQueueDrained)
  React.useEffect(() => {
    environmentRef.current = environment
    drainedRef.current = onQueueDrained
  })

  // the folder listing that built the queue, kept for "keep both": a name has
  // to dodge what is already in the folder, not only what is queued
  const folderRef = React.useRef<string[]>([])

  const enqueue = React.useCallback(
    (candidates: readonly UploadCandidate[], basePath: string, existing: readonly ExistingEntry[]) => {
      folderRef.current = existing.map((entry) => entry.path)
      const built = buildUploadItems(candidates, {
        basePath,
        existing,
        canUploadDirectly: environmentRef.current.canUploadDirectly,
      })
      if (built.items.length) setItems((current) => [...current, ...built.items])
      return built.rejected
    },
    [],
  )

  const send = React.useCallback(async (item: UploadItem) => {
    const env = environmentRef.current
    const controller = new AbortController()
    aborts.current.set(item.id, controller)
    setItems((current) => patchItem(current, item.id, { status: "uploading", progress: 0, error: null }))

    let lastTick = 0
    const report = (fraction: number) => {
      const now = Date.now()
      if (fraction < 1 && now - lastTick < PROGRESS_INTERVAL_MS) return
      lastTick = now
      setItems((current) => patchItem(current, item.id, { progress: fraction }))
    }

    try {
      if (item.route === "direct") {
        // the direct route talks to api.github.com and nothing else: it is
        // only ever right for the GitHub source
        if (!env.canUploadDirectly || env.provider.id !== GITHUB_PROVIDER_ID) {
          throw new Error("the direct upload route is not available for this source")
        }
        if (!env.token || !env.repo || !env.branch) {
          throw new Error("a github token is required for a file this large")
        }
        // the contents API refuses an overwrite without the blob sha, and a
        // file inside a dropped folder was never in the listing that built the
        // queue — ask the provider for it before sending the bytes
        let sha = item.sha
        if (!sha) {
          const existing = await env.provider.stat(item.path, { signal: controller.signal }).catch(() => null)
          sha = existing?.sha ?? ""
        }
        await uploadDirect({
          token: env.token,
          repo: env.repo,
          branch: env.branch,
          path: item.path,
          file: item.file,
          message: `cloud: upload ${item.path}`,
          sha: sha || undefined,
          onProgress: report,
          signal: controller.signal,
        })
      } else {
        const content = new Uint8Array(await item.file.arrayBuffer())
        await env.provider.write(item.path, content, { sha: item.sha, signal: controller.signal })
      }
      aborts.current.delete(item.id)
      running.current = false
      setItems((current) => patchItem(current, item.id, { status: "done", progress: 1, error: null }))
    } catch (error) {
      aborts.current.delete(item.id)
      running.current = false
      const cancelled = controller.signal.aborted
      const message =
        error instanceof DirectUploadError ? error.message : cancelled ? null : rpcErrorMessage(error)
      setItems((current) =>
        patchItem(current, item.id, {
          status: cancelled ? "cancelled" : "error",
          error: message,
          progress: 0,
        }),
      )
    }
  }, [])

  // drive the queue: whenever the list settles and nothing is in flight, take
  // the next item. The runner clears `running` before the last setItems so
  // that write is what wakes it up again.
  const hadWork = React.useRef(false)
  React.useEffect(() => {
    if (running.current) return
    const next = nextPending(items)
    if (next) {
      hadWork.current = true
      running.current = true
      void send(next)
      return
    }
    // the listing is refreshed once, on the edge from "sending" to "idle",
    // not after every file
    if (hadWork.current) {
      hadWork.current = false
      drainedRef.current()
    }
  }, [items, send])

  React.useEffect(() => {
    const controllers = aborts.current
    return () => {
      // leaving the tab must not leave a request hanging on a dead component
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
    }
  }, [])

  const resolve = React.useCallback((id: string, resolution: ConflictResolution) => {
    setItems((current) => resolveConflict(current, id, resolution, takenPaths(current, folderRef.current)))
  }, [])

  const resolveAll = React.useCallback((resolution: ConflictResolution) => {
    setItems((current) =>
      current.reduce(
        (acc, item) =>
          item.status === "conflict"
            ? resolveConflict(acc, item.id, resolution, takenPaths(acc, folderRef.current))
            : acc,
        current,
      ),
    )
  }, [])

  const retry = React.useCallback((id: string) => {
    setItems((current) => patchItem(current, id, { status: "pending", error: null, progress: 0 }))
  }, [])

  const cancel = React.useCallback((id: string) => {
    const controller = aborts.current.get(id)
    if (controller) {
      controller.abort()
      return
    }
    setItems((current) => patchItem(current, id, { status: "cancelled", error: null }))
  }, [])

  const clear = React.useCallback(() => {
    aborts.current.forEach((controller) => controller.abort())
    aborts.current.clear()
    running.current = false
    setItems([])
  }, [])

  return React.useMemo(
    () => ({ items, enqueue, resolve, resolveAll, retry, cancel, clear }),
    [items, enqueue, resolve, resolveAll, retry, cancel, clear],
  )
}
