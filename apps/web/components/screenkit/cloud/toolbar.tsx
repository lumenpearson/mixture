"use client"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { CATEGORY_LABEL_KEY, FILE_CATEGORIES, type FileCategory } from "@/lib/cloud/file-types"
import type { FilterOptions, VisibilityFilter } from "@/lib/cloud/filtering"
import type { CloudSettings } from "@/lib/cloud/settings"
import { SORT_KEYS, type SortKey } from "@/lib/cloud/sorting"
import { cn } from "@/lib/utils"
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronRight,
  CornerLeftUp,
  FolderPlus,
  FolderUp,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"

/* ------------------------------------------------------------------ *
 * breadcrumbs and the toolbar above the listing
 *
 * Everything here is stateless: the manager owns the path, the query and the
 * settings, and the toolbar only reports intent. That keeps the search field
 * cheap per keystroke and lets the url stay the single source of truth for
 * `?path` and `?q`.
 * ------------------------------------------------------------------ */

export const toolbarButtonCls =
  "inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

export const toolbarPrimaryCls =
  "inline-flex items-center gap-1.5 rounded-xl bg-control-active px-3 py-2 font-mono text-xs lowercase text-control-active-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"

const menuContentCls =
  "min-w-[13rem] rounded-2xl border border-panel-border bg-popover/95 p-1.5 font-mono text-xs lowercase text-popover-foreground shadow-xl backdrop-blur-md"

const menuItemCls =
  "cursor-default rounded-xl px-2.5 py-2 text-xs lowercase focus:bg-panel-hover focus:text-foreground"

export const SORT_LABEL_KEY: Record<SortKey, string> = {
  name: "cloudfm.sort.name",
  size: "cloudfm.sort.size",
  type: "cloudfm.sort.type",
  kind: "cloudfm.sort.kind",
}

const VISIBILITY_FILTERS: { value: VisibilityFilter; key: string }[] = [
  { value: "all", key: "cloudfm.filter.any" },
  { value: "private", key: "cloud.visibility.private" },
  { value: "public", key: "cloud.visibility.public" },
  { value: "hidden", key: "cloud.visibility.hidden" },
]

/* ---------------------------- breadcrumbs ---------------------------- */

