"use client"

import { accentForCategory, categoryFor, FOLDER_ACCENT, FOLDER_ICON, iconForCategory } from "@/lib/cloud/file-types"
import { formatBytes } from "@/lib/cloud/paths"
import type { CloudSettings } from "@/lib/cloud/settings"
import { cn } from "@/lib/utils"
import { EntryKind, Visibility, type Entry } from "@mixture/protocol/cloud"
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderPlus,
  Globe,
  Info,
  Link2,
  Lock,
  MoveRight,
  Pencil,
  Scissors,
  Star,
  Trash2,
  Upload,
} from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"
import { FmMenu, FmMenuContent, FmMenuItem, FmMenuSeparator, FmMenuTrigger, isMenuKey, openMenuAt } from "./menu"
import type { CloudProvider } from "./provider"
import { useThumbnail } from "./thumbnail"

/* ------------------------------------------------------------------ *
 * one entry in the listing, as a row or as a tile
 *
 * Both are memoised and take primitives plus one frozen `actions` object, so
 * a folder of 2 000 entries re-renders only the rows whose own state moved
 * (selection, focus, rename) rather than the whole list.
 * ------------------------------------------------------------------ */

export type EntryActions = {
  open: (entry: Entry) => void
  download: (entry: Entry) => void
  copyLink: (entry: Entry) => void
  copyPath: (entry: Entry) => void
  startRename: (entry: Entry) => void
  move: (entry: Entry) => void
  duplicate: (entry: Entry) => void
  toggleFavorite: (entry: Entry) => void
  properties: (entry: Entry) => void
  remove: (entry: Entry) => void
  newFolderIn: (entry: Entry) => void
  uploadInto: (entry: Entry) => void
  cut: (entries: Entry[]) => void
  copy: (entries: Entry[]) => void
}

export const VISIBILITY_KEY: Record<Visibility, string> = {
  [Visibility.UNSPECIFIED]: "cloud.visibility.private",
  [Visibility.PRIVATE]: "cloud.visibility.private",
  [Visibility.PUBLIC]: "cloud.visibility.public",
  [Visibility.HIDDEN]: "cloud.visibility.hidden",
}

export function VisibilityIcon({ visibility }: { visibility: Visibility }) {
  if (visibility === Visibility.PUBLIC) return <Globe className="size-3" aria-hidden="true" />
  if (visibility === Visibility.HIDDEN) return <EyeOff className="size-3" aria-hidden="true" />
  return <Lock className="size-3" aria-hidden="true" />
}

/** icon and tint for an entry under the current colour settings */
export function lookOf(entry: Entry, settings: CloudSettings) {
  const isDir = entry.kind === EntryKind.DIRECTORY
  if (isDir) {
    return { Icon: FOLDER_ICON, accent: settings.colors ? FOLDER_ACCENT : undefined }
  }
  const category = categoryFor(entry.name, entry.contentType)
  return {
    Icon: iconForCategory(category),
    accent: settings.colors ? accentForCategory(category, settings.accents) : undefined,
  }
}

/**
 * Move focus to the row that just took the roving tabindex — but only when
 * the listbox already held focus. Opening the cloud tab must not yank focus
 * into the first row, and a rename input inside a row must keep it.
 */
function focusIfRoving(active: boolean, element: HTMLElement | null) {
  if (!active || !element || typeof document === "undefined") return
  const activeElement = document.activeElement
  if (activeElement === element) return
  const listbox = element.closest('[role="listbox"]')
  if (!listbox || !activeElement || !listbox.contains(activeElement)) return
  if (activeElement.tagName === "INPUT") return
  element.focus({ preventScroll: false })
}

type SharedProps = {
  entry: Entry
  index: number
  active: boolean
  selected: boolean
  favorite: boolean
  canEdit: boolean
  renaming: boolean
  settings: CloudSettings
  actions: EntryActions
  provider: CloudProvider
  onPointerSelect: (index: number, event: React.MouseEvent) => void
  onKeyDown: (index: number, event: React.KeyboardEvent<HTMLElement>) => void
  onRenameSubmit: (entry: Entry, name: string) => void
  onRenameCancel: () => void
}

