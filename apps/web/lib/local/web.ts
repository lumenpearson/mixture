import { contentTypeOf, extensionOf } from "@/lib/media/kinds"
import { LocalAccessError, type LocalEntry, type LocalFsBridge, type LocalPermission, type LocalScan } from "./bridge"
import { baseNameOf, isWithin, joinRelative, normalizeRelative, parentOf, segmentsOf } from "./paths"

/* ------------------------------------------------------------------ *
 * the web runtime of the local file bridge: the File System Access API.
 *
 * Chromium lets a page ask for a directory handle, keep it in IndexedDB
 * and query its permission later without prompting. Everything stays on
 * the device; the app only reads names, sizes and — when a file is opened
 * — its bytes. Other browsers report "unsupported" and the permission
 * screen explains the desktop and android apps do this natively.
 * ------------------------------------------------------------------ */

const DB_NAME = "screenkit-local"
const STORE = "handles"
const ROOT_KEY = "root"
const SCAN_LIMIT = 5000

/* the api is chromium-only and not in every typescript lib: minimal shapes.
   Exported so the tests can stand an in-memory folder up against them. */
type Mode = "read" | "readwrite"
type PermissionResult = "granted" | "denied" | "prompt"
type Handle = { kind: "file" | "directory"; name: string }
export type FileHandle = Handle & {
  kind: "file"
  getFile(): Promise<File>
  createWritable(): Promise<{ write(data: Uint8Array | Blob): Promise<void>; close(): Promise<void> }>
}
export type DirHandle = Handle & {
  kind: "directory"
  values(): AsyncIterable<FileHandle | DirHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  queryPermission(descriptor: { mode: Mode }): Promise<PermissionResult>
  requestPermission(descriptor: { mode: Mode }): Promise<PermissionResult>
}
type Picker = (options?: { id?: string; mode?: Mode }) => Promise<DirHandle>

const picker = (): Picker | null => {
  if (typeof window === "undefined") return null
  const candidate = (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker
  return typeof candidate === "function" ? candidate.bind(window) : null
}

/* ------------------------------ indexeddb ------------------------------ */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("indexeddb failed"))
  })
}

async function readHandle(): Promise<DirHandle | null> {
  if (typeof indexedDB === "undefined") return null
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(ROOT_KEY)
      request.onsuccess = () => resolve((request.result as DirHandle | undefined) ?? null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function storeHandle(handle: DirHandle | null): Promise<void> {
  if (typeof indexedDB === "undefined") return
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const store = db.transaction(STORE, "readwrite").objectStore(STORE)
      const request = handle ? store.put(handle, ROOT_KEY) : store.delete(ROOT_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })
  } catch {
    // no persistence: the handle lives for this page only
  }
}

/* ---------------------------- copy helpers ---------------------------- */

/** replace the contents of `handle` with `data` */
async function writeInto(handle: FileHandle, data: Uint8Array | Blob): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

/** the child named `name`, whichever kind it is, or null when there is none.
 *  `getFileHandle` throws TypeMismatchError for a directory rather than
 *  answering, so both lookups have to be tried. */
async function childOf(parent: DirHandle, name: string): Promise<FileHandle | DirHandle | null> {
  try {
    return await parent.getFileHandle(name)
  } catch {
    try {
      return await parent.getDirectoryHandle(name)
    } catch {
      return null
    }
  }
}

/**
 * copy every file and folder of `source` into the existing `target`.
 *
 * The File System Access API has no recursive copy and no move on a directory
 * handle, so renaming a folder is copy-then-remove. The copy runs first: if it
 * fails halfway the original folder is still there, and a half-written target
 * is easier to recover from than a deleted source.
 */
async function copyTree(source: DirHandle, target: DirHandle): Promise<void> {
  for await (const child of source.values()) {
    if (child.kind === "directory") {
      await copyTree(child, await target.getDirectoryHandle(child.name, { create: true }))
      continue
    }
    await writeInto(await target.getFileHandle(child.name, { create: true }), await child.getFile())
  }
}

/* ------------------------------ the bridge ------------------------------ */

export class WebLocalBridge implements LocalFsBridge {
  readonly runtime = "web" as const
  private root: DirHandle | null = null
  private loaded = false
  /** the one live object url handed out by `streamUrl`, with what it points at */
  private stream: { stamp: string; url: string } | null = null