export function Breadcrumbs({ path, onNavigate }: { path: string; onNavigate: (next: string) => void }) {
  const { t } = useScreenkit()
  const crumbs = path ? path.split("/") : []
  return (
    <nav aria-label={t("cloudfm.props.path")} className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-[12px] lowercase">
      <button
        type="button"
        aria-label={t("cloudfm.back")}
        title={t("cloudfm.back")}
        disabled={!path}
        onClick={() => onNavigate(crumbs.slice(0, -1).join("/"))}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
      >
        <CornerLeftUp className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onNavigate("")}
        className={cn(
          "rounded-lg px-2 py-1 transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-ring",
          path ? "text-text-secondary" : "text-foreground",
        )}
      >
        {t("cloud.root")}
      </button>
      {crumbs.map((crumb, index) => {
        const target = crumbs.slice(0, index + 1).join("/")
        const last = index === crumbs.length - 1
        return (
          <React.Fragment key={target}>
            <ChevronRight className="size-3 shrink-0 text-text-faint" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onNavigate(target)}
              aria-current={last ? "page" : undefined}
              className={cn(
                "max-w-[12rem] truncate rounded-lg px-2 py-1 transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-ring",
                last ? "text-foreground" : "text-text-secondary",
              )}
              translate="no"
            >
              {crumb}
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}

/* ------------------------------ search ------------------------------ */

export function SearchBox({
  query,
  onQueryChange,
  everywhere,
  onScopeChange,
  searching,
}: {
  query: string
  onQueryChange: (value: string) => void
  everywhere: boolean
  onScopeChange: (value: boolean) => void
  searching: boolean
}) {
  const { t } = useScreenkit()
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-faint"
          aria-hidden="true"
        />
        <Input
          type="search"
          name="cloud-search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          aria-label={everywhere ? t("cloudfm.search.placeholderAll") : t("cloudfm.search.placeholder")}
          placeholder={everywhere ? t("cloudfm.search.placeholderAll") : t("cloudfm.search.placeholder")}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-10 rounded-xl border-panel-border bg-control pl-9 pr-9 font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"
        />
        {query ? (
          <button
            type="button"
            aria-label={t("cloudfm.search.clear")}
            title={t("cloudfm.search.clear")}
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-text-faint transition-colors hover:bg-panel-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {/* toggle buttons, not tabs: the scope changes what the search covers,
          it does not switch between two panels */}
      <div
        role="group"
        aria-label={t("cloudfm.search.scopeFolder")}
        className="flex shrink-0 gap-1 rounded-xl border border-panel-border bg-control p-1"
      >
        {[false, true].map((scope) => (
          <button
            key={String(scope)}
            type="button"
            aria-pressed={everywhere === scope}
            onClick={() => onScopeChange(scope)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 font-mono text-[11px] lowercase transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              everywhere === scope
                ? "bg-control-active text-control-active-foreground"
                : "text-text-secondary hover:bg-panel-hover hover:text-foreground",
            )}
          >
            {scope ? t("cloudfm.search.scopeAll") : t("cloudfm.search.scopeFolder")}
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {searching ? t("cloudfm.search.searching") : ""}
      </span>
    </div>
  )
}

/* ------------------------------- menus ------------------------------- */

export function SortMenu({
  settings,
  onChange,
}: {
  settings: CloudSettings
  onChange: (patch: Partial<CloudSettings>) => void
}) {
  const { t } = useScreenkit()
  const Icon = settings.sortDirection === "asc" ? ArrowDownAZ : ArrowUpAZ
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={toolbarButtonCls} aria-label={t("cloudfm.sort.label")}>
        <Icon className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{t(SORT_LABEL_KEY[settings.sortKey])}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuContentCls}>
        <DropdownMenuLabel className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-text-faint">
          {t("cloudfm.sort.label")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={settings.sortKey}
          onValueChange={(value) => onChange({ sortKey: value as SortKey })}
        >
          {SORT_KEYS.map((key) => (
            <DropdownMenuRadioItem key={key} value={key} className={menuItemCls}>
              {t(SORT_LABEL_KEY[key])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="-mx-0.5 my-1 bg-panel-border" />
        <DropdownMenuRadioGroup
          value={settings.sortDirection}
          onValueChange={(value) => onChange({ sortDirection: value === "desc" ? "desc" : "asc" })}
        >
          <DropdownMenuRadioItem value="asc" className={menuItemCls}>
            {t("cloudfm.sort.asc")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="desc" className={menuItemCls}>
            {t("cloudfm.sort.desc")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="-mx-0.5 my-1 bg-panel-border" />
        <DropdownMenuCheckboxItem
          checked={settings.foldersFirst}
          onCheckedChange={(checked) => onChange({ foldersFirst: Boolean(checked) })}
          className={menuItemCls}
        >
          {t("cloudfm.sort.foldersFirst")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function FilterMenu({
  filters,
  onChange,
  counts,
}: {
  filters: FilterOptions
  onChange: (patch: Partial<FilterOptions>) => void
  counts: Record<string, number>
}) {
  const { t } = useScreenkit()
  const activeCount = filters.categories.length + (filters.visibility === "all" ? 0 : 1)
  const toggle = (category: FileCategory) =>
    onChange({
      categories: filters.categories.includes(category)
        ? filters.categories.filter((value) => value !== category)
        : [...filters.categories, category],
    })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(toolbarButtonCls, activeCount > 0 && "border-ring text-foreground")}
        aria-label={t("cloudfm.filter.label")}
      >
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{t("cloudfm.filter.label")}</span>
        {activeCount > 0 ? (
          <span className="rounded-full bg-panel-hover px-1.5 text-[10px] tabular-nums">{activeCount}</span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuContentCls}>
        <DropdownMenuLabel className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-text-faint">
          {t("cloudfm.filter.type")}
        </DropdownMenuLabel>
        {FILE_CATEGORIES.map((category) => (
          <DropdownMenuCheckboxItem
            key={category}
            checked={filters.categories.includes(category)}
            onCheckedChange={() => toggle(category)}
            onSelect={(event) => event.preventDefault()}
            className={menuItemCls}
          >
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="truncate">{t(CATEGORY_LABEL_KEY[category])}</span>
              <span className="tabular-nums text-text-faint">{counts[category] ?? 0}</span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator className="-mx-0.5 my-1 bg-panel-border" />
        <DropdownMenuLabel className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-text-faint">
          {t("cloudfm.filter.visibility")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.visibility}
          onValueChange={(value) => onChange({ visibility: value as VisibilityFilter })}
        >
          {VISIBILITY_FILTERS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className={menuItemCls}>
              {t(option.key)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {activeCount > 0 ? (
          <>
            <DropdownMenuSeparator className="-mx-0.5 my-1 bg-panel-border" />
            <button
              type="button"
              onClick={() => onChange({ categories: [], visibility: "all" })}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" /> {t("cloudfm.filter.clear")}
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ViewControls({
  settings,
  onChange,
}: {
  settings: CloudSettings
  onChange: (patch: Partial<CloudSettings>) => void
}) {
  const { t } = useScreenkit()
  return (
    <div role="group" aria-label={t("cloudfm.view.label")} className="flex shrink-0 gap-1 rounded-xl border border-panel-border bg-control p-1">
      {(["list", "grid"] as const).map((view) => {
        const Icon = view === "list" ? List : LayoutGrid
        const active = settings.view === view
        return (
          <button
            key={view}
            type="button"
            aria-label={t(`cloudfm.view.${view}`)}
            title={t(`cloudfm.view.${view}`)}
            aria-pressed={active}
            onClick={() => onChange({ view })}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-control-active text-control-active-foreground"
                : "text-text-secondary hover:bg-panel-hover hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ actions ------------------------------ */

export function ToolbarActions({
  canEdit,
  busy,
  loading,
  onUploadFiles,
  onUploadFolder,
  onNewFolder,
  onRefresh,
  readOnlyHint,
}: {
  canEdit: boolean
  busy: boolean
  loading: boolean
  onUploadFiles: () => void
  onUploadFolder: () => void
  onNewFolder: () => void
  onRefresh: () => void
  readOnlyHint: string
}) {
  const { t } = useScreenkit()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={toolbarPrimaryCls}
        disabled={!canEdit || busy}
        onClick={onUploadFiles}
        title={!canEdit ? readOnlyHint : undefined}
      >
        <Upload className="size-3.5" aria-hidden="true" /> {t("cloudfm.upload.files")}
      </button>
      <button type="button" className={toolbarButtonCls} disabled={!canEdit || busy} onClick={onUploadFolder}>
        <FolderUp className="size-3.5" aria-hidden="true" /> {t("cloudfm.upload.folder")}
      </button>
      <button type="button" className={toolbarButtonCls} disabled={!canEdit || busy} onClick={onNewFolder}>
        <FolderPlus className="size-3.5" aria-hidden="true" /> {t("cloud.newFolder")}
      </button>
      <button
        type="button"
        className={toolbarButtonCls}
        onClick={onRefresh}
        disabled={loading}
        aria-label={t("cloud.refresh")}
        title={t("cloud.refresh")}
      >
        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
      </button>
    </div>
  )
}
