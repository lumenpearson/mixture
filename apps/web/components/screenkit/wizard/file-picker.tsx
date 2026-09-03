"use client"

import { Input } from "@/components/ui/input"
import { accentForKind, formatBytes, mediaKindOf, type MediaKind } from "@/lib/media/kinds"
import { cn } from "@/lib/utils"
import { EntryKind, type Entry } from "@mixture/protocol/cloud"
import { ChevronRight, Folder, FolderUp, Loader2, Search } from "lucide-react"
import * as React from "react"
import { KIND_ICONS } from "../media/file-preview"
import { useCloudTree } from "../media/use-cloud-tree"
import { useScreenkit } from "../store"

const FILTERS: (MediaKind | "all")[] = ["all", "image", "video", "audio", "pdf", "text"]

const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "")

/** browse the cloud drive and pick one file */
export function FilePicker({ value, onPick }: { value?: string; onPick: (entry: Entry) => void }) {
  const { t, setSection } = useScreenkit()
  const { entries, state } = useCloudTree(true)
  const [folder, setFolder] = React.useState(() => (value ? parentOf(value) : ""))
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<MediaKind | "all">("all")

  const rows = React.useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    const list = entries.filter((entry) => {
      if (q) return entry.kind === EntryKind.FILE && entry.path.toLowerCase().includes(q)
      return parentOf(entry.path) === folder
    })
    const filtered = list.filter((entry) => {
      if (entry.kind !== EntryKind.FILE) return !q
      if (filter === "all") return true
      const kind = mediaKindOf(entry.name, entry.contentType)
      return filter === "text" ? kind === "text" || kind === "code" || kind === "markdown" : kind === filter
    })
    return filtered.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === EntryKind.DIRECTORY ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [entries, folder, query, filter])

  if (state === "unavailable") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-panel-border p-5">
        <p className="font-mono text-[12px] leading-relaxed text-text-muted">{t("wizard.file.unavailable")}</p>
        <button
          type="button"
          onClick={() => setSection("cloud")}
          className="rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover"
        >
          {t("wizard.file.openCloud")}
        </button>
      </div>
    )
  }

  const crumbs = folder ? folder.split("/") : []

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("wizard.file.search")}
          aria-label={t("wizard.file.search")}
          type="search"
          /* Enter in a search field means "search", not "next step" */
          data-wizard-no-enter=""
          className="h-10 rounded-xl border-panel-border bg-control pl-9 font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => {
          const active = filter === item
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] lowercase transition-colors",
                active
                  ? "border-transparent bg-control-active text-control-active-foreground"
                  : "border-panel-border bg-panel-soft text-text-secondary hover:bg-panel-hover hover:text-foreground",
              )}
            >
              {item === "all" ? t("wizard.file.all") : item}
            </button>
          )
        })}
      </div>

      {!query ? (
        <nav className="flex flex-wrap items-center gap-1 font-mono text-[11px] lowercase text-text-faint" aria-label="folder">
          <button type="button" onClick={() => setFolder("")} className="rounded-md px-1.5 py-0.5 hover:bg-panel-hover hover:text-foreground">
            {t("wizard.file.root")}
          </button>
          {crumbs.map((segment, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="size-3" />
              <button
                type="button"
                onClick={() => setFolder(crumbs.slice(0, index + 1).join("/"))}
                className="rounded-md px-1.5 py-0.5 hover:bg-panel-hover hover:text-foreground"
              >
                {segment}
              </button>
            </React.Fragment>
          ))}
        </nav>
      ) : null}

      <ul className="sk-scroll flex max-h-72 flex-col gap-1 overflow-y-auto rounded-2xl border border-panel-border bg-control p-1.5">
        {state === "loading" && !entries ? (
          <li className="flex items-center gap-2 px-3 py-4 font-mono text-[12px] text-text-muted">
            <Loader2 className="size-4 animate-spin" /> {t("player.preview.loading")}
          </li>
        ) : null}
        {!query && folder ? (
          <li>
            <Row icon={FolderUp} accent="var(--accent-grey)" label={t("wizard.file.up")} onClick={() => setFolder(parentOf(folder))} />
          </li>
        ) : null}
        {rows.map((entry) => {
          const isDir = entry.kind === EntryKind.DIRECTORY
          const kind = isDir ? "folder" : mediaKindOf(entry.name, entry.contentType)
          const selected = !isDir && entry.path === value
          return (
            <li key={entry.path}>
              <Row
                icon={isDir ? Folder : KIND_ICONS[kind]}
                accent={accentForKind(kind)}
                label={query ? entry.path : entry.name}
                meta={isDir ? undefined : formatBytes(Number(entry.size))}
                selected={selected}
                onClick={() => (isDir ? setFolder(entry.path) : onPick(entry))}
              />
            </li>
          )
        })}
        {entries && rows.length === 0 && state !== "loading" ? (
          <li className="px-3 py-4 text-center font-mono text-[12px] text-text-muted">{t("wizard.file.empty")}</li>
        ) : null}
      </ul>
    </div>
  )
}

function Row({
  icon: Icon,
  accent,
  label,
  meta,
  selected,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  accent: string
  label: string
  meta?: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
        selected ? "bg-control-active text-control-active-foreground" : "hover:bg-panel-hover",
      )}
    >
      <span
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", selected ? "border-transparent" : "border-panel-border bg-panel-soft")}
        style={selected ? undefined : { color: accent }}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] lowercase">{label}</span>
      {meta ? <span className={cn("shrink-0 font-mono text-[10px]", selected ? "opacity-70" : "text-text-faint")}>{meta}</span> : null}
    </button>
  )
}
