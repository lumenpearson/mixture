"use client"

import { isTauriRuntime } from "@/lib/local/bridge"
import * as React from "react"
import { desktopSettingsStore, minSizeOf, titlebarHeight, type DesktopSettings } from "./desktop-settings"

/* ------------------------------------------------------------------ *
 * the window, as react hooks
 *
 * `@tauri-apps/api/window` is imported lazily, inside effects and handlers,
 * so a browser tab never loads it: the module sits in its own chunk that
 * only the desktop shell ever asks for. Every call is wrapped — the shell's
 * capabilities decide which window commands exist, and a refused permission
 * must leave the page working rather than throw through a click handler.
 * ------------------------------------------------------------------ */

type WindowApi = typeof import("@tauri-apps/api/window")
type TauriWindow = ReturnType<WindowApi["getCurrentWindow"]>

let cached: Promise<WindowApi> | null = null

const api = (): Promise<WindowApi> => {
  if (!cached) cached = import("@tauri-apps/api/window")
  return cached
}

/** run something against the current window, swallowing an unavailable command */
async function withWindow(run: (win: TauriWindow, api: WindowApi) => Promise<void>) {
  try {
    const mod = await api()
    await run(mod.getCurrentWindow(), mod)
  } catch {
    // no window permission (or no shell at all): nothing to apply
  }
}

/**
 * true once the page is known to run inside Tauri. The check touches
 * `window`, so it happens after mount: the server render and the first
 * client render agree that this is a browser, and the desktop chrome
 * appears one frame later.
 */
export function useIsTauri(): boolean {
  const [tauri, setTauri] = React.useState(false)
  React.useEffect(() => setTauri(isTauriRuntime()), [])
  return tauri
}

/** read and change the desktop settings from any component */
export function useDesktopSettings() {
  const settings = React.useSyncExternalStore(
    desktopSettingsStore.subscribe,
    desktopSettingsStore.get,
    desktopSettingsStore.getServer,
  )
  const update = React.useCallback(
    (patch: Partial<DesktopSettings>) => desktopSettingsStore.update(patch),
    [],
  )
  const reset = React.useCallback(() => desktopSettingsStore.reset(), [])
  return { settings, update, reset }
}

/* --------------------------- window buttons --------------------------- */

export type WindowControls = {
  /** whether the window is maximized, so the middle button can swap its icon */
  maximized: boolean
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  /** call from the drag region's pointerdown; see `toggleMaximizeOnDoubleClick` */
  notePointerDown: () => void
  /** the drag region's dblclick handler */
  toggleMaximizeOnDoubleClick: () => void
}

export function useWindowControls(active: boolean): WindowControls {
  const [maximized, setMaximized] = React.useState(false)

  // the window can be maximized by a double-click on our drag region, by an
  // os shortcut or by dragging it to the top edge — only `onResized` sees all
  // three, so the icon follows the event rather than our own click
  React.useEffect(() => {
    if (!active) return
    let alive = true
    let unlisten: (() => void) | undefined
    void (async () => {
      try {
        const { getCurrentWindow } = await api()
        const win = getCurrentWindow()
        const sync = async () => {
          const value = await win.isMaximized()
          if (alive) setMaximized(value)
        }
        await sync()
        unlisten = await win.onResized(() => void sync())
        if (!alive) unlisten()
      } catch {
        // no window permission: the icon keeps its initial shape
      }
    })()
    return () => {
      alive = false
      unlisten?.()
    }
  }, [active])

  const minimize = React.useCallback(() => void withWindow((win) => win.minimize()), [])
  const toggleMaximize = React.useCallback(() => void withWindow((win) => win.toggleMaximize()), [])
  const close = React.useCallback(() => void withWindow((win) => win.close()), [])

  // the shell's own drag-region script may already toggle the window on the
  // second mousedown, before our `dblclick` handler ever runs. Comparing the
  // window against what it was when the press started tells the two worlds
  // apart: if it already changed, a second toggle would simply undo it.
  const now = React.useRef(false)
  React.useEffect(() => {
    now.current = maximized
  }, [maximized])
  const atPress = React.useRef(false)

  const notePointerDown = React.useCallback(() => {
    atPress.current = now.current
  }, [])

  const toggleMaximizeOnDoubleClick = React.useCallback(
    () =>
      void withWindow(async (win) => {
        if ((await win.isMaximized()) !== atPress.current) return
        await win.toggleMaximize()
      }),
    [],
  )

  return { maximized, minimize, toggleMaximize, close, notePointerDown, toggleMaximizeOnDoubleClick }
}

/* ------------------------------ the chrome ------------------------------ */

/**
 * ask the window-state plugin to put the window back where it was.
 *
 * The plugin (apps/desktop/src-tauri/src/lib.rs) tracks and saves size,
 * position and maximized state by itself, but is registered with
 * `skip_initial_state`, so nothing is restored until this runs — which is
 * what makes the "remember size and position" switch mean something. The
 * flags are deliberately not sent: the shell decides what is remembered, and
 * a second list here would be a second answer to the same question.
 */
async function restoreWindowState(): Promise<void> {
  try {
    const [{ invoke }, { getCurrentWindow }] = await Promise.all([
      import("@tauri-apps/api/core"),
      api(),
    ])
    await invoke("plugin:window-state|restore_state", { label: getCurrentWindow().label })
  } catch {
    // nothing saved yet, or the command is not in this build's capabilities
  }
}

/**
 * apply the desktop settings to the actual window and publish the title bar
 * height to css.
 *
 * `--sk-titlebar-h` is written on `<html>` only inside Tauri; everywhere
 * else it keeps the `0px` from `globals.css`, so anything positioned under
 * the bar sits at the top of the viewport on the web.
 */
export function useDesktopChrome(active: boolean, settings: DesktopSettings) {
  const height = titlebarHeight(settings)

  React.useEffect(() => {
    if (!active) return
    const root = document.documentElement
    root.style.setProperty("--sk-titlebar-h", `${height}px`)
    root.dataset.skTitlebar = height > 0 ? "on" : "off"
    return () => {
      root.style.removeProperty("--sk-titlebar-h")
      delete root.dataset.skTitlebar
    }
  }, [active, height])

  // always on top follows the switch, and is re-applied on start because the
  // shell always opens a normal window
  React.useEffect(() => {
    if (!active) return
    void withWindow((win) => win.setAlwaysOnTop(settings.alwaysOnTop))
  }, [active, settings.alwaysOnTop])

  React.useEffect(() => {
    if (!active) return
    const size = minSizeOf(settings.minSize)
    void withWindow((win, { LogicalSize }) =>
      win.setMinSize(size ? new LogicalSize(size.width, size.height) : null),
    )
  }, [active, settings.minSize])

  // the settings the start-up effect reads. It runs once, one render after
  // mount (when `active` flips), by which time the store has replaced the
  // hydration defaults with what was persisted — hence a ref rather than a
  // dependency: a later toggle must not move the window back to where it was.
  const latest = React.useRef(settings)
  React.useEffect(() => {
    latest.current = settings
  })

  // Restoring is the only geometry work left on this side: saving happens
  // natively, on every move and resize and again when the window closes, so
  // a crash cannot cost the user their layout and clearing localStorage
  // cannot either.
  const restored = React.useRef(false)
  React.useEffect(() => {
    if (!active || restored.current) return
    restored.current = true
    const { rememberBounds, startMaximized } = latest.current
    void (async () => {
      if (rememberBounds) await restoreWindowState()
      if (startMaximized) await withWindow((win) => win.maximize())
    })()
  }, [active])
}
