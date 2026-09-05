"use client"

import * as React from "react"

/* ------------------------------------------------------------------ *
 * native context menu guard
 *
 * The decision, spelled out because the previous comment claimed more than
 * the code did: the browser menu is suppressed app-wide, and let through on
 * the targets where it offers something this app does not.
 *
 * App-wide, not per-region, because the shell is a workspace that the desktop
 * (Tauri) and android shells embed as their whole window; a browser menu over
 * the rail, a card grid or a panel gutter is the one place the illusion
 * breaks. Custom menus exist on three surfaces today (the library grid, a
 * library card, the preview stage) and Radix calls preventDefault for those
 * itself, so this listener only ever decides what happens in the gaps.
 *
 * What is let through:
 *   - a non-collapsed selection covering the target — copy, search and
 *     translate act on selected text and no app menu replaces them. This is
 *     what used to be broken: right-clicking a selected prompt gave nothing.
 *   - text fields and contenteditable regions — paste, spell-check,
 *     dictation. `[contenteditable]:not([contenteditable='false'])` matches
 *     the bare attribute too; `contenteditable=""` is valid html for true.
 *   - links and media — "open in new tab", "save image as", "download
 *     video", picture-in-picture.
 *   - anything under `data-native-menu`, the explicit opt-out.
 * ------------------------------------------------------------------ */

/** put `data-native-menu` on a subtree that wants the browser menu back */
export const NATIVE_MENU_OPT_OUT = "[data-native-menu]"

/** targets whose browser menu carries actions the app does not offer */
export const NATIVE_MENU_SURFACES = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "a[href]",
  /* Only the media elements whose browser menu carries something this app
     does not offer — save image, download video, picture-in-picture. `svg`
     and `canvas` were here too and cost more than they gave: every lucide
     glyph is an inline <svg> and every insert scene is a <canvas>, so a
     right-click landing on a rail icon opened chrome's generic page menu
     while the same click three pixels away on the button's padding did not.
     Chromium offers nothing svg- or canvas-specific anyway. */
  "img",
  "picture",
  "video",
  "audio",
  "embed",
  "object",
].join(", ")

const NATIVE_MENU_SELECTOR = `${NATIVE_MENU_OPT_OUT}, ${NATIVE_MENU_SURFACES}`

/** is there a real selection, and does it cover what was right-clicked? */
function selectionCovers(target: Node): boolean {
  const selection = typeof window === "undefined" ? null : window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false
  try {
    // partial containment: the click usually lands on one node of a range
    return selection.containsNode(target, true)
  } catch {
    return false
  }
}

function allowsNative(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (selectionCovers(target)) return true
  return target.closest(NATIVE_MENU_SELECTOR) !== null
}

export function ContextMenuGuard() {
  React.useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (allowsNative(event.target)) return
      event.preventDefault()
    }
    document.addEventListener("contextmenu", onContextMenu)
    return () => document.removeEventListener("contextmenu", onContextMenu)
  }, [])
  return null
}
