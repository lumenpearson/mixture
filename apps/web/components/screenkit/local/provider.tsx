"use client"

import type { LocalEntry, LocalFsBridge } from "@/lib/local/bridge"
import { webLocalBridge } from "@/lib/local/web"
import { create } from "@bufbuild/protobuf"
import { EntryKind, EntrySchema, Visibility, type Entry } from "@mixture/protocol/cloud"
import { HardDrive } from "lucide-react"
import * as React from "react"
import { registerProvider, type CloudProvider } from "../cloud/provider"
import { LocalPermissionScreen } from "./permission-screen"

/* ------------------------------------------------------------------ *
 * the "local files" source of the cloud tab
 *
 * Wraps a LocalFsBridge in the CloudProvider contract: local entries map
 * into the protocol's Entry shape once, here, and the file manager keeps
 * its listing, sorting, filters, menus and previews. The permission screen
 * is the provider's gate: the manager shows it until the bridge reports a
 * granted folder. Importing this module registers the source.
 * ------------------------------------------------------------------ */

export const LOCAL_PROVIDER_ID = "local"

const TREE_LIMIT = 5000

const toEntry = (local: LocalEntry): Entry =>
  create(EntrySchema, {
    path: local.path,
    name: local.name,
    kind: local.kind === "directory" ? EntryKind.DIRECTORY : EntryKind.FILE,
    size: BigInt(local.size),
    sha: local.modifiedAt ? String(local.modifiedAt) : "",
    visibility: Visibility.PRIVATE,
    editable: true,
    contentType: local.contentType,
    downloadUrl: "",
  })

export function createLocalProvider(bridge: LocalFsBridge): CloudProvider {
  function Gate({ onReady }: { onReady: () => void }) {
    return <LocalPermissionScreen bridge={bridge} onContinue={onReady} />
  }

  return {
    id: LOCAL_PROVIDER_ID,
    labelKey: "local.title",
    icon: HardDrive,
    capabilities: { write: true, move: true, remove: true, mkdir: true, tree: true, streamUrl: true, access: false },

    async ready() {
      return (await bridge.permission()) === "granted"
    },
    Gate,

    async list(path) {
      const entries = await bridge.list(path)
      return { path, entries: entries.map(toEntry) }
    },

    async tree(prefix) {
      const out: Entry[] = []
      const stack = [prefix]
      let truncated = false
      while (stack.length > 0 && !truncated) {
        const folder = stack.pop() as string
        const children = await bridge.list(folder)
        for (const child of children) {
          out.push(toEntry(child))
          if (child.kind === "directory") stack.push(child.path)
          if (out.length >= TREE_LIMIT) {
            truncated = true
            break
          }
        }
      }
      return { entries: out, truncated }
    },

    async stat(path) {
      const entry = await bridge.stat(path)
      return entry ? toEntry(entry) : null
    },

    async read(path) {
      const entry = await bridge.stat(path)
      const content = await bridge.read(path)
      return { entry: entry ? toEntry(entry) : null, content, truncated: false }
    },

    async write(path, content) {
      return toEntry(await bridge.write(path, content))
    },

    async remove(path) {
      await bridge.remove(path)
    },

    async move(from, to) {
      return toEntry(await bridge.move(from, to))
    },

    async mkdir(path) {
      return toEntry(await bridge.mkdir(path))
    },

    async streamUrl(entry) {
      return bridge.streamUrl(entry.path)
    },
  }
}

if (typeof window !== "undefined") {
  registerProvider(createLocalProvider(webLocalBridge()))
}
