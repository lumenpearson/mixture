"use client"

import type { CloudSettings } from "@/lib/cloud/settings"
import { cn } from "@/lib/utils"
import { EntryKind, type Entry } from "@mixture/protocol/cloud"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"
import { EntryRow, EntryTile, type EntryActions } from "./entry-row"
import { FmMenu, FmMenuTrigger } from "./menu"
import type { CloudProvider } from "./provider"

/* ------------------------------------------------------------------ *
 * the listing: a listbox of entries, in rows or tiles
 *
 * Owns exactly three things — which row holds the roving tabindex, how many
 * rows have been rendered so far, and the drag-over highlight. Selection,
 * renaming and every action live above it, so the same listing serves the
 * folder view and the search results.
 *
 * Rows are appended in pages rather than virtualised: a 2 000-entry folder
 * draws 200 rows and grows as the sentinel scrolls into view, which keeps
 * Ctrl+A, the roving tabindex and Cmd+F over the page all intact.
 * ------------------------------------------------------------------ */

const PAGE = 200
const TILE_MIN_PX = 140

export type ListingProps = {
  entries: readonly Entry[]
  loading: boolean
  canEdit: boolean
  settings: CloudSettings
  actions: EntryActions
  provider: CloudProvider
  favorites: ReadonlySet<string>
  selection: ReadonlySet<string>
  setSelection: (paths: string[]) => void
  renamingPath: string | null
  onRenameSubmit: (entry: Entry, name: string) => void
  onRenameCancel: () => void
  onDeleteSelection: () => void
  onDropFiles: (transfer: DataTransfer) => void
  /** the menu shown on empty space, built by the manager */
  emptyAreaMenu: React.ReactNode
  emptyLabel: string
}