  /** the app calls `webLocalBridge()`; the argument exists so a test can hand
   *  in an in-memory root instead of going through IndexedDB and the picker */
  constructor(root: DirHandle | null = null) {
    this.root = root
    this.loaded = root !== null
  }

  isSupported(): boolean {
    return picker() !== null
  }

  private async rootHandle(): Promise<DirHandle | null> {
    if (!this.loaded) {
      this.loaded = true
      this.root = await readHandle()
    }
    return this.root
  }

  private async requireRoot(): Promise<DirHandle> {
    const root = await this.rootHandle()
    // a code, not a sentence: the permission screen translates it
    if (!root) throw new LocalAccessError("no-root")
    const state = await root.queryPermission({ mode: "readwrite" })
    if (state !== "granted") {
      const asked = await root.requestPermission({ mode: "readwrite" })
      if (asked !== "granted") throw new LocalAccessError("denied")
    }
    return root
  }

  async permission(): Promise<LocalPermission> {
    if (!this.isSupported()) return "unsupported"
    const root = await this.rootHandle()
    if (!root) return "prompt"
    try {
      return await root.queryPermission({ mode: "readwrite" })
    } catch {
      return "prompt"
    }
  }

  async requestRoot(): Promise<string | null> {
    const open = picker()
    if (!open) return null
    try {
      const handle = await open({ id: "screenkit-local-root", mode: "readwrite" })
      this.root = handle
      this.loaded = true
      await storeHandle(handle)
      return handle.name
    } catch {
      // the picker was cancelled or refused
      return null
    }
  }

  /** re-grant the remembered handle from a user gesture. After a reload
   *  Chromium answers `queryPermission` with "prompt" for a persisted handle,
   *  and only `requestPermission` can turn that back into "granted". */
  async regrant(): Promise<LocalPermission> {
    const root = await this.rootHandle()
    // nothing remembered: the folder still has to be picked
    if (!root) return "prompt"
    try {
      return await root.requestPermission({ mode: "readwrite" })
    } catch {
      // the call has to happen inside a user gesture; outside one it throws
      return "prompt"
    }
  }

  async forgetRoot(): Promise<void> {
    this.root = null
    this.loaded = true
    // the url outlives the permission otherwise: revoking is the only way to
    // let go of the bytes of a folder the user has just disconnected
    this.releaseStream()
    await storeHandle(null)
  }

  async rootName(): Promise<string | null> {
    const root = await this.rootHandle()
    return root?.name ?? null
  }

  private async dirAt(path: string, create = false): Promise<DirHandle> {
    let current = await this.requireRoot()
    for (const segment of segmentsOf(path)) current = await current.getDirectoryHandle(segment, { create })
    return current
  }

  private async fileAt(path: string, create = false): Promise<FileHandle> {
    const dir = await this.dirAt(parentOf(path), create)
    return dir.getFileHandle(baseNameOf(path), { create })
  }

  private async entryOf(handle: FileHandle | DirHandle, path: string): Promise<LocalEntry> {
    if (handle.kind === "directory") {
      return { path, name: handle.name, kind: "directory", size: 0, modifiedAt: 0, contentType: "" }
    }
    const file = await handle.getFile()
    return {
      path,
      name: handle.name,
      kind: "file",
      size: file.size,
      modifiedAt: file.lastModified,
      contentType: file.type || contentTypeOf(handle.name),
    }
  }

  async scan(options?: { maxEntries?: number }): Promise<LocalScan> {
    const root = await this.requireRoot()
    const limit = options?.maxEntries ?? SCAN_LIMIT
    const scan: LocalScan = { root: root.name, files: 0, directories: 0, bytes: 0, byExtension: {}, truncated: false }
    const stack: DirHandle[] = [root]
    let seen = 0
    while (stack.length > 0) {
      const dir = stack.pop() as DirHandle
      for await (const child of dir.values()) {
        seen += 1
        if (seen > limit) {
          scan.truncated = true
          return scan
        }
        if (child.kind === "directory") {
          scan.directories += 1
          stack.push(child)
          continue
        }
        scan.files += 1
        try {
          const file = await child.getFile()
          scan.bytes += file.size
        } catch {
          // unreadable entries still count as files
        }
        const ext = extensionOf(child.name) || "—"
        scan.byExtension[ext] = (scan.byExtension[ext] ?? 0) + 1
      }
    }
    return scan
  }

