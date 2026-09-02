/* ------------------------------------------------------------------ *
 * local file bridge — the contract every "local files" runtime implements
 *
 * The cloud tab can browse local folders the same way it browses the GitHub
 * repository. Three runtimes provide the bytes:
 *   - web: the File System Access API (Chromium), `showDirectoryPicker`
 *   - desktop: Tauri 2 commands (see apps/desktop/src-tauri)
 *   - mobile: the Expo app reads through expo-file-system
 * All of them speak this interface; the file manager never touches a runtime
 * API directly. Paths are posix, relative to the granted root, never
 * absolute — the physical location stays inside the runtime.
 * ------------------------------------------------------------------ */

export type LocalEntryKind = "file" | "directory"

export type LocalEntry = {
  /** root-relative posix path, "" for the root itself */
  path: string
  name: string
  kind: LocalEntryKind
  size: number
  /** unix ms, 0 when unknown */
  modifiedAt: number
  contentType: string
}

/** the result of scanning a granted root (shown on the permission screen) */
export type LocalScan = {
  root: string
  files: number
  directories: number
  bytes: number
  /** extension → count, lower-case, without the dot */
  byExtension: Record<string, number>
  truncated: boolean
}

export type LocalPermission = "granted" | "denied" | "prompt" | "unsupported"

export interface LocalFsBridge {
  /** which runtime backs this bridge */
  readonly runtime: "web" | "tauri" | "expo"
  /** whether the runtime can provide local files at all */
  isSupported(): boolean
  /** current permission for the remembered root, without prompting */
  permission(): Promise<LocalPermission>
  /** ask the user for a folder; resolves to its display name or null when cancelled */
  requestRoot(): Promise<string | null>
  /** forget the granted root */
  forgetRoot(): Promise<void>
  /** display name of the granted root, null when none */
  rootName(): Promise<string | null>
  scan(options?: { maxEntries?: number }): Promise<LocalScan>
  list(path: string): Promise<LocalEntry[]>
  stat(path: string): Promise<LocalEntry | null>
  read(path: string, options?: { maxBytes?: number }): Promise<Uint8Array>
  /** a url the runtime can stream (object url on the web, asset url elsewhere) */
  streamUrl(path: string): Promise<string | null>
  write(path: string, content: Uint8Array): Promise<LocalEntry>
  mkdir(path: string): Promise<LocalEntry>
  move(from: string, to: string): Promise<LocalEntry>
  remove(path: string): Promise<void>
}

/* names of the Tauri commands the desktop shell exposes; the web bridge for
   Tauri calls `invoke(name, args)` with exactly these payloads */
export const TAURI_COMMANDS = {
  permission: "local_permission",
  requestRoot: "local_request_root",
  forgetRoot: "local_forget_root",
  rootName: "local_root_name",
  scan: "local_scan",
  list: "local_list",
  stat: "local_stat",
  read: "local_read",
  streamUrl: "local_stream_url",
  write: "local_write",
  mkdir: "local_mkdir",
  move: "local_move",
  remove: "local_remove",
} as const

export type TauriCommand = (typeof TAURI_COMMANDS)[keyof typeof TAURI_COMMANDS]

/** true when the page runs inside the Tauri desktop shell */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/** true when the page runs inside the Expo / React Native web view */
export function isExpoRuntime(): boolean {
  return typeof window !== "undefined" && "__MIXTURE_EXPO__" in window
}