export function Listing(props: ListingProps) {
  const { entries, settings, selection, setSelection, actions, canEdit, onDeleteSelection } = props
  const { t } = useScreenkit()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [visibleCount, setVisibleCount] = React.useState(PAGE)
  const [dragging, setDragging] = React.useState(false)
  const [columns, setColumns] = React.useState(1)
  const anchor = React.useRef(0)
  const gridRef = React.useRef<HTMLUListElement | null>(null)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  const grid = settings.view === "grid"
  // deleting the last entry can leave the roving index past the end; clamp for
  // rendering instead of correcting state, so no render schedules another one.
  // The manager remounts the listing (via `key`) when the folder changes.
  const active = entries.length ? Math.min(activeIndex, entries.length - 1) : 0

  React.useEffect(() => {
    const node = sentinelRef.current
    if (!node || visibleCount >= entries.length) return
    if (typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver((records) => {
      if (records.some((record) => record.isIntersecting)) {
        setVisibleCount((current) => Math.min(entries.length, current + PAGE))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [visibleCount, entries.length])

  React.useEffect(() => {
    const node = gridRef.current
    if (!grid || !node || typeof ResizeObserver === "undefined") {
      setColumns(1)
      return
    }
    const measure = () => setColumns(Math.max(1, Math.floor(node.clientWidth / TILE_MIN_PX)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [grid])

  const selectRange = React.useCallback(
    (from: number, to: number) => {
      const [start, end] = from <= to ? [from, to] : [to, from]
      setSelection(entries.slice(start, end + 1).map((entry) => entry.path))
    },
    [entries, setSelection],
  )

  const onPointerSelect = React.useCallback(
    (index: number, event: React.MouseEvent) => {
      const entry = entries[index]
      if (!entry) return
      setActiveIndex(index)
      if (event.shiftKey) {
        selectRange(anchor.current, index)
        return
      }
      if (event.metaKey || event.ctrlKey) {
        anchor.current = index
        const next = new Set(selection)
        if (next.has(entry.path)) next.delete(entry.path)
        else next.add(entry.path)
        setSelection([...next])
        return
      }
      anchor.current = index
      setSelection([entry.path])
    },
    [entries, selection, selectRange, setSelection],
  )

  const move = React.useCallback(
    (index: number, extend: boolean) => {
      const clamped = Math.max(0, Math.min(entries.length - 1, index))
      setActiveIndex(clamped)
      // keep the row we are about to focus rendered
      setVisibleCount((current) => (clamped >= current ? Math.min(entries.length, clamped + PAGE) : current))
      if (extend) selectRange(anchor.current, clamped)
      else {
        anchor.current = clamped
        const entry = entries[clamped]
        if (entry) setSelection([entry.path])
      }
    },
    [entries, selectRange, setSelection],
  )

  const onKeyDown = React.useCallback(
    (index: number, event: React.KeyboardEvent<HTMLElement>) => {
      const entry = entries[index]
      const step = grid ? columns : 1
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault()
          move(index + step, event.shiftKey)
          return
        case "ArrowUp":
          event.preventDefault()
          move(index - step, event.shiftKey)
          return
        case "ArrowRight":
          if (!grid) return
          event.preventDefault()
          move(index + 1, event.shiftKey)
          return
        case "ArrowLeft":
          if (!grid) return
          event.preventDefault()
          move(index - 1, event.shiftKey)
          return
        case "Home":
          event.preventDefault()
          move(0, event.shiftKey)
          return
        case "End":
          event.preventDefault()
          move(entries.length - 1, event.shiftKey)
          return
        case "Enter":
          event.preventDefault()
          if (entry) actions.open(entry)
          return
        case "F2":
          event.preventDefault()
          if (entry?.editable && canEdit) actions.startRename(entry)
          return
        case "Delete":
        case "Backspace":
          if (!canEdit) return
          event.preventDefault()
          onDeleteSelection()
          return
        case " ":
          event.preventDefault()
          if (!entry) return
          anchor.current = index
          setSelection(
            selection.has(entry.path)
              ? [...selection].filter((path) => path !== entry.path)
              : [...selection, entry.path],
          )
          return
        case "Escape":
          setSelection([])
          return
        case "a":
        case "A":
          if (!event.metaKey && !event.ctrlKey) return
          event.preventDefault()
          setSelection(entries.map((item) => item.path))
          return
        default:
      }
    },
    [entries, grid, columns, move, actions, canEdit, onDeleteSelection, selection, setSelection],
  )

  const shown = entries.slice(0, visibleCount)
  const shared = {
    canEdit,
    settings,
    actions,
    provider: props.provider,
    onPointerSelect,
    onKeyDown,
    onRenameSubmit: props.onRenameSubmit,
    onRenameCancel: props.onRenameCancel,
  }

  return (
    <div
      className={cn(
        "relative min-w-0 rounded-3xl border transition-colors",
        dragging ? "border-ring bg-panel-hover" : "border-panel-border bg-panel-soft",
      )}
      onDragOver={(event) => {
        if (!props.canEdit) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDragging(false)
      }}
      onDrop={(event) => {
        if (!props.canEdit) return
        event.preventDefault()
        setDragging(false)
        props.onDropFiles(event.dataTransfer)
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-panel-soft/80 font-mono text-sm lowercase text-foreground">
          {t("cloudfm.upload.dropHint")}
        </div>
      ) : null}

      {!grid ? (
        <div className="hidden grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_auto] items-center gap-3 border-b border-panel-border/60 px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-text-faint sm:grid">
          <span>{t("cloud.name")}</span>
          <span>{t("cloud.visibility")}</span>
          <span className="text-right">{t("cloud.size")}</span>
          <span className="text-right">{t("cloud.actions")}</span>
        </div>
      ) : null}

      {props.loading && !entries.length ? (
        <div className="flex items-center gap-2 px-4 py-6 font-mono text-[12px] lowercase text-text-muted" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> {t("cloud.loading")}
        </div>
      ) : entries.length === 0 ? (
        <FmMenu>
          <FmMenuTrigger asChild>
            <div className="px-4 py-10 text-center font-mono text-[12px] lowercase text-text-muted">
              {props.emptyLabel}
            </div>
          </FmMenuTrigger>
          {props.emptyAreaMenu}
        </FmMenu>
      ) : (
        <FmMenu>
          <FmMenuTrigger asChild>
            <div className="min-w-0">
              <ul
                ref={gridRef}
                role="listbox"
                aria-multiselectable="true"
                aria-label={t("cloud.title")}
                className={cn(
                  "min-w-0",
                  grid
                    ? "grid gap-2 p-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]"
                    : "flex flex-col",
                )}
              >
                {shown.map((entry, index) => {
                  const common = {
                    ...shared,
                    entry,
                    index,
                    active: index === active,
                    selected: selection.has(entry.path),
                    favorite: props.favorites.has(entry.path),
                    renaming: props.renamingPath === entry.path,
                  }
                  return grid ? (
                    <EntryTile key={entry.path} {...common} />
                  ) : (
                    <EntryRow key={entry.path} {...common} />
                  )
                })}
              </ul>
              {visibleCount < entries.length ? (
                <div ref={sentinelRef} className="flex items-center justify-center px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((current) => Math.min(entries.length, current + PAGE))}
                    className="rounded-xl border border-panel-border bg-control px-3 py-1.5 font-mono text-[11px] lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("cloudfm.loadMore")} · {entries.length - visibleCount}
                  </button>
                </div>
              ) : null}
              <p className="px-4 pb-3 font-mono text-[10px] lowercase text-text-faint" aria-live="polite">
                {t("cloudfm.showing")} {shown.length}/{entries.length} · {t("cloudfm.rowHint")} · {t("cloudfm.kbdMenu")}
              </p>
            </div>
          </FmMenuTrigger>
          {props.emptyAreaMenu}
        </FmMenu>
      )}
    </div>
  )
}

/** folders first for the "open" action: a directory navigates, a file previews */
export const isDirectory = (entry: Entry) => entry.kind === EntryKind.DIRECTORY
