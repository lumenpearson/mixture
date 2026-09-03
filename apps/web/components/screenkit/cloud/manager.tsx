"use client"

import { candidatesFromDrop, candidatesFromInput } from "@/lib/cloud/drop"
import { countByCategory, DEFAULT_FILTERS, filterEntries, type FilterOptions } from "@/lib/cloud/filtering"
import { baseName, joinPath, parentPath, uniqueName } from "@/lib/cloud/paths"
import { useCloudFavorites } from "@/lib/cloud/favorites"
import { useCloudSettings } from "@/lib/cloud/settings"
import { SORT_KEYS, sortEntries } from "@/lib/cloud/sorting"
import type { ConflictResolution } from "@/lib/cloud/upload-queue"
import { getCloudToken, rpcErrorMessage } from "@/lib/rpc/client"
import { cn } from "@/lib/utils"
import { EntryKind, Role, type Entry, type Status } from "@mixture/protocol/cloud"
import {
  ClipboardPaste,
  Copy,
  FolderPlus,
  Info,
  ListChecks,
  MoveRight,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { useScreenkit } from "../store"
import { DeleteDialog, MoveDialog, NewFolderDialog, PropertiesDialog } from "./dialogs"
import type { EntryActions } from "./entry-row"
import { Listing } from "./listing"
import { FmMenuChoice, FmMenuContent, FmMenuItem, FmMenuSeparator, FmMenuSub, FmMenuSubContent, FmMenuSubTrigger } from "./menu"
import { GITHUB_PROVIDER_ID, useProvider } from "./provider"
import { PreviewPanel } from "./preview-panel"
import { SourceSwitcher } from "./source-switcher"
import {
  Breadcrumbs,
  FilterMenu,
  SearchBox,
  SORT_LABEL_KEY,
  SortMenu,
  ToolbarActions,
  toolbarButtonCls,
  ViewControls,
} from "./toolbar"
import { UploadPanel } from "./upload-panel"
import { invalidateTreeCache, useDebounced, useTreeSearch } from "./use-tree-search"
import { useUploads } from "./use-uploads"

/* ------------------------------------------------------------------ *
 * the cloud file manager
 *
 * Owns the path, the search, the selection and every mutation; the listing,
 * the toolbar and the dialogs are dumb. All storage access goes through the
 * current CloudProvider, so pointing the manager at a second source later is
 * a matter of registering that provider, not of editing this file.
 *
 * `?path` and `?q` mirror the state in the url, which makes a folder or a
 * search shareable and survives a reload.
 * ------------------------------------------------------------------ */

const SEARCH_MIN_CHARS = 2

function readParam(name: string): string {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get(name) ?? ""
}

function writeParams(patch: Record<string, string>) {
  if (typeof window === "undefined") return
  const params = new URLSearchParams(window.location.search)
  for (const [name, value] of Object.entries(patch)) {
    if (value) params.set(name, value)
    else params.delete(name)
  }
  const search = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`)
}

export function CloudManager({
  onStatus,
  reloadToken,
}: {
  onStatus: (status: Status | null) => void
  reloadToken: number
}) {
  const { t } = useScreenkit()
  const [settings, updateSettings] = useCloudSettings()
  const favorites = useCloudFavorites()
  const [providerId, setProviderId] = React.useState(GITHUB_PROVIDER_ID)
  const provider = useProvider(providerId)

  const [path, setPath] = React.useState(readParam("path"))
  const [query, setQuery] = React.useState(readParam("q"))
  const [everywhere, setEverywhere] = React.useState(false)
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [status, setStatus] = React.useState<Status | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filters, setFilters] = React.useState<FilterOptions>(DEFAULT_FILTERS)
  const [selection, setSelection] = React.useState<ReadonlySet<string>>(() => new Set())
  const [renamingPath, setRenamingPath] = React.useState<string | null>(null)
  const [clipboard, setClipboard] = React.useState<{ mode: "cut" | "copy"; entries: Entry[] } | null>(null)
  const [preview, setPreview] = React.useState<Entry | null>(null)
  const [properties, setProperties] = React.useState<Entry | null>(null)
  const [newFolder, setNewFolder] = React.useState<{ open: boolean; parent: string }>({ open: false, parent: "" })
  const [moveState, setMoveState] = React.useState<{ initial: string; targets: Entry[] } | null>(null)
  const [deleteTargets, setDeleteTargets] = React.useState<Entry[]>([])
  const [hasToken, setHasToken] = React.useState(false)

  const fileInput = React.useRef<HTMLInputElement | null>(null)
  const folderInput = React.useRef<HTMLInputElement | null>(null)
  const uploadTarget = React.useRef("")

  const role = status?.role ?? Role.ANONYMOUS
  const canEdit = role === Role.EDITOR || role === Role.OWNER
  const canUploadDirectly = Boolean(hasToken && canEdit && status?.repo && status?.branch)

  React.useEffect(() => {
    // localStorage is only readable after mount; the cap explanation and the
    // direct-upload route both depend on whether the caller brought a token
    setHasToken(Boolean(getCloudToken()))
  }, [reloadToken])

  /* ------------------------------ loading ------------------------------ */

  const inFlight = React.useRef<AbortController | null>(null)

  const load = React.useCallback(
    async (target: string, silent = false) => {
      // clicking through folders faster than GitHub answers must not let an
      // older listing land on top of a newer one
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      if (!silent) setLoading(true)
      setError(null)
      try {
        const result = await provider.list(target, { signal: controller.signal })
        if (controller.signal.aborted) return
        setEntries(result.entries)
        if (result.status) {
          setStatus(result.status)
          onStatus(result.status)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setError(rpcErrorMessage(err))
        setEntries([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    },
    [provider, onStatus],
  )

  React.useEffect(() => {
    void load(path)
  }, [path, load, reloadToken])

  React.useEffect(() => {
    const controller = inFlight
    return () => controller.current?.abort()
  }, [])

  React.useEffect(() => {
    writeParams({ path, q: query })
  }, [path, query])

  const refresh = React.useCallback(() => {
    invalidateTreeCache(provider.id)
    void load(path, true)
  }, [load, path, provider.id])

  /* ------------------------------ uploads ------------------------------ */

  const uploads = useUploads(
    {
      provider,
      repo: status?.repo ?? "",
      branch: status?.branch ?? "",
      token: hasToken ? getCloudToken() : "",
      canUploadDirectly,
    },
    refresh,
  )

  const enqueue = React.useCallback(
    (candidates: ReturnType<typeof candidatesFromInput>, base: string) => {
      if (!candidates.length) return
      const rejected = uploads.enqueue(
        candidates,
        base,
        entries.map((entry) => ({ path: entry.path, sha: entry.sha })),
      )
      for (const item of rejected) toast.error(`${item.name}: ${t("cloudfm.upload.rejected")}`)
    },
    [uploads, entries, t],
  )

  const onDropFiles = React.useCallback(
    (transfer: DataTransfer) => {
      void candidatesFromDrop(transfer).then((candidates) => enqueue(candidates, path))
    },
    [enqueue, path],
  )

  const pickFiles = React.useCallback((target: string) => {
    uploadTarget.current = target
    fileInput.current?.click()
  }, [])

  /* ------------------------------ search ------------------------------ */

  const debouncedQuery = useDebounced(query)
  const searchActive = everywhere && debouncedQuery.trim().length >= SEARCH_MIN_CHARS
  const tree = useTreeSearch(provider, searchActive)

  const source = searchActive ? tree.entries : entries
  const activeQuery = everywhere ? debouncedQuery : query

  const counts = React.useMemo(() => countByCategory(source), [source])
  const visible = React.useMemo(
    () =>
      sortEntries(filterEntries(source, { ...filters, query: activeQuery }), {
        key: settings.sortKey,
        direction: settings.sortDirection,
        foldersFirst: settings.foldersFirst,
      }),
    [source, filters, activeQuery, settings.sortKey, settings.sortDirection, settings.foldersFirst],
  )

  const byPath = React.useMemo(() => new Map(visible.map((entry) => [entry.path, entry])), [visible])
  const selected = React.useMemo(
    () => [...selection].map((p) => byPath.get(p)).filter((entry): entry is Entry => Boolean(entry)),
    [selection, byPath],
  )

  const applySelection = React.useCallback((paths: string[]) => setSelection(new Set(paths)), [])

  /* ------------------------------ mutations ------------------------------ */

  const run = React.useCallback(
    async (action: () => Promise<void>, success?: string) => {
      setBusy(true)
      try {
        await action()
        if (success) toast.success(success)
        invalidateTreeCache(provider.id)
        await load(path, true)
      } catch (err) {
        toast.error(rpcErrorMessage(err))
      } finally {
        setBusy(false)
      }
    },
    [load, path, provider.id],
  )

  const openEntry = React.useCallback((entry: Entry) => {
    if (entry.kind === EntryKind.DIRECTORY) {
      setPath(entry.path)
      setSelection(new Set())
      setPreview(null)
      return
    }
    setPreview(entry)
  }, [])

  const download = React.useCallback(
    async (entry: Entry) => {
      try {
        const result = await provider.read(entry.path)
        if (result.truncated) {
          const url = (await provider.streamUrl?.(entry)) ?? entry.downloadUrl
          if (url) window.open(url, "_blank", "noopener")
          else toast.error(t("cloud.largeFile"))
          return
        }
        const url = URL.createObjectURL(new Blob([result.content as BlobPart], { type: entry.contentType }))
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = entry.name
        anchor.click()
        // the anchor is gone the moment the click is handled; the url outlives
        // it just long enough for the browser to start writing the file
        window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
      } catch (err) {
        toast.error(rpcErrorMessage(err))
      }
    },
    [provider, t],
  )

  const copyText = React.useCallback(
    (value: string, message: string) => {
      void navigator.clipboard?.writeText(value)
      toast.success(message)
    },
    [],
  )

  const linkFor = React.useCallback((entry: Entry) => {
    if (entry.downloadUrl) return entry.downloadUrl
    const target = entry.kind === EntryKind.DIRECTORY ? entry.path : parentPath(entry.path)
    const params = new URLSearchParams({ view: "cloud" })
    if (target) params.set("path", target)
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`
  }, [])

  const renameSubmit = React.useCallback(
    (entry: Entry, raw: string) => {
      const name = raw.trim()
      setRenamingPath(null)
      if (!name || name === entry.name) return
      const siblings = entries.filter((item) => item.path !== entry.path).map((item) => item.name)
      if (siblings.some((sibling) => sibling.toLowerCase() === name.toLowerCase())) {
        toast.error(t("cloudfm.rename.exists"))
        return
      }
      const to = joinPath(parentPath(entry.path), name)
      void run(async () => {
        await provider.move(entry.path, to)
        favorites.rename(entry.path, to)
      }, t("cloudfm.rename.done"))
    },
    [entries, favorites, provider, run, t],
  )

  const duplicate = React.useCallback(
    (entry: Entry) => {
      void run(async () => {
        const result = await provider.read(entry.path)
        if (result.truncated) throw new Error(t("cloud.largeFile"))
        const name = uniqueName(entry.name, entries.map((item) => item.name))
        await provider.write(joinPath(parentPath(entry.path), name), result.content)
      }, t("cloudfm.duplicate.done"))
    },
    [entries, provider, run, t],
  )

  const removeMany = React.useCallback(
    (targets: readonly Entry[]) => {
      void run(async () => {
        for (const entry of targets) {
          await provider.remove(entry.path, entry.sha)
          favorites.forget(entry.path)
          if (preview?.path === entry.path) setPreview(null)
        }
        setSelection(new Set())
      }, t("cloud.deleted"))
    },
    [favorites, preview, provider, run, t],
  )

  const moveMany = React.useCallback(
    (targets: readonly Entry[], destination: string) => {
      void run(async () => {
        for (const entry of targets) {
          const to = targets.length === 1 ? destination : joinPath(destination, entry.name)
          await provider.move(entry.path, to)
          favorites.rename(entry.path, to)
        }
        setSelection(new Set())
      }, t("cloud.moved"))
    },
    [favorites, provider, run, t],
  )

  const paste = React.useCallback(() => {
    if (!clipboard?.entries.length) return
    const board = clipboard
    void run(async () => {
      for (const entry of board.entries) {
        const target = joinPath(path, uniqueName(entry.name, entries.map((item) => item.name)))
        if (board.mode === "cut") {
          await provider.move(entry.path, target)
          favorites.rename(entry.path, target)
        } else {
          const result = await provider.read(entry.path)
          if (result.truncated) throw new Error(t("cloud.largeFile"))
          await provider.write(target, result.content)
        }
      }
      setClipboard(null)
    })
  }, [clipboard, entries, favorites, path, provider, run, t])

  /* ------------------------------ actions ------------------------------ */

  const actions = React.useMemo<EntryActions>(
    () => ({
      open: openEntry,
      download: (entry) => void download(entry),
      copyLink: (entry) => copyText(linkFor(entry), t("common.copied")),
      copyPath: (entry) => copyText(entry.path, t("common.copied")),
      startRename: (entry) => setRenamingPath(entry.path),
      move: (entry) => setMoveState({ initial: entry.path, targets: [entry] }),
      duplicate,
      toggleFavorite: (entry) => favorites.toggle(entry.path),
      properties: (entry) => setProperties(entry),
      remove: (entry) => setDeleteTargets([entry]),
      newFolderIn: (entry) => setNewFolder({ open: true, parent: entry.path }),
      uploadInto: (entry) => pickFiles(entry.path),
      cut: (list) => setClipboard({ mode: "cut", entries: [...list] }),
      copy: (list) => setClipboard({ mode: "copy", entries: [...list] }),
    }),
    [copyText, download, duplicate, favorites, linkFor, openEntry, pickFiles, t],
  )

  const deleteSelection = React.useCallback(() => {
    const targets = selected.filter((entry) => entry.editable)
    if (targets.length) setDeleteTargets(targets)
  }, [selected])

  /* ------------------------------ menus ------------------------------ */

  const emptyAreaMenu = (
    <FmMenuContent aria-label={t("cloudfm.menu.label")}>
      <FmMenuItem disabled={!canEdit} onSelect={() => pickFiles(path)}>
        <Upload />
        {t("cloudfm.upload.here")}
      </FmMenuItem>
      <FmMenuItem disabled={!canEdit} onSelect={() => setNewFolder({ open: true, parent: path })}>
        <FolderPlus />
        {t("cloud.newFolder")}
      </FmMenuItem>
      <FmMenuItem disabled={!canEdit || !clipboard?.entries.length} onSelect={paste}>
        <ClipboardPaste />
        {t("cloudfm.menu.paste")}
      </FmMenuItem>

      <FmMenuSeparator />

      <FmMenuItem onSelect={() => applySelection(visible.map((entry) => entry.path))}>
        <ListChecks />
        {t("cloudfm.menu.selectAll")}
      </FmMenuItem>
      <FmMenuItem onSelect={refresh}>
        <RefreshCw />
        {t("cloud.refresh")}
      </FmMenuItem>

      <FmMenuSeparator />

      <FmMenuSub>
        <FmMenuSubTrigger>{t("cloudfm.menu.sort")}</FmMenuSubTrigger>
        <FmMenuSubContent>
          {SORT_KEYS.map((key) => (
            <FmMenuChoice
              key={key}
              checked={settings.sortKey === key}
              onSelect={() => updateSettings({ sortKey: key })}
            >
              {t(SORT_LABEL_KEY[key])}
            </FmMenuChoice>
          ))}
          <FmMenuSeparator />
          <FmMenuChoice
            checked={settings.sortDirection === "asc"}
            onSelect={() => updateSettings({ sortDirection: "asc" })}
          >
            {t("cloudfm.sort.asc")}
          </FmMenuChoice>
          <FmMenuChoice
            checked={settings.sortDirection === "desc"}
            onSelect={() => updateSettings({ sortDirection: "desc" })}
          >
            {t("cloudfm.sort.desc")}
          </FmMenuChoice>
          <FmMenuSeparator />
          <FmMenuChoice
            checked={settings.foldersFirst}
            onSelect={() => updateSettings({ foldersFirst: !settings.foldersFirst })}
          >
            {t("cloudfm.sort.foldersFirst")}
          </FmMenuChoice>
        </FmMenuSubContent>
      </FmMenuSub>
      <FmMenuSub>
        <FmMenuSubTrigger>{t("cloudfm.menu.view")}</FmMenuSubTrigger>
        <FmMenuSubContent>
          <FmMenuChoice checked={settings.view === "list"} onSelect={() => updateSettings({ view: "list" })}>
            {t("cloudfm.view.list")}
          </FmMenuChoice>
          <FmMenuChoice checked={settings.view === "grid"} onSelect={() => updateSettings({ view: "grid" })}>
            {t("cloudfm.view.grid")}
          </FmMenuChoice>
          <FmMenuSeparator />
          <FmMenuChoice
            checked={settings.density === "comfortable"}
            onSelect={() => updateSettings({ density: "comfortable" })}
          >
            {t("cloudfm.density.comfortable")}
          </FmMenuChoice>
          <FmMenuChoice
            checked={settings.density === "compact"}
            onSelect={() => updateSettings({ density: "compact" })}
          >
            {t("cloudfm.density.compact")}
          </FmMenuChoice>
        </FmMenuSubContent>
      </FmMenuSub>

      <FmMenuSeparator />

      <FmMenuItem onSelect={() => setProperties(folderEntry(path, entries.length))}>
        <Info />
        {t("cloudfm.menu.folderProperties")}
      </FmMenuItem>
    </FmMenuContent>
  )

  /* ------------------------------ render ------------------------------ */

  const emptyLabel = searchActive || activeQuery.trim() || filters.categories.length || filters.visibility !== "all"
    ? t("cloudfm.search.empty")
    : status?.configured
      ? t("cloud.empty")
      : t("cloud.notConfigured")

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SourceSwitcher value={providerId} onChange={setProviderId} />

      <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-panel-border bg-panel-soft p-3">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Breadcrumbs
            path={path}
            onNavigate={(next) => {
              setPath(next)
              setSelection(new Set())
            }}
          />
          <ToolbarActions
            canEdit={canEdit}
            busy={busy}
            loading={loading}
            onUploadFiles={() => pickFiles(path)}
            onUploadFolder={() => {
              uploadTarget.current = path
              folderInput.current?.click()
            }}
            onNewFolder={() => setNewFolder({ open: true, parent: path })}
            onRefresh={refresh}
            readOnlyHint={t("cloud.readOnly")}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox
            query={query}
            onQueryChange={setQuery}
            everywhere={everywhere}
            onScopeChange={setEverywhere}
            searching={tree.loading}
          />
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SortMenu settings={settings} onChange={updateSettings} />
            <FilterMenu filters={filters} counts={counts} onChange={(patch) => setFilters((c) => ({ ...c, ...patch }))} />
            <ViewControls settings={settings} onChange={updateSettings} />
          </div>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) enqueue(candidatesFromInput(event.target.files), uploadTarget.current)
          event.target.value = ""
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        // webkitdirectory is the only way a browser hands over a whole folder
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(event) => {
          if (event.target.files) enqueue(candidatesFromInput(event.target.files), uploadTarget.current)
          event.target.value = ""
        }}
      />

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-panel-border bg-control px-4 py-3 font-mono text-[12px] lowercase text-accent-red"
        >
          {error}
        </div>
      ) : null}

      {searchActive && tree.truncated ? (
        <p className="font-mono text-[11px] lowercase text-accent-orange">{t("cloudfm.search.truncated")}</p>
      ) : null}

      <UploadPanel
        items={uploads.items}
        canUploadDirectly={canUploadDirectly}
        onResolve={(id: string, resolution: ConflictResolution) => uploads.resolve(id, resolution)}
        onResolveAll={uploads.resolveAll}
        onRetry={uploads.retry}
        onCancel={uploads.cancel}
        onClear={uploads.clear}
      />

      {selection.size > 1 ? (
        <SelectionBar
          count={selection.size}
          canEdit={canEdit}
          onClear={() => setSelection(new Set())}
          onCopy={() => actions.copy(selected)}
          onCut={() => actions.cut(selected)}
          onMove={() => setMoveState({ initial: path, targets: selected })}
          onDelete={deleteSelection}
        />
      ) : null}

      <Listing
        key={`${provider.id}:${path}:${searchActive ? "search" : "folder"}`}
        entries={visible}
        loading={loading || tree.loading}
        canEdit={canEdit}
        settings={settings}
        actions={actions}
        provider={provider}
        favorites={favorites.set}
        selection={selection}
        setSelection={applySelection}
        renamingPath={renamingPath}
        onRenameSubmit={renameSubmit}
        onRenameCancel={() => setRenamingPath(null)}
        onDeleteSelection={deleteSelection}
        onDropFiles={onDropFiles}
        emptyAreaMenu={emptyAreaMenu}
        emptyLabel={emptyLabel}
      />

      {preview ? <PreviewPanel entry={preview} provider={provider} onClose={() => setPreview(null)} /> : null}

      <NewFolderDialog
        open={newFolder.open}
        parent={newFolder.parent}
        busy={busy}
        onOpenChange={(open) => setNewFolder((current) => ({ ...current, open }))}
        onSubmit={(name) => {
          setNewFolder((current) => ({ ...current, open: false }))
          void run(async () => {
            await provider.mkdir(joinPath(newFolder.parent, name))
          }, t("cloud.folderCreated"))
        }}
      />

      <MoveDialog
        open={moveState !== null}
        initial={moveState?.initial ?? ""}
        count={moveState?.targets.length ?? 0}
        busy={busy}
        onOpenChange={(open) => !open && setMoveState(null)}
        onSubmit={(target) => {
          const targets = moveState?.targets ?? []
          setMoveState(null)
          moveMany(targets, target)
        }}
      />

      <DeleteDialog
        open={deleteTargets.length > 0}
        targets={deleteTargets}
        onOpenChange={(open) => !open && setDeleteTargets([])}
        onConfirm={() => {
          const targets = deleteTargets
          setDeleteTargets([])
          removeMany(targets)
        }}
      />

      <PropertiesDialog entry={properties} onOpenChange={(open) => !open && setProperties(null)} />
    </div>
  )
}

