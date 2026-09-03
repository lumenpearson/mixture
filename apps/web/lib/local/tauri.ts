import { contentTypeOf } from "@/lib/media/kinds"
import {
  TAURI_COMMANDS,
  isTauriRuntime,
  type LocalEntry,
  type LocalFsBridge,
  type LocalPermission,
  type LocalScan,
} from "./bridge"

/* ------------------------------------------------------------------ *
 * the desktop runtime of the local file bridge: Tauri 2 commands
 *
 * The window shows the deployed site, so this module is the browser half of
 * apps/desktop/src-tauri: every method is one `invoke` of the matching
 * TAURI_COMMANDS name, and the shell answers with the same LocalEntry and
 * LocalScan shapes the web bridge builds. Paths stay root-relative posix in
 * both directions; the one absolute path — the file the asset protocol
 * streams — never leaves this module without convertFileSrc.
 *
 * `@tauri-apps/api` is imported lazily so a plain browser never loads it: the
 * web build ships the module in its own chunk that only the desktop shell asks
 * for. No React here, this is the bridge, not the ui.
 * ------------------------------------------------------------------ */

type Core = typeof import("@tauri-apps/api/core")

let core: Promise<Core> | null = null

const api = (): Promise<Core> => {
  if (!core) core = import("@tauri-apps/api/core")
  return core
}

async function call<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  const { invoke } = await api()
  return invoke<T>(command, payload)
}

/* ------------------------------ mapping ------------------------------ */

type RawEntry = {
  path?: unknown
  name?: unknown
  kind?: unknown
  size?: unknown
  modifiedAt?: unknown
  contentType?: unknown
}

const text = (value: unknown): string => (typeof value === "string" ? value : "")
const count = (value: unknown): number => {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toEntry(raw: RawEntry): LocalEntry {
  const path = text(raw.path)
  const name = text(raw.name) || (path.split("/").pop() ?? "")
  const kind = raw.kind === "directory" ? "directory" : "file"
  return {
    path,
    name,
    kind,
    size: kind === "directory" ? 0 : count(raw.size),
    modifiedAt: kind === "directory" ? 0 : count(raw.modifiedAt),
    // the shell guesses from the extension too; this only covers what mime_guess misses
    contentType: kind === "directory" ? "" : text(raw.contentType) || contentTypeOf(name),
  }
}

function toScan(raw: unknown): LocalScan {
  const source = (raw ?? {}) as Record<string, unknown>
  const extensions = (source.byExtension ?? {}) as Record<string, unknown>
  const byExtension: Record<string, number> = {}
  for (const [extension, value] of Object.entries(extensions)) byExtension[extension] = count(value)
  return {
    root: text(source.root),
    files: count(source.files),
    directories: count(source.directories),
    bytes: count(source.bytes),
    byExtension,
    truncated: source.truncated === true,
  }
}

/** the shell answers `local_read` with a raw ipc body; older transports send an array */
function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (Array.isArray(value)) return Uint8Array.from(value as number[])
  return new Uint8Array()
}

const PERMISSIONS: readonly LocalPermission[] = ["granted", "denied", "prompt", "unsupported"]

/* ------------------------------ the bridge ------------------------------ */

export class TauriLocalBridge implements LocalFsBridge {
  readonly runtime = "tauri" as const

  isSupported(): boolean {
    return isTauriRuntime()
  }

  async permission(): Promise<LocalPermission> {
    if (!this.isSupported()) return "unsupported"
    const state = await call<string>(TAURI_COMMANDS.permission)
    return PERMISSIONS.includes(state as LocalPermission) ? (state as LocalPermission) : "prompt"
  }

  async requestRoot(): Promise<string | null> {
    return (await call<string | null>(TAURI_COMMANDS.requestRoot)) ?? null
  }

  async forgetRoot(): Promise<void> {
    await call<null>(TAURI_COMMANDS.forgetRoot)
  }

  async rootName(): Promise<string | null> {
    return (await call<string | null>(TAURI_COMMANDS.rootName)) ?? null
  }

  async scan(options?: { maxEntries?: number }): Promise<LocalScan> {
    return toScan(await call<unknown>(TAURI_COMMANDS.scan, { maxEntries: options?.maxEntries ?? null }))
  }

  async list(path: string): Promise<LocalEntry[]> {
    const entries = await call<RawEntry[]>(TAURI_COMMANDS.list, { path })
    return (entries ?? []).map(toEntry)
  }

  async stat(path: string): Promise<LocalEntry | null> {
    const entry = await call<RawEntry | null>(TAURI_COMMANDS.stat, { path })
    return entry ? toEntry(entry) : null
  }

  async read(path: string, options?: { maxBytes?: number }): Promise<Uint8Array> {
    return toBytes(await call<unknown>(TAURI_COMMANDS.read, { path, maxBytes: options?.maxBytes ?? null }))
  }

  async streamUrl(path: string): Promise<string | null> {
    const absolute = await call<string | null>(TAURI_COMMANDS.streamUrl, { path })
    if (!absolute) return null
    const { convertFileSrc } = await api()
    return convertFileSrc(absolute)
  }

  async write(path: string, content: Uint8Array): Promise<LocalEntry> {
    // the ipc payload is json, so the bytes travel as a plain number array
    return toEntry(await call<RawEntry>(TAURI_COMMANDS.write, { path, content: Array.from(content) }))
  }

  async mkdir(path: string): Promise<LocalEntry> {
    return toEntry(await call<RawEntry>(TAURI_COMMANDS.mkdir, { path }))
  }

  async move(from: string, to: string): Promise<LocalEntry> {
    return toEntry(await call<RawEntry>(TAURI_COMMANDS.move, { from, to }))
  }

  async remove(path: string): Promise<void> {
    await call<null>(TAURI_COMMANDS.remove, { path })
  }
}

let shared: TauriLocalBridge | null = null

/** the one desktop bridge for this window */
export function createTauriBridge(): LocalFsBridge {
  if (!shared) shared = new TauriLocalBridge()
  return shared
}
