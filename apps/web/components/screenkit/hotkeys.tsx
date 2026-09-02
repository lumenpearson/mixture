"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { useScreenkit, type Section } from "./store"

/* ------------------------------------------------------------------ *
 * global keyboard shortcuts
 *
 *   ctrl/⌘+k open the command palette
 *   /        search the library
 *   [ / ]    previous / next insert (preview + metadata)
 *   f        open the selected insert as a fullscreen screen-state
 *   s        toggle the selected insert as favourite
 *   1 … 7    jump to a section
 *
 * Shortcuts never fire inside text fields or with a modifier held, so they
 * cannot collide with browser or OS combinations.
 * ------------------------------------------------------------------ */

export const SEARCH_INPUT_ID = "screenkit-library-search"

/** window event that opens the ctrl/cmd+k command palette */
export const COMMAND_PALETTE_EVENT = "screenkit:command-palette"

export function openCommandPalette(detail?: { query?: string }) {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT, { detail }))
}

const SECTION_KEYS: Record<string, Section> = {
  "1": "overview",
  "2": "library",
  "3": "preview",
  "4": "timeline",
  "5": "prompts",
  "6": "style",
  "7": "cloud",
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

export function focusLibrarySearch() {
  window.requestAnimationFrame(() => {
    const input = document.getElementById(SEARCH_INPUT_ID)
    if (input instanceof HTMLInputElement) {
      input.focus()
      input.select()
    }
  })
}

export function Hotkeys() {
  const { section, setSection, selectedId, stepInsert, toggleFavorite } = useScreenkit()
  const router = useRouter()
  const latest = React.useRef({ section, selectedId })
  React.useEffect(() => {
    latest.current = { section, selectedId }
  }, [section, selectedId])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      // the palette works from anywhere, text fields included
      if ((event.metaKey || event.ctrlKey) && !event.altKey && (event.key === "k" || event.key === "K")) {
        event.preventDefault()
        openCommandPalette()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditable(event.target)) return
      // radix overlays trap focus on their own; leave them alone
      if (document.querySelector("[role='dialog'][data-state='open']")) return

      const key = event.key
      const current = latest.current

      if (key === "/") {
        event.preventDefault()
        setSection("library")
        focusLibrarySearch()
        return
      }
      if (key === "[" || key === "]") {
        if (current.section !== "preview" && current.section !== "prompts") return
        event.preventDefault()
        stepInsert(key === "[" ? -1 : 1)
        return
      }
      if (key === "f" || key === "F") {
        if (current.section !== "preview" || !current.selectedId) return
        event.preventDefault()
        router.push(`/insert/${encodeURIComponent(current.selectedId)}`)
        return
      }
      if (key === "s" || key === "S") {
        if ((current.section !== "preview" && current.section !== "prompts") || !current.selectedId) return
        event.preventDefault()
        toggleFavorite(current.selectedId)
        return
      }
      const target = SECTION_KEYS[key]
      if (target) {
        event.preventDefault()
        setSection(target)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router, setSection, stepInsert, toggleFavorite])

  return null
}
