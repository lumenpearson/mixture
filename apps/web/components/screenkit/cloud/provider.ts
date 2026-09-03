"use client"

import { cloudClient } from "@/lib/rpc/client"
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

  // GitHub hands out a signed download url for private content; when it is
  // missing the caller falls back to reading the bytes through the provider
  async streamUrl(entry) {
    return entry.downloadUrl || null
  },
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
