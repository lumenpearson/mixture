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

/* ------------------------------ failures ------------------------------ */

/**
 * why a local operation failed, in terms the interface can translate.
 *
 * Runtime failures arrive as English DOMExceptions ("The path supplied
 * exists, but was not an entry of the requested type.") and as messages the
 * Rust shell formats. Printing those verbatim breaks the rule that every
 * visible string comes from the dictionary in both locales, so a bridge
 * raises a code instead and the ui maps it to a `local.error.*` key.
 */
export type LocalErrorCode =
  /** no folder has been granted yet */
  | "no-root"
  /** the runtime refused, or the user declined the permission prompt */
  | "denied"
  /** the path escapes the root or carries a forbidden character */
  | "path"
  /** nothing at that path */
  | "not-found"
  /** a folder would be moved into itself */
  | "move-into-self"
  /** reading or writing failed for a reason the bridge cannot name */
  | "io"

export class LocalAccessError extends Error {
  readonly code: LocalErrorCode
  constructor(code: LocalErrorCode, message?: string) {
    // the message is for the console and bug reports; the ui reads the code
    super(message ?? code)
    this.name = "LocalAccessError"
    this.code = code
  }
}

/** the code of a bridge failure, or null for anything else (a DOMException,
 *  a quota error) — the caller falls back to its generic message */
export function localErrorCode(error: unknown): LocalErrorCode | null {
  return error instanceof LocalAccessError ? error.code : null
}

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
  /**
   * ask the runtime to grant the root it already remembers again, from a user
   * gesture, and answer with the resulting permission.
   *
   * Optional: only the web runtime loses access across a reload. Chromium
   * keeps the directory handle in IndexedDB but answers `queryPermission`
   * with "prompt" until the user confirms once, and `requestPermission` is
   * the only way to confirm — without this the remembered handle is dead
   * weight and the folder has to be picked again. The desktop and expo
   * shells store the root themselves and never need it.
   */
  regrant?(): Promise<LocalPermission>
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
