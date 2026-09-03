"use client"

import { isTauriRuntime } from "@/lib/local/bridge"
import * as React from "react"
import {
  desktopSettingsStore,
  minSizeOf,
  titlebarHeight,
  type DesktopSettings,
} from "./desktop-settings"

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

/** how long the window has to sit still before its geometry is written down */
const REMEMBER_DEBOUNCE_MS = 400

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

  const restored = React.useRef(false)
  React.useEffect(() => {
    if (!active || restored.current) return
    restored.current = true
    const { rememberBounds, bounds, startMaximized } = latest.current
    void withWindow(async (win, { LogicalPosition, LogicalSize }) => {
      if (rememberBounds && bounds) {
        await win.setSize(new LogicalSize(bounds.width, bounds.height))
        await win.setPosition(new LogicalPosition(bounds.x, bounds.y))
      }
      if (startMaximized) await win.maximize()
    })
  }, [active])

  // remember the geometry while the window is moved or resized. A maximized
  // window is skipped: its rect is the monitor, and restoring it as a normal
  // window would open a screen-sized window that is not maximized.
  React.useEffect(() => {
    if (!active || !settings.rememberBounds) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const unlisten: (() => void)[] = []

    void (async () => {
      try {
        const { getCurrentWindow } = await api()
        const win = getCurrentWindow()
        const save = async () => {
          if (await win.isMaximized()) return
          const factor = await win.scaleFactor()
          const size = (await win.outerSize()).toLogical(factor)
          const position = (await win.outerPosition()).toLogical(factor)
          desktopSettingsStore.rememberBounds({
            width: size.width,
            height: size.height,
            x: position.x,
            y: position.y,
          })
        }
        const schedule = () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => {
            timer = null
            void save().catch(() => {})
          }, REMEMBER_DEBOUNCE_MS)
        }
        unlisten.push(await win.onResized(schedule), await win.onMoved(schedule))
        if (!alive) unlisten.forEach((stop) => stop())
      } catch {
        // no window permission: nothing to remember
      }
    })()

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      unlisten.forEach((stop) => stop())
    }
  }, [active, settings.rememberBounds])
}
