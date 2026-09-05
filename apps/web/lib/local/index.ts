import { isTauriRuntime, type LocalFsBridge } from "./bridge"
import { createTauriBridge } from "./tauri"
import { webLocalBridge } from "./web"

/* ------------------------------------------------------------------ *
 * which local file runtime this page got
 *
 * The same build serves the browser and the Tauri window, so the runtime is
 * decided once, here, by looking at the window rather than at an env flag.
 * Importing the desktop bridge costs a plain browser nothing: `tauri.ts` pulls
 * `@tauri-apps/api` in only when a method runs, so the module stays inert
 * outside the shell and on the server.
 * ------------------------------------------------------------------ */

let shared: LocalFsBridge | null = null

/** the local file bridge for this runtime — Tauri inside the desktop shell, the browser api otherwise */
export function localBridge(): LocalFsBridge {
  if (!shared) shared = isTauriRuntime() ? createTauriBridge() : webLocalBridge()
  return shared
}

export type { LocalFsBridge }
