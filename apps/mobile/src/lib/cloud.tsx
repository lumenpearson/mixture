import { base64Decode, base64Encode } from "@bufbuild/protobuf/wire"
import * as React from "react"
import { cloudClient, rpcErrorMessage } from "./rpc/client"
import {
  OFFLINE_STATUS,
  entryFromPb,
  statusFromPb,
  type CloudStatus,
  type FileEntry,
} from "./rpc/codec"
import { contentTypeOf, joinPath } from "./files"
import * as saf from "./local/saf"
import { useSettings } from "./settings"

/* ------------------------------------------------------------------ *
 * the file manager's data
 *
 * One hook drives both sources. "cloud" goes through CloudService; the
 * "local" source reads the folder android granted through SAF. Because
 * both produce `FileEntry`, the listing, the sorting and the context menu
 * never branch on the source — only the six operations below do.
 * ------------------------------------------------------------------ */

export type CloudSource = "cloud" | "local"

export type FileManager = {
  source: CloudSource
  setSource: (source: CloudSource) => void
  /** cloud: a repository-relative path; local: the folder's document uri */
  path: string
  open: (path: string) => void
  goUp: () => void
  entries: FileEntry[]
  status: CloudStatus
  loading: boolean
  error: string
  refresh: () => Promise<void>
  createDirectory: (name: string) => Promise<void>
  remove: (entry: FileEntry) => Promise<void>
  rename: (entry: FileEntry, name: string) => Promise<void>
  move: (entry: FileEntry, to: string) => Promise<void>
  upload: (name: string, uri: string) => Promise<void>
  /** copy a cloud file into the granted local folder */
  download: (entry: FileEntry) => Promise<string>
}

export function useFileManager(): FileManager {
  const { settings } = useSettings()
  const [source, setSourceState] = React.useState<CloudSource>("cloud")
  const [path, setPath] = React.useState("")
  const [localStack, setLocalStack] = React.useState<string[]>([])
  const [entries, setEntries] = React.useState<FileEntry[]>([])
  const [status, setStatus] = React.useState<CloudStatus>(OFFLINE_STATUS)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const localPath = localStack.length > 0 ? localStack[localStack.length - 1] : settings.localRoot

  const load = React.useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      if (source === "cloud") {
        const response = await cloudClient().listEntries({ path })
        setEntries(response.entries.map(entryFromPb))
        setStatus(statusFromPb(response.status))
      } else if (localPath) {
        setEntries(await saf.listDirectory(localPath))
      } else {
        setEntries([])
      }
    } catch (caught) {
      setEntries([])
      setError(rpcErrorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [source, path, localPath])

  React.useEffect(() => {
    void load()
  }, [load])

  const setSource = React.useCallback((next: CloudSource) => {
    setSourceState(next)
    setError("")
  }, [])

  const open = React.useCallback(
    (next: string) => {
      if (source === "cloud") setPath(next)
      else setLocalStack((stack) => [...stack, next])
    },
    [source],
  )

  const goUp = React.useCallback(() => {
    if (source === "cloud") {
      setPath((current) => {
        const slash = current.lastIndexOf("/")
        return slash <= 0 ? "" : current.slice(0, slash)
      })
    } else {
      setLocalStack((stack) => stack.slice(0, -1))
    }
  }, [source])

  const createDirectory = React.useCallback(
    async (name: string) => {
      if (source === "cloud") await cloudClient().createDirectory({ path: joinPath(path, name) })
      else if (localPath) await saf.createDirectory(localPath, name)
      await load()
    },
    [source, path, localPath, load],
  )

  const remove = React.useCallback(
    async (entry: FileEntry) => {
      if (entry.source === "cloud") await cloudClient().deleteEntry({ path: entry.path, sha: entry.sha })
      else await saf.deleteEntry(entry.path)
      await load()
    },
    [load],
  )

  const move = React.useCallback(
    async (entry: FileEntry, to: string) => {
      // SAF has no rename that expo exposes, so moving is cloud-only; the
      // menu hides the action for local rows instead of failing here
      if (entry.source !== "cloud") throw new Error("local move is not supported")
      await cloudClient().moveEntry({ from: entry.path, to })
      await load()
    },
    [load],
  )

  const rename = React.useCallback(
    async (entry: FileEntry, name: string) => {
      const slash = entry.path.lastIndexOf("/")
      const parent = slash <= 0 ? "" : entry.path.slice(0, slash)
      await move(entry, joinPath(parent, name))
    },
    [move],
  )

  const upload = React.useCallback(
    async (name: string, uri: string) => {
      const base64 = await saf.readBase64(uri)
      await cloudClient().writeFile({
        path: joinPath(path, name),
        content: base64Decode(base64),
        message: `add ${name} from the android app`,
      })
      await load()
    },
    [path, load],
  )

  const download = React.useCallback(
    async (entry: FileEntry) => {
      if (!settings.localRoot) throw new Error("no local folder")
      const response = await cloudClient().readFile({ path: entry.path })
      if (response.truncated) throw new Error("the file is too large to read inline")
      return saf.writeBase64(settings.localRoot, entry.name, base64Encode(response.content))
    },
    [settings.localRoot],
  )

  return {
    source,
    setSource,
    path: source === "cloud" ? path : localPath,
    open,
    goUp,
    entries,
    status,
    loading,
    error,
    refresh: load,
    createDirectory,
    remove,
    rename,
    move,
    upload,
    download,
  }
}

export const contentTypeForEntry = (entry: FileEntry) =>
  entry.contentType || contentTypeOf(entry.name)