/* ------------------------------- menu ------------------------------- */

function EntryMenuBody({
  entry,
  favorite,
  canEdit,
  actions,
}: {
  entry: Entry
  favorite: boolean
  canEdit: boolean
  actions: EntryActions
}) {
  const { t } = useScreenkit()
  const isDir = entry.kind === EntryKind.DIRECTORY
  const editable = canEdit && entry.editable
  return (
    <FmMenuContent aria-label={t("cloudfm.menu.label")}>
      {/* navigate */}
      <FmMenuItem onSelect={() => actions.open(entry)}>
        {isDir ? <FolderPlus /> : <Eye />}
        {isDir ? t("cloudfm.menu.open") : t("cloud.preview")}
      </FmMenuItem>
      {isDir ? null : (
        <FmMenuItem onSelect={() => actions.download(entry)}>
          <Download />
          {t("cloud.download")}
        </FmMenuItem>
      )}
      <FmMenuItem onSelect={() => actions.copyLink(entry)}>
        <Link2 />
        {t("cloudfm.menu.copyLink")}
      </FmMenuItem>
      <FmMenuItem onSelect={() => actions.copyPath(entry)}>
        <Copy />
        {t("cloudfm.menu.copyPath")}
      </FmMenuItem>

      <FmMenuSeparator />

      {/* edit */}
      {isDir ? (
        <>
          <FmMenuItem disabled={!editable} onSelect={() => actions.newFolderIn(entry)}>
            <FolderPlus />
            {t("cloudfm.menu.newFolderHere")}
          </FmMenuItem>
          <FmMenuItem disabled={!editable} onSelect={() => actions.uploadInto(entry)}>
            <Upload />
            {t("cloudfm.upload.here")}
          </FmMenuItem>
        </>
      ) : null}
      <FmMenuItem disabled={!editable} onSelect={() => actions.startRename(entry)}>
        <Pencil />
        {t("cloud.rename")}
      </FmMenuItem>
      <FmMenuItem disabled={!editable} onSelect={() => actions.move(entry)}>
        <MoveRight />
        {t("cloudfm.menu.moveTo")}
      </FmMenuItem>
      {isDir ? null : (
        <FmMenuItem disabled={!editable} onSelect={() => actions.duplicate(entry)}>
          <Copy />
          {t("cloudfm.menu.duplicate")}
        </FmMenuItem>
      )}
      <FmMenuItem disabled={!editable} onSelect={() => actions.cut([entry])}>
        <Scissors />
        {t("cloudfm.menu.cut")}
      </FmMenuItem>

      <FmMenuSeparator />

      {/* organise */}
      <FmMenuItem onSelect={() => actions.toggleFavorite(entry)}>
        <Star />
        {favorite ? t("cloudfm.menu.unfavorite") : t("cloudfm.menu.favorite")}
      </FmMenuItem>
      <FmMenuItem onSelect={() => actions.properties(entry)}>
        <Info />
        {isDir ? t("cloudfm.menu.folderProperties") : t("cloudfm.menu.properties")}
      </FmMenuItem>

      <FmMenuSeparator />

      {/* danger */}
      <FmMenuItem danger disabled={!editable} onSelect={() => actions.remove(entry)}>
        <Trash2 />
        {t("cloud.delete")}
      </FmMenuItem>
    </FmMenuContent>
  )
}

/* ------------------------------ rename ------------------------------ */

