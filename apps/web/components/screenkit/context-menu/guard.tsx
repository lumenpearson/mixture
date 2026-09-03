"use client"

import * as React from "react"

/* ------------------------------------------------------------------ *
 * native context menu guard
 *
 * The app draws its own menus, so the browser's is suppressed everywhere
 * except inside text fields (spell-check, paste) and elements that opt
 * out with data-native-menu. Radix triggers call preventDefault on their
 * own, so this only affects surfaces without a menu.
 * ------------------------------------------------------------------ */

function allowsNative(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest("[data-native-menu]")) return true
  const editable = target.closest("input, textarea, [contenteditable='true'], a[href]")
  return Boolean(editable)
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
