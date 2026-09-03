"use client"

import { contentTypeOf } from "@/lib/media/kinds"
import type { StreamingMode } from "@/lib/media/player-settings"
import { cloudClient, rpcErrorMessage } from "@/lib/rpc/client"
import * as React from "react"
import { usePlayerSettings } from "./player-settings"

/* ------------------------------------------------------------------ *
 * media loading
 *
 * A file can come from a direct url (a public download link, a website, a
 * local object url) or from the cloud drive by path through the ReadFile
 * rpc. The hook turns either into something an <img>, <video> or a text
 * decoder can use, honouring the streaming setting, and caches blob urls
 * so switching between files does not re-download them.
 * ------------------------------------------------------------------ */

export type MediaRead = {
  content: Uint8Array
  contentType?: string
  name?: string
  /** true when the backend refused to inline the bytes */
  truncated?: boolean
  /** a direct url to fall back to when truncated */
  downloadUrl?: string
}

export type MediaSource = {
  /** a url the browser can fetch directly */
  url?: string
  /** a path read through `reader` (or the cloud rpc when no reader is given) */
  path?: string
  /** blob sha, part of the cache key when known */
  sha?: string
  name?: string
  contentType?: string
  /** how to read the bytes of `path`; defaults to CloudService.ReadFile */
  reader?: (path: string) => Promise<MediaRead>
  /** cache namespace, e.g. the provider id, so equal paths from two sources stay apart */
  scope?: string
}

const rpcReader = async (path: string): Promise<MediaRead> => {
  const response = await cloudClient().readFile({ path })
  return {
    content: response.content,
    contentType: response.entry?.contentType,
    name: response.entry?.name,
    truncated: response.truncated,
    downloadUrl: response.entry?.downloadUrl,
  }
}

export type MediaLoad =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready"
      url: string
      bytes?: Uint8Array
      contentType: string
      name: string
      size: number
      via: "url" | "rpc"
    }
  | { status: "error"; reason: "too-large" | "failed" | "missing"; message?: string }

type CacheEntry = { url: string; bytes: Uint8Array; contentType: string; name: string; size: number }

const CACHE_LIMIT = 24
const cache = new Map<string, CacheEntry>()

function remember(key: string, entry: CacheEntry) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, entry)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    const evicted = cache.get(oldest)
    cache.delete(oldest)
    if (evicted) URL.revokeObjectURL(evicted.url)
  }
}

/** drop a cached blob (after the file changed on the drive) */
export function forgetMedia(path: string, scope = "") {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${scope}:${path}#`)) {
      const entry = cache.get(key)
      cache.delete(key)
      if (entry) URL.revokeObjectURL(entry.url)
    }
  }
}

const nameOf = (source: MediaSource) =>
  source.name ?? (source.path ?? source.url ?? "file").split("?")[0].split("/").pop() ?? "file"

function pickDelivery(source: MediaSource, streaming: StreamingMode, wantBytes: boolean): "url" | "rpc" | "none" {
  const hasUrl = Boolean(source.url)
  const hasPath = Boolean(source.path)
  // text previews need the bytes; a cross-origin url may refuse them
  if (wantBytes && hasPath) return "rpc"
  if (streaming === "progressive") return hasUrl ? "url" : hasPath ? "rpc" : "none"
  if (streaming === "inline") return hasPath ? "rpc" : hasUrl ? "url" : "none"
  return hasUrl ? "url" : hasPath ? "rpc" : "none"
}

/**
 * load a media source. `wantBytes` asks for the raw bytes too (text previews
 * decode them); for direct urls that means a fetch, which may be refused by
 * cors — the hook then reports the url alone.
 */
export function useMediaLoad(source: MediaSource | null, options?: { wantBytes?: boolean }): MediaLoad {
  const { settings } = usePlayerSettings()
  const wantBytes = options?.wantBytes ?? false
  const [state, setState] = React.useState<MediaLoad>({ status: "idle" })
  const key = source ? `${source.scope ?? ""}#${source.path ?? ""}#${source.sha ?? ""}#${source.url ?? ""}#${settings.streaming}#${wantBytes ? 1 : 0}` : ""

  React.useEffect(() => {
    if (!source) {
      setState({ status: "idle" })
      return
    }
    const delivery = pickDelivery(source, settings.streaming, wantBytes)
    if (delivery === "none") {
      setState({ status: "error", reason: "missing" })
      return
    }
    let cancelled = false
    const name = nameOf(source)

    if (delivery === "url") {
      const url = source.url as string
      const contentType = source.contentType || contentTypeOf(name)
      if (!wantBytes) {
        setState({ status: "ready", url, contentType, name, size: -1, via: "url" })
        return
      }
      setState({ status: "loading" })
      fetch(url)
        .then(async (response) => {
          if (!response.ok) throw new Error(`http ${response.status}`)
          const buffer = new Uint8Array(await response.arrayBuffer())
          if (cancelled) return
          setState({
            status: "ready",
            url,
            bytes: buffer,
            contentType: response.headers.get("content-type") || contentType,
            name,
            size: buffer.byteLength,
            via: "url",
          })
        })
        .catch(() => {
          if (cancelled) return
          // cors or network: the url may still render in a media element
          setState({ status: "ready", url, contentType, name, size: -1, via: "url" })
        })
      return () => {
        cancelled = true
      }
    }

    const path = source.path as string
    const cacheKey = `${source.scope ?? ""}:${path}#${source.sha ?? ""}`
    const cached = cache.get(cacheKey)
    if (cached) {
      setState({
        status: "ready",
        url: cached.url,
        bytes: wantBytes ? cached.bytes : undefined,
        contentType: cached.contentType,
        name: cached.name,
        size: cached.size,
        via: "rpc",
      })
      return
    }
    setState({ status: "loading" })
    ;(source.reader ?? rpcReader)(path)
      .then((response) => {
        if (cancelled) return
        if (response.truncated) {
          const fallback = response.downloadUrl
          if (fallback && settings.streaming !== "inline") {
            setState({
              status: "ready",
              url: fallback,
              contentType: response.contentType || contentTypeOf(name),
              name,
              size: -1,
              via: "url",
            })
          } else {
            setState({ status: "error", reason: "too-large" })
          }
          return
        }
        const bytes = response.content
        const contentType = response.contentType || source.contentType || contentTypeOf(name)
        const blob = new Blob([bytes as BlobPart], { type: contentType })
        const entry: CacheEntry = {
          url: URL.createObjectURL(blob),
          bytes,
          contentType,
          name: response.name || name,
          size: bytes.byteLength,
        }
        remember(cacheKey, entry)
        setState({
          status: "ready",
          url: entry.url,
          bytes: wantBytes ? bytes : undefined,
          contentType,
          name: entry.name,
          size: entry.size,
          via: "rpc",
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({ status: "error", reason: "failed", message: rpcErrorMessage(error) })
      })
    return () => {
      cancelled = true
    }
    // the key captures every field of `source` the effect reads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}