  async list(path: string): Promise<LocalEntry[]> {
    const dir = await this.dirAt(path)
    const parent = normalizeRelative(path)
    const entries: LocalEntry[] = []
    // the child name is concatenated, not normalised: a file the bridge would
    // refuse to open must still appear in its folder instead of failing it
    for await (const child of dir.values()) entries.push(await this.entryOf(child, joinRelative(parent, child.name)))
    return entries.sort((a, b) => (a.kind !== b.kind ? (a.kind === "directory" ? -1 : 1) : a.name.localeCompare(b.name)))
  }

  async stat(path: string): Promise<LocalEntry | null> {
    if (!path) {
      const root = await this.requireRoot()
      return this.entryOf(root, "")
    }
    try {
      return await this.entryOf(await this.fileAt(path), path)
    } catch {
      try {
        return await this.entryOf(await this.dirAt(path), path)
      } catch {
        return null
      }
    }
  }

  async read(path: string, options?: { maxBytes?: number }): Promise<Uint8Array> {
    const file = await (await this.fileAt(path)).getFile()
    const max = options?.maxBytes
    const blob = max !== undefined && file.size > max ? file.slice(0, max) : file
    return new Uint8Array(await blob.arrayBuffer())
  }

  /**
   * One object url at a time.
   *
   * `URL.createObjectURL(file)` pins the whole file in memory until something
   * revokes it, and the preview asks for a url per file it opens: clicking
   * through a folder of rushes used to leave every one of them alive for the
   * life of the document — half a gigabyte of footage never released. Only one
   * file is previewed at a time, so the bridge keeps the url for that file and
   * revokes the previous one; `forgetRoot` drops the last. The stamp carries
   * the size and mtime, so a file edited outside the browser gets a fresh url
   * instead of the old snapshot.
   */
  async streamUrl(path: string): Promise<string | null> {
    const file = await (await this.fileAt(path)).getFile()
    const stamp = `${path}#${file.lastModified}#${file.size}`
    if (this.stream?.stamp === stamp) return this.stream.url
    this.releaseStream()
    this.stream = { stamp, url: URL.createObjectURL(file) }
    return this.stream.url
  }

  private releaseStream(): void {
    if (!this.stream) return
    URL.revokeObjectURL(this.stream.url)
    this.stream = null
  }

  async write(path: string, content: Uint8Array): Promise<LocalEntry> {
    const handle = await this.fileAt(path, true)
    await writeInto(handle, content)
    return this.entryOf(handle, path)
  }

  async mkdir(path: string): Promise<LocalEntry> {
    const dir = await this.dirAt(path, true)
    return this.entryOf(dir, path)
  }

  /**
   * rename or move one entry. Directories are copied recursively and then
   * removed, because the api offers no directory move: the file manager
   * advertises `move: true` for every kind, and a folder rename used to reach
   * `getFileHandle` and die with a raw TypeMismatchError.
   */
  async move(from: string, to: string): Promise<LocalEntry> {
    const source = normalizeRelative(from)
    const destination = normalizeRelative(to)
    if (!source || !destination) throw new LocalAccessError("path", "the root cannot be moved")
    // a folder copied into its own subtree would recurse until the disk fills
    if (isWithin(destination, source)) throw new LocalAccessError("move-into-self")

    const sourceParent = await this.dirAt(parentOf(source))
    const name = baseNameOf(source)
    const entry = await childOf(sourceParent, name)
    if (!entry) throw new LocalAccessError("not-found", source)

    if (entry.kind === "file") {
      const target = await this.fileAt(destination, true)
      await writeInto(target, await entry.getFile())
      await sourceParent.removeEntry(name)
      return this.entryOf(target, destination)
    }

    const target = await this.dirAt(destination, true)
    await copyTree(entry, target)
    await sourceParent.removeEntry(name, { recursive: true })
    return this.entryOf(target, destination)
  }

  async remove(path: string): Promise<void> {
    const parent = await this.dirAt(parentOf(path))
    await parent.removeEntry(baseNameOf(path), { recursive: true })
  }
}

let shared: WebLocalBridge | null = null

/** the one web bridge for this page */
export function webLocalBridge(): WebLocalBridge {
  if (!shared) shared = new WebLocalBridge()
  return shared
}
