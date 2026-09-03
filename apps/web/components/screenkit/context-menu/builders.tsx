"use client"

import { DEVICES, PLAYBACK_MODES } from "@/lib/screenkit/data"
import { buildPromptSheet, downloadText, exportPromptSheets } from "@/lib/screenkit/export"
import { deviceLabel, modeLabel } from "@/lib/screenkit/i18n"
import type { DeviceType, PlaybackMode, ResolvedInsert } from "@/lib/screenkit/types"
import {
  ArrowUpRight,
  Copy,
  Download,
  Eye,
  FileText,
  LayoutGrid,
  Link2,
  ListOrdered,
  Maximize2,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  Rows3,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import {
  LIBRARY_PAGE_SIZE_OPTIONS,
  librarySortOptions,
  libraryViewOptions,
  type LibraryPageSize,
  type LibrarySortKey,
  type LibraryViewMode,
} from "../library-list-settings"
import { useScreenkit } from "../store"
import { WIZARD_OPEN_EVENT } from "../wizard/insert-wizard"
import { groupEntries, type MenuEntry, type MenuModel } from "./model"

/* ------------------------------------------------------------------ *
 * menu builders: the actions the library, the preview stage and the
 * cards offer. each returns a function that builds a model on demand.
 * ------------------------------------------------------------------ */

function copy(text: string, done: string) {
  void navigator.clipboard?.writeText(text)
  toast.success(done)
}

export function useMenuLabels() {
  const { t } = useScreenkit()
  return React.useMemo(
    () => ({
      open: t("menu.group.open"),
      insert: t("menu.group.insert"),
      share: t("menu.group.share"),
      library: t("menu.group.library"),
      view: t("menu.group.view"),
      playback: t("menu.group.playback"),
      danger: t("menu.group.danger"),
    }),
    [t],
  )
}

export type InsertMenuOptions = {
  /** asks the caller to confirm and delete (custom inserts only) */
  onDelete?: () => void
  /** extra entries, e.g. playback controls on the preview stage */
  extra?: MenuEntry[]
  /** hide the "open in preview" entry when already there */
  inPreview?: boolean
}

export function useInsertMenuBuilder() {
  const { t, contentLocale, openInPreview, setSection, setSelectedId, isFavorite, toggleFavorite } = useScreenkit()
  const router = useRouter()
  const labels = useMenuLabels()

  return React.useCallback(
    (insert: ResolvedInsert, options: InsertMenuOptions = {}): MenuModel => {
      const link = () => {
        const url = new URL(window.location.href)
        url.search = `?view=preview&insert=${encodeURIComponent(insert.id)}`
        url.hash = ""
        return url.toString()
      }
      const entries: MenuEntry[] = [
        ...(options.inPreview
          ? []
          : [{ id: "open-preview", label: t("menu.open.preview"), icon: Eye, group: "open", run: () => openInPreview(insert.id) }]),
        {
          id: "open-fullscreen",
          label: t("menu.open.fullscreen"),
          icon: Maximize2,
          shortcut: "f",
          group: "open",
          run: () => router.push(`/insert/${encodeURIComponent(insert.id)}`),
        },
        {
          id: "open-prompts",
          label: t("menu.open.prompts"),
          icon: FileText,
          group: "open",
          run: () => {
            setSelectedId(insert.id)
            setSection("prompts")
          },
        },
        {
          id: "favorite",
          label: t("menu.insert.favorite"),
          icon: Star,
          shortcut: "s",
          checked: isFavorite(insert.id),
          group: "insert",
          run: () => toggleFavorite(insert.id),
        },
        ...(options.extra ?? []),
        { id: "copy-link", label: t("menu.copy.link"), icon: Link2, group: "share", run: () => copy(link(), t("common.linkCopied")) },
        {
          id: "copy-prompt",
          label: t("menu.copy.prompt"),
          icon: Copy,
          group: "share",
          run: () => copy(buildPromptSheet(insert, contentLocale), t("menu.copied")),
        },
        {
          id: "export-sheet",
          label: t("menu.export.sheet"),
          icon: Download,
          group: "share",
          run: () => downloadText(`${insert.id}.txt`, buildPromptSheet(insert, contentLocale)),
        },
        ...(insert.custom && options.onDelete
          ? [{ id: "delete", label: t("menu.insert.delete"), icon: Trash2, danger: true, group: "danger", run: options.onDelete }]
          : []),
      ]
      return { title: insert.title, groups: groupEntries(entries, labels) }
    },
    [contentLocale, isFavorite, labels, openInPreview, router, setSection, setSelectedId, t, toggleFavorite],
  )
}

export function useLibraryMenuBuilder() {
  const { t, contentLocale, libraryListSettings, setLibraryListSettings, setFilters, refreshLibrary, inserts, persistent } = useScreenkit()
  const labels = useMenuLabels()

  return React.useCallback((): MenuModel => {
    const entries: MenuEntry[] = [
      {
        id: "new",
        label: t("menu.library.new"),
        icon: Plus,
        group: "library",
        disabled: !persistent,
        run: () => window.dispatchEvent(new CustomEvent(WIZARD_OPEN_EVENT)),
      },
      { id: "refresh", label: t("menu.library.refresh"), icon: RefreshCw, group: "library", run: () => void refreshLibrary() },
      {
        id: "clear",
        label: t("menu.library.clearFilters"),
        icon: X,
        group: "library",
        run: () => setFilters({ search: "", category: "all", device: "all", status: "all", favoritesOnly: false }),
      },
      {
        id: "view",
        label: t("menu.library.view"),
        icon: LayoutGrid,
        group: "view",
        value: libraryListSettings.view,
        options: libraryViewOptions(contentLocale),
        onChange: (value) => setLibraryListSettings((current) => ({ ...current, view: value as LibraryViewMode })),
      },
      {
        id: "sort",
        label: t("menu.library.sort"),
        icon: SlidersHorizontal,
        group: "view",
        value: libraryListSettings.sort,
        options: librarySortOptions(contentLocale),
        onChange: (value) => setLibraryListSettings((current) => ({ ...current, sort: value as LibrarySortKey })),
      },
      {
        id: "page-size",
        label: t("menu.library.pageSize"),
        icon: Rows3,
        group: "view",
        value: String(libraryListSettings.pageSize),
        options: LIBRARY_PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) })),
        onChange: (value) => setLibraryListSettings((current) => ({ ...current, pageSize: Number(value) as LibraryPageSize })),
      },
      { id: "export-all", label: t("menu.library.exportAll"), icon: ListOrdered, group: "share", run: () => exportPromptSheets(inserts, contentLocale) },
    ]
    return { groups: groupEntries(entries, labels) }
  }, [contentLocale, inserts, labels, libraryListSettings, persistent, refreshLibrary, setFilters, setLibraryListSettings, t])
}

/** playback mode and device radios for the preview stage */
export function usePreviewExtras(): MenuEntry[] {
  const { t, contentLocale, preview, setPreview } = useScreenkit()
  return React.useMemo(
    () => [
      {
        id: "mode",
        label: t("menu.preview.mode"),
        icon: ArrowUpRight,
        group: "playback",
        value: preview.mode,
        options: PLAYBACK_MODES.map((mode) => ({ value: mode.id, label: modeLabel(mode.id, contentLocale) })),
        onChange: (value) => setPreview((current) => ({ ...current, mode: value as PlaybackMode })),
      },
      {
        id: "device",
        label: t("menu.preview.device"),
        icon: MonitorSmartphone,
        group: "playback",
        value: preview.device,
        options: DEVICES.map((device) => ({ value: device.id, label: deviceLabel(device.id, contentLocale) })),
        onChange: (value) => setPreview((current) => ({ ...current, device: value as DeviceType })),
      },
    ],
    [contentLocale, preview.device, preview.mode, setPreview, t],
  )
}