function RenameField({
  entry,
  onSubmit,
  onCancel,
}: {
  entry: Entry
  onSubmit: (entry: Entry, name: string) => void
  onCancel: () => void
}) {
  const { t } = useScreenkit()
  const ref = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    const input = ref.current
    if (!input) return
    input.focus()
    // select the stem so typing replaces the name but keeps the extension
    const dot = entry.name.lastIndexOf(".")
    input.setSelectionRange(0, dot > 0 ? dot : entry.name.length)
  }, [entry.name])
  return (
    <input
      ref={ref}
      defaultValue={entry.name}
      aria-label={t("cloud.rename")}
      title={t("cloudfm.rename.hint")}
      spellCheck={false}
      autoComplete="off"
      className="min-w-0 flex-1 rounded-lg border border-panel-border bg-control px-2 py-1 font-mono text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => onSubmit(entry, event.currentTarget.value)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Enter") onSubmit(entry, event.currentTarget.value)
        if (event.key === "Escape") onCancel()
      }}
    />
  )
}

/* -------------------------------- row -------------------------------- */

function RowInner(props: SharedProps) {
  const { entry, index, active, selected, favorite, canEdit, renaming, settings, actions } = props
  const { t } = useScreenkit()
  const ref = React.useRef<HTMLLIElement | null>(null)
  const isDir = entry.kind === EntryKind.DIRECTORY
  const { Icon, accent } = lookOf(entry, settings)
  const compact = settings.density === "compact"
  const editable = canEdit && entry.editable

  React.useEffect(() => {
    focusIfRoving(active, ref.current)
  }, [active])

  return (
    <FmMenu>
      <FmMenuTrigger asChild>
        <li
          ref={ref}
          role="option"
          aria-selected={selected}
          data-index={index}
          tabIndex={active ? 0 : -1}
          onClick={(event) => props.onPointerSelect(index, event)}
          onDoubleClick={() => actions.open(entry)}
          onKeyDown={(event) => {
            // only the row's own keys. A key pressed on one of the action
            // buttons inside it bubbles here, and the listing handler
            // preventDefaults enter and space — which would cancel the
            // button's activation and run the row action instead
            if (event.target !== event.currentTarget) return
            if (isMenuKey(event)) {
              event.preventDefault()
              openMenuAt(ref.current)
              return
            }
            props.onKeyDown(index, event)
          }}
          onContextMenu={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "group grid touch-manipulation [contain-intrinsic-size:auto_44px] [content-visibility:auto] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-panel-border/40 px-3 outline-hidden last:border-0 sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_auto] sm:px-4",
            compact ? "py-1" : "py-2",
            selected ? "bg-panel-hover" : "hover:bg-panel-hover/60",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-[10px] border border-panel-border",
                compact ? "size-7" : "size-9",
              )}
              style={accent ? { color: accent } : undefined}
            >
              <Icon className={compact ? "size-3.5" : "size-4"} aria-hidden="true" />
            </span>
            {renaming ? (
              <RenameField entry={entry} onSubmit={props.onRenameSubmit} onCancel={props.onRenameCancel} />
            ) : (
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate font-mono text-sm text-foreground" translate="no">
                    {entry.name}
                  </span>
                  {favorite ? (
                    <Star className="size-3 shrink-0 fill-current text-accent-orange" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="block truncate font-mono text-[10px] text-text-faint sm:hidden">
                  {isDir
                    ? t(VISIBILITY_KEY[entry.visibility])
                    : `${formatBytes(entry.size)} · ${t(VISIBILITY_KEY[entry.visibility])}`}
                </span>
              </span>
            )}
          </div>

          <span className="hidden items-center gap-1.5 font-mono text-[11px] lowercase text-text-secondary sm:inline-flex">
            <VisibilityIcon visibility={entry.visibility} /> {t(VISIBILITY_KEY[entry.visibility])}
          </span>
          <span className="hidden text-right font-mono text-[11px] tabular-nums text-text-faint sm:block">
            {isDir ? "—" : formatBytes(entry.size)}
          </span>

          <span className="flex items-center justify-end gap-0.5">
            {isDir ? null : (
              <RowButton
                label={t("cloud.download")}
                active={active}
                onClick={() => actions.download(entry)}
              >
                <Download className="size-3.5" aria-hidden="true" />
              </RowButton>
            )}
            {editable ? (
              <RowButton label={t("cloud.rename")} active={active} onClick={() => actions.startRename(entry)}>
                <Pencil className="size-3.5" aria-hidden="true" />
              </RowButton>
            ) : null}
            {editable ? (
              <RowButton label={t("cloud.delete")} active={active} danger onClick={() => actions.remove(entry)}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </RowButton>
            ) : null}
            <RowButton
              label={t("cloudfm.menu.properties")}
              active={active}
              onClick={() => actions.properties(entry)}
            >
              <Info className="size-3.5" aria-hidden="true" />
            </RowButton>
          </span>
        </li>
      </FmMenuTrigger>
      <EntryMenuBody entry={entry} favorite={favorite} canEdit={canEdit} actions={actions} />
    </FmMenu>
  )
}

function RowButton({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string
  active: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // only the row holding the roving tabindex adds its actions to the tab
      // order, so a 2 000-row folder stays one tab stop deep
      tabIndex={active ? 0 : -1}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-text-faint opacity-0 transition-colors focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-panel-hover sm:opacity-0",
        "max-sm:opacity-100",
        danger ? "hover:text-accent-red" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export const EntryRow = React.memo(RowInner)

/* ------------------------------- tile ------------------------------- */

function TileInner(props: SharedProps) {
  const { entry, index, active, selected, favorite, canEdit, renaming, settings, actions, provider } = props
  const { t } = useScreenkit()
  const ref = React.useRef<HTMLLIElement | null>(null)
  const isDir = entry.kind === EntryKind.DIRECTORY
  const { Icon, accent } = lookOf(entry, settings)
  const { ref: thumbRef, url } = useThumbnail(entry, provider, settings.thumbnails && !isDir)

  React.useEffect(() => {
    focusIfRoving(active, ref.current)
  }, [active])

  return (
    <FmMenu>
      <FmMenuTrigger asChild>
        <li
          ref={ref}
          role="option"
          aria-selected={selected}
          data-index={index}
          tabIndex={active ? 0 : -1}
          onClick={(event) => props.onPointerSelect(index, event)}
          onDoubleClick={() => actions.open(entry)}
          onKeyDown={(event) => {
            // only the row's own keys. A key pressed on one of the action
            // buttons inside it bubbles here, and the listing handler
            // preventDefaults enter and space — which would cancel the
            // button's activation and run the row action instead
            if (event.target !== event.currentTarget) return
            if (isMenuKey(event)) {
              event.preventDefault()
              openMenuAt(ref.current)
              return
            }
            props.onKeyDown(index, event)
          }}
          onContextMenu={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "flex touch-manipulation flex-col gap-2 rounded-2xl border p-2 outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            selected ? "border-ring bg-panel-hover" : "border-panel-border bg-control hover:bg-panel-hover/60",
          )}
        >
          <span
            ref={thumbRef}
            className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-panel-border bg-panel-soft"
            style={accent ? { color: accent } : undefined}
          >
            {url ? (
              <img
                src={url}
                alt=""
                loading="lazy"
                decoding="async"
                width={240}
                height={240}
                className="size-full object-cover"
              />
            ) : (
              <Icon className="size-7" aria-hidden="true" />
            )}
            {favorite ? (
              <Star className="absolute right-1.5 top-1.5 size-3 fill-current text-accent-orange" aria-hidden="true" />
            ) : null}
          </span>
          {renaming ? (
            <RenameField entry={entry} onSubmit={props.onRenameSubmit} onCancel={props.onRenameCancel} />
          ) : (
            <span className="min-w-0">
              <span className="block truncate font-mono text-[12px] text-foreground" translate="no">
                {entry.name}
              </span>
              <span className="flex min-w-0 items-center gap-1 font-mono text-[10px] text-text-faint">
                <VisibilityIcon visibility={entry.visibility} />
                <span className="truncate tabular-nums">{isDir ? t("cloud.root") : formatBytes(entry.size)}</span>
              </span>
            </span>
          )}
        </li>
      </FmMenuTrigger>
      <EntryMenuBody entry={entry} favorite={favorite} canEdit={canEdit} actions={actions} />
    </FmMenu>
  )
}

export const EntryTile = React.memo(TileInner)