/** a stand-in Entry for the folder the manager is currently showing */
function folderEntry(path: string, count: number): Entry {
  return {
    $typeName: "mixture.cloud.v1.Entry",
    path,
    name: baseName(path) || "/",
    kind: EntryKind.DIRECTORY,
    size: BigInt(count),
    sha: "",
    visibility: 0,
    editable: false,
    contentType: "inode/directory",
    downloadUrl: "",
  }
}

function SelectionBar({
  count,
  canEdit,
  onClear,
  onCopy,
  onCut,
  onMove,
  onDelete,
}: {
  count: number
  canEdit: boolean
  onClear: () => void
  onCopy: () => void
  onCut: () => void
  onMove: () => void
  onDelete: () => void
}) {
  const { t } = useScreenkit()
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-panel-border bg-control px-3 py-2">
      <span className="font-mono text-[12px] lowercase text-text-secondary">
        {t("cloudfm.select.selected")} · <span className="tabular-nums text-foreground">{count}</span>
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" className={toolbarButtonCls} onClick={onCopy}>
          <Copy className="size-3.5" aria-hidden="true" /> {t("cloudfm.menu.copy")}
        </button>
        <button type="button" className={toolbarButtonCls} disabled={!canEdit} onClick={onCut}>
          <MoveRight className="size-3.5" aria-hidden="true" /> {t("cloudfm.menu.cut")}
        </button>
        <button type="button" className={toolbarButtonCls} disabled={!canEdit} onClick={onMove}>
          <MoveRight className="size-3.5" aria-hidden="true" /> {t("cloudfm.select.move")}
        </button>
        <button
          type="button"
          className={cn(toolbarButtonCls, "text-accent-red")}
          disabled={!canEdit}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" aria-hidden="true" /> {t("cloudfm.select.delete")}
        </button>
        <button type="button" className={toolbarButtonCls} onClick={onClear} aria-label={t("cloudfm.select.clear")}>
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
