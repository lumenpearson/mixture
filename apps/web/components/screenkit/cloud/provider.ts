"use client"

import { cloudClient } from "@/lib/rpc/client"
import { Code, ConnectError } from "@connectrpc/connect"
import type { Entry, Status } from "@mixture/protocol/cloud"
import { Github, type LucideIcon } from "lucide-react"
import * as React from "react"

/* ------------------------------------------------------------------ *
 * cloud providers — the file manager's only view of a storage backend
 *
 * The manager never calls an RPC (or a runtime API) itself; it calls the
 * provider it is currently pointed at. Today one provider exists, the GitHub
 * cloud repository over CloudService. A "local files" provider on top of
 * `lib/local/bridge.ts` can be added by registering it from its own module —
 * `registerProvider` is the whole integration point, no file here changes.
 *
 * Everything is expressed in the protocol's `Entry` shape, so a provider that
 * speaks another vocabulary (LocalEntry, for one) maps into it once at its
 * own edge and the listing, sorting, filters and menus keep working.
 * ------------------------------------------------------------------ */

export type CloudCall = { signal?: AbortSignal }

export type ProviderCapabilities = {
  /** upload / overwrite files */
  write: boolean
  move: boolean
  remove: boolean
  mkdir: boolean
  /** recursive listing, needed for "search everywhere" */
  tree: boolean
  /** a url the browser can stream from without reading the bytes first */
  streamUrl: boolean
  /** the backend enforces roles and visibility (the GitHub one does) */
  access: boolean
}

export type ReadResult = {
  entry: Entry | null
  content: Uint8Array
  /** true when the file was too large to inline; use `downloadUrl` instead */
  truncated: boolean
}

export type ListResult = {
  path: string
  entries: Entry[]
  status?: Status
}

export type WriteOptions = {
  /** blob sha of the file being replaced; "" or omitted creates a new file */
  sha?: string
  message?: string
}

export interface CloudProvider {
  readonly id: string
  /** i18n key for the source name shown in the switcher */
  readonly labelKey: string
  readonly icon: LucideIcon
  readonly capabilities: ProviderCapabilities
  list(path: string, options?: CloudCall): Promise<ListResult>
  tree(prefix: string, options?: CloudCall): Promise<{ entries: Entry[]; truncated: boolean }>
  stat(path: string, options?: CloudCall): Promise<Entry | null>
  read(path: string, options?: CloudCall): Promise<ReadResult>
  write(path: string, content: Uint8Array, options?: WriteOptions & CloudCall): Promise<Entry | null>
  remove(path: string, sha?: string, options?: CloudCall): Promise<void>
  move(from: string, to: string, options?: CloudCall): Promise<Entry | null>
  mkdir(path: string, options?: CloudCall): Promise<Entry | null>
  /** optional: a direct url for previews and downloads */
  streamUrl?(entry: Entry, options?: CloudCall): Promise<string | null>
  /** optional: false while the source needs a permission or a setup step */
  ready?(): Promise<boolean>
  /** optional: the screen shown while `ready()` is false; calls onReady when done */
  Gate?: React.ComponentType<{ onReady: () => void }>
}

/* ------------------------------- github ------------------------------- */

export const GITHUB_PROVIDER_ID = "github"

const githubProvider: CloudProvider = {
  id: GITHUB_PROVIDER_ID,
  labelKey: "cloudfm.source.github",
  icon: Github,
  capabilities: { write: true, move: true, remove: true, mkdir: true, tree: true, streamUrl: true, access: true },

  async list(path, options) {
    const response = await cloudClient().listEntries({ path }, options)
    return { path: response.path, entries: response.entries, status: response.status }
  },

  async tree(prefix, options) {
    const response = await cloudClient().getTree({ prefix }, options)
    return { entries: response.entries, truncated: response.truncated }
  },

  async stat(path, options) {
    const response = await cloudClient().statEntry({ path }, options)
    return response.entry ?? null
  },

  async read(path, options) {
    const response = await cloudClient().readFile({ path }, options)
    return { entry: response.entry ?? null, content: response.content, truncated: response.truncated }
  },

  async write(path, content, options) {
    const response = await cloudClient().writeFile(
      { path, content, sha: options?.sha ?? "", message: options?.message ?? "" },
      { signal: options?.signal },
    )
    return response.entry ?? null
  },

  async remove(path, sha, options) {
    await cloudClient().deleteEntry({ path, sha: sha ?? "" }, options)
  },

  async move(from, to, options) {
    const response = await cloudClient().moveEntry({ from, to }, options)
    return response.entry ?? null
  },

  async mkdir(path, options) {
    const response = await cloudClient().createDirectory({ path }, options)
    return response.entry ?? null
  },

  // A private repository has no public download url, so `entry.downloadUrl` is
  // usually empty and video used to arrive as one 4 MiB rpc message with no
  // seeking. CreateStreamTicket mints a signed, same-origin url instead; it
  // carries no token, so it is safe to hand to <video src>.
  async streamUrl(entry, options) {
    const key = `${entry.path}#${entry.sha}`
    const cached = readTicket(key)
    if (cached) return cached
    try {
      const response = await cloudClient().createStreamTicket({ path: entry.path }, options)
      if (!response.url) return entry.downloadUrl || null
      rememberTicket(key, response.url, Number(response.expiresAtUnixMs))
      return response.url
    } catch (error) {
      // failed_precondition means the server has no streaming secret at all;
      // answering null lets the previewer fall back to the ReadFile rpc
      if (error instanceof ConnectError && error.code === Code.FailedPrecondition) return null
      // anything else (offline, not found, an aborted request) keeps the old
      // behaviour: the direct download url when GitHub gave us one
      return entry.downloadUrl || null
    }
  },
}

/* --------------------------- stream tickets --------------------------- */

/** stop reusing a ticket a minute before it expires, so a seek mid-playback
 *  never lands on a url the route has just started refusing */
const TICKET_MARGIN_MS = 60_000
const TICKET_CACHE_LIMIT = 32

const tickets = new Map<string, { url: string; expiresAt: number }>()

function readTicket(key: string): string | null {
  const found = tickets.get(key)
  if (!found) return null
  if (found.expiresAt - TICKET_MARGIN_MS <= Date.now()) {
    tickets.delete(key)
    return null
  }
  return found.url
}

function rememberTicket(key: string, url: string, expiresAt: number) {
  if (!Number.isFinite(expiresAt)) return
  tickets.set(key, { url, expiresAt })
  // the key is path + blob sha, so an overwritten file mints a new ticket;
  // the map is bounded because a long session browsing a big drive would
  // otherwise keep every url it ever asked for
  while (tickets.size > TICKET_CACHE_LIMIT) {
    const oldest = tickets.keys().next().value
    if (oldest === undefined) break
    tickets.delete(oldest)
  }
}

/* ------------------------------ registry ------------------------------ */

const providers = new Map<string, CloudProvider>([[githubProvider.id, githubProvider]])
const listeners = new Set<() => void>()
let snapshot: CloudProvider[] = [githubProvider]

function publish() {
  snapshot = [...providers.values()]
  listeners.forEach((listener) => listener())
}

/**
 * Add a source to the switcher. Call it once at module scope from the
 * feature that owns the backend; registering the same id twice replaces the
 * earlier provider, so a runtime-specific build can override a default.
 */
export function registerProvider(provider: CloudProvider): () => void {
  providers.set(provider.id, provider)
  publish()
  return () => {
    providers.delete(provider.id)
    publish()
  }
}

export const getProvider = (id: string): CloudProvider | null => providers.get(id) ?? null

export const listProviders = (): readonly CloudProvider[] => snapshot

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** every registered source, re-rendering when one is added or removed */
export function useProviders(): readonly CloudProvider[] {
  return React.useSyncExternalStore(subscribe, listProviders, listProviders)
}

/** the provider for an id, falling back to GitHub while a source is loading */
export function useProvider(id: string): CloudProvider {
  const all = useProviders()
  return React.useMemo(
    () => all.find((provider) => provider.id === id) ?? all[0] ?? githubProvider,
    [all, id],
  )
}
