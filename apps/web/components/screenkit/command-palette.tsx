"use client"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { resolveInsert } from "@/lib/screenkit/data"
import { buildPromptSheet, downloadText, exportPromptSheets } from "@/lib/screenkit/export"
import { LANG_LABEL, UI_LOCALES } from "@/lib/screenkit/i18n"
import type { UiLocale } from "@/lib/screenkit/types"
import { cn } from "@/lib/utils"
import { EntryKind } from "@mixture/protocol/cloud"
import {
  Cloud,
  Copy,
  Download,
  Eye,
  FileIcon,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  Info,
  Languages,
  Library,
  Maximize2,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Upload,
  type LucideIcon,
  Plus,
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import {
  CLOUD_OPEN_EVENT,
  COMMAND_PALETTE_EVENT,
  focusLibrarySearch,
  requestCloudAction,
  type CloudAction,
} from "./hotkeys"
import { iconForDevice } from "./icons"
import { useCloudTree } from "./media/use-cloud-tree"
import { openInsertWizard } from "./wizard/button"
import { useMotion } from "./motion"
import { useScreenkit, type ContentWidth, type Section } from "./store"
import {
  GRADIENT_LEVELS,
  PALETTES,
  SCALE_LEVELS,
  usePalette,
  useThemeMode,
  useThemeTransition,
} from "./theme"
import { copyText } from "@/lib/clipboard"

/* ------------------------------------------------------------------ *
 * ctrl/cmd+k command palette
 *
 * One search box over everything a visitor can reach: sections, inserts,
 * files and folders of the cloud drive (through CloudService.GetTree),
 * settings (theme, palette, scale, motion, language, glass, layout) and
 * quick actions. Filtering is done here, not by cmdk, so async cloud results
 * and per-group limits stay predictable. Recent picks are remembered per
 * browser.
 * ------------------------------------------------------------------ */

const RECENT_KEY = "screenkit-palette-recent-v1"
const RECENT_LIMIT = 8
const GROUP_LIMIT = 8
const CLOUD_LIMIT = 10

/** window events the cloud section may listen to when the palette opens things */

type Group = "recent" | "sections" | "inserts" | "cloud" | "settings" | "actions"

type PaletteItem = {
  id: string
  group: Exclude<Group, "recent">
  label: string
  hint?: string
  keywords: string
  icon: LucideIcon
  accent?: string
  run: () => void
  /** items that never appear without a query (settings toggles) */
  queryOnly?: boolean
}

const SECTION_ICONS: Record<Section, LucideIcon> = {
  overview: Sparkles,
  library: Library,
  preview: Eye,
  timeline: GitBranch,
  prompts: FileText,
  style: Palette,
  cloud: Cloud,
  about: Info,
}

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

function pushRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((v) => v !== id)].slice(0, RECENT_LIMIT)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

/** 0 = no match; higher is better. substring beats subsequence, prefix beats both */
export function paletteScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const t = text.toLowerCase()
  const index = t.indexOf(q)
  if (index >= 0) return 200 - Math.min(index, 80) + (index === 0 ? 40 : 0)
  // every word of the query must be a subsequence of the text
  let total = 0
  for (const word of q.split(/\s+/)) {
    let from = 0
    let gaps = 0
    for (const ch of word) {
      const found = t.indexOf(ch, from)
      if (found < 0) return 0
      gaps += found - from
      from = found + 1
    }
    total += Math.max(1, 60 - gaps)
  }
  return total
}


export function CommandPalette() {
  const store = useScreenkit()
  const { t, locale, contentLocale, inserts, selectedId, favorites } = store
  const router = useRouter()
  const { theme, setTheme } = useThemeMode()
  const transition = useThemeTransition()
  const palette = usePalette()
  const motion = useMotion()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [recent, setRecent] = React.useState<string[]>([])
  const { entries: tree, state: treeState } = useCloudTree(open)

  React.useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string } | undefined>).detail
      setQuery(detail?.query ?? "")
      setRecent(readRecent())
      setOpen(true)
    }
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen)
    return () => window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen)
  }, [])

  const close = React.useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  const goCloud = React.useCallback(
    (path: string, openPath?: string) => {
      const params = new URLSearchParams(window.location.search)
      if (path) params.set("path", path)
      else params.delete("path")
      if (openPath) params.set("open", openPath)
      else params.delete("open")
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
      store.setSection("cloud")
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(CLOUD_OPEN_EVENT, { detail: { path, open: openPath ?? null } }))
      }, 0)
    },
    [store],
  )

  const cloudAction = React.useCallback(
    (action: CloudAction) => {
      store.setSection("cloud")
      // not a timed dispatch: the cloud tab mounts after its reveal delay, so
      // a fixed 50 ms landed before the manager existed and the command did
      // nothing from any other section. `requestCloudAction` parks the request
      // for the manager to drain on mount and still fires the event for a
      // manager that is already there.
      requestCloudAction(action)
    },
    [store],
  )

  const items = React.useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = []
    const sectionLabel = (id: Section) => (id === "timeline" ? t("nav.changelog") : t(`section.${id}`))

    for (const id of Object.keys(SECTION_ICONS) as Section[]) {
      list.push({
        id: `section:${id}`,
        group: "sections",
        label: sectionLabel(id),
        keywords: `${id} ${t("palette.keywords.sections")}`,
        icon: SECTION_ICONS[id],
        run: () => store.setSection(id),
      })
    }

    for (const raw of inserts) {
      const insert = resolveInsert(raw, contentLocale)
      list.push({
        id: `insert:${insert.id}`,
        group: "inserts",
        label: insert.title,
        hint: `${insert.episode} · ${insert.scene}${favorites.has(insert.id) ? " · ★" : ""}${insert.id === selectedId ? ` · ${t("palette.selected")}` : ""}`,
        keywords: `${insert.id} ${raw.title.ru} ${raw.title.en ?? ""} ${insert.episode} ${insert.scene} ${insert.category} ${insert.device}`,
        icon: iconForDevice(insert.device),
        accent: store.catDef(insert.category)?.accent,
        run: () => store.openInPreview(insert.id),
      })
    }

    for (const entry of tree ?? []) {
      const isDir = entry.kind === EntryKind.DIRECTORY
      const parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : ""
      list.push({
        id: `cloud:${entry.path}`,
        group: "cloud",
        label: entry.name,
        hint: `${isDir ? t("palette.cloud.folder") : t("palette.cloud.file")} · ${entry.path}`,
        keywords: `${entry.path} ${entry.contentType}`,
        icon: isDir ? Folder : FileIcon,
        accent: isDir ? "var(--accent-orange)" : undefined,
        run: () => (isDir ? goCloud(entry.path) : goCloud(parent, entry.path)),
      })
    }

    // settings
    const themeIcons: Record<string, LucideIcon> = { dark: Moon, light: Sun, system: Monitor }
    for (const mode of ["dark", "light", "system"] as const) {
      list.push({
        id: `theme:${mode}`,
        group: "settings",
        label: `${t("palette.settings.theme")}: ${t(`theme.${mode}`)}`,
        hint: theme === mode ? "✓" : undefined,
        keywords: `theme mode ${mode} ${t("palette.keywords.settings")}`,
        icon: themeIcons[mode],
        run: () => transition(() => setTheme(mode)),
        queryOnly: true,
      })
    }
    for (const p of PALETTES) {
      list.push({
        id: `palette:${p}`,
        group: "settings",
        label: `${t("palette.settings.palette")}: ${t(`palette.${p}`)}`,
        hint: palette.palette === p ? "✓" : undefined,
        keywords: `palette accent ${p} ${t("palette.keywords.settings")}`,
        icon: Palette,
        run: () => palette.setPalette(p),
        queryOnly: true,
      })
    }
    for (const s of SCALE_LEVELS) {
      list.push({
        id: `scale:${s}`,
        group: "settings",
        label: `${t("palette.settings.scale")}: ${t(`scale.${s}`)}`,
        hint: palette.scale === s ? "✓" : undefined,
        keywords: `scale zoom ${s} ${t("palette.keywords.settings")}`,
        icon: SlidersHorizontal,
        run: () => palette.setScale(s),
        queryOnly: true,
      })
    }
    for (const g of GRADIENT_LEVELS) {
      list.push({
        id: `gradients:${g}`,
        group: "settings",
        label: `${t("palette.settings.gradients")}: ${t(`theme.grad${g[0].toUpperCase()}${g.slice(1)}`)}`,
        hint: palette.gradients === g ? "✓" : undefined,
        keywords: `gradients ${g} ${t("palette.keywords.settings")}`,
        icon: Sparkles,
        run: () => palette.setGradients(g),
        queryOnly: true,
      })
    }
    for (const choice of ["auto", "full", "reduced"] as const) {
      const active = choice === "auto" ? motion.isAuto : !motion.isAuto && (choice === "reduced") === motion.reduceMotion
      list.push({
        id: `motion:${choice}`,
        group: "settings",
        label: `${t("palette.settings.motion")}: ${t(`motion.${choice}`)}`,
        hint: active ? "✓" : undefined,
        keywords: `motion animation ${choice} ${t("palette.keywords.settings")}`,
        icon: Sparkles,
        run: () => {
          if (choice === "auto") motion.resetToAuto()
          else motion.setReduceMotion(choice === "reduced")
        },
        queryOnly: true,
      })
    }
    for (const l of UI_LOCALES) {
      list.push({
        id: `locale:${l}`,
        group: "settings",
        label: `${t("palette.settings.language")}: ${LANG_LABEL[l as UiLocale]}`,
        hint: locale === l ? "✓" : undefined,
        keywords: `language locale ${l} ${t("palette.keywords.settings")}`,
        icon: Languages,
        run: () => store.setLocale(l),
        queryOnly: true,
      })
    }
    for (const on of [true, false]) {
      list.push({
        id: `glass:${on ? "on" : "off"}`,
        group: "settings",
        label: `${t("palette.settings.glass")}: ${on ? t("palette.settings.on") : t("palette.settings.off")}`,
        hint: palette.glow === on ? "✓" : undefined,
        keywords: `glass glow ${on ? "on" : "off"} ${t("palette.keywords.settings")}`,
        icon: Sparkles,
        run: () => palette.setGlow(on),
        queryOnly: true,
      })
    }
    for (const width of ["narrow", "default", "wide"] as ContentWidth[]) {
      list.push({
        id: `width:${width}`,
        group: "settings",
        label: `${t("palette.settings.width")}: ${t(`style.width${width[0].toUpperCase()}${width.slice(1)}`)}`,
        hint: store.contentWidth === width ? "✓" : undefined,
        keywords: `width layout ${width} ${t("palette.keywords.settings")}`,
        icon: SlidersHorizontal,
        run: () => store.setContentWidth(width),
        queryOnly: true,
      })
    }

    // actions
    const selected = inserts.find((i) => i.id === selectedId)
    const selectedResolved = selected ? resolveInsert(selected, store.insertLocaleFor(selected.id)) : null
    list.push({
      id: "action:appearance",
      group: "actions",
      label: t("palette.action.openAppearance"),
      keywords: "settings appearance style",
      icon: Palette,
      run: () => store.setSection("style"),
    })
    list.push({
      id: "action:cloud",
      group: "actions",
      label: t("palette.action.openCloud"),
      keywords: "cloud files drive",
      icon: Cloud,
      run: () => store.setSection("cloud"),
    })
    list.push({
      id: "action:search",
      group: "actions",
      label: t("palette.action.searchLibrary"),
      keywords: "search library find",
      icon: Search,
      run: () => {
        store.setSection("library")
        focusLibrarySearch()
      },
    })
    list.push({
      id: "action:refresh",
      group: "actions",
      label: t("palette.action.refresh"),
      keywords: "refresh reload library",
      icon: RefreshCw,
      run: () => void store.refreshLibrary(),
    })
    list.push({
      id: "action:upload",
      group: "actions",
      label: t("palette.action.uploadCloud"),
      keywords: "upload cloud files",
      icon: Upload,
      run: () => cloudAction("upload"),
    })
    list.push({
      id: "action:new-folder",
      group: "actions",
      label: t("palette.action.newFolder"),
      keywords: "folder cloud new mkdir",
      icon: FolderPlus,
      run: () => cloudAction("new-folder"),
    })
    if (selectedResolved) {
      const fav = favorites.has(selectedResolved.id)
      list.push({
        id: "action:copy-link",
        group: "actions",
        label: t("palette.action.copyLink"),
        hint: selectedResolved.title,
        keywords: "copy link share url",
        icon: Copy,
        run: () => {
          const url = new URL(window.location.href)
          url.search = `?view=preview&insert=${encodeURIComponent(selectedResolved.id)}`
          url.hash = ""
          void copyText(url.toString(), t("common.linkCopied"), t("menu.copyFailed"))
        },
      })
      list.push({
        id: "action:favorite",
        group: "actions",
        label: fav ? t("palette.action.unfavorite") : t("palette.action.favorite"),
        hint: selectedResolved.title,
        keywords: "favorite star",
        icon: Star,
        run: () => store.toggleFavorite(selectedResolved.id),
      })
      list.push({
        id: "action:fullscreen",
        group: "actions",
        label: t("palette.action.fullscreen"),
        hint: selectedResolved.title,
        keywords: "fullscreen screen-state open",
        icon: Maximize2,
        run: () => router.push(`/insert/${encodeURIComponent(selectedResolved.id)}`),
      })
      list.push({
        id: "action:export-sheet",
        group: "actions",
        label: t("palette.action.exportSheet"),
        hint: selectedResolved.title,
        keywords: "export prompt sheet download txt",
        icon: Download,
        run: () =>
          downloadText(
            `${selectedResolved.id}.prompts.txt`,
            buildPromptSheet(selectedResolved, store.insertLocaleFor(selectedResolved.id)),
            "text/plain",
          ),
      })
      list.push({
        id: "action:next",
        group: "actions",
        label: t("palette.action.nextInsert"),
        keywords: "next insert",
        icon: Eye,
        run: () => store.stepInsert(1),
      })
      list.push({
        id: "action:prev",
        group: "actions",
        label: t("palette.action.prevInsert"),
        keywords: "previous insert",
        icon: Eye,
        run: () => store.stepInsert(-1),
      })
    }
    list.push({
      id: "action:export-all",
      group: "actions",
      label: t("palette.action.exportAll"),
      keywords: "export all prompts json download",
      icon: Download,
      run: () => exportPromptSheets(inserts, contentLocale),
    })
    if (store.persistent) {
      list.push({
        id: "action:new-insert",
        group: "actions",
        label: t("palette.action.newInsert"),
        keywords: "new insert create add wizard новая вставка",
        icon: Plus,
        run: () => {
          store.setSection("library")
          window.setTimeout(openInsertWizard, 50)
        },
      })
    }
    return list
  }, [
    t, inserts, contentLocale, favorites, selectedId, tree, theme, setTheme, transition,
    palette, motion, locale, store, router, goCloud, cloudAction,
  ])

  const byId = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const groups = React.useMemo(() => {
    const q = query.trim()
    const scored = items
      .map((item) => ({ item, score: q ? paletteScore(q, `${item.label} ${item.hint ?? ""} ${item.keywords}`) : 1 }))
      .filter(({ item, score }) => score > 0 && (q || !item.queryOnly))
    const pick = (group: PaletteItem["group"], limit: number) =>
      scored
        .filter(({ item }) => item.group === group)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ item }) => item)
    const result: { key: Group; items: PaletteItem[] }[] = []
    if (!q && recent.length) {
      const recentItems = recent.map((id) => byId.get(id)).filter((item): item is PaletteItem => Boolean(item))
      if (recentItems.length) result.push({ key: "recent", items: recentItems })
    }
    result.push({ key: "sections", items: pick("sections", q ? 4 : 8) })
    result.push({ key: "inserts", items: pick("inserts", q ? GROUP_LIMIT : 5) })
    result.push({ key: "cloud", items: pick("cloud", q ? CLOUD_LIMIT : 5) })
    result.push({ key: "settings", items: pick("settings", GROUP_LIMIT) })
    result.push({ key: "actions", items: pick("actions", q ? GROUP_LIMIT : 6) })
    return result.filter((g) => g.items.length)
  }, [items, query, recent, byId])

  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const cloudShown = groups.find((g) => g.key === "cloud")?.items.length ?? 0

  const select = (item: PaletteItem) => {
    pushRecent(item.id)
    close()
    // let the dialog close before the action re-renders the shell
    window.setTimeout(() => item.run(), 0)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-3xl border-panel-border bg-panel p-0 font-mono shadow-[0_32px_90px_-40px_rgba(0,0,0,0.8)] sm:max-w-xl"
      >
        <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("palette.placeholder")}</DialogDescription>
        <Command shouldFilter={false} loop className="bg-transparent text-foreground">
          <div className="flex items-center gap-2 border-b border-panel-border px-4">
            <Search className="size-4 shrink-0 text-text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("palette.placeholder")}
              aria-label={t("palette.title")}
              className="h-12 w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-text-faint"
            />
            <kbd className="hidden rounded-md border border-panel-border bg-control px-1.5 py-0.5 font-mono text-[10px] text-text-faint sm:block">esc</kbd>
          </div>
          <CommandList className="sk-scroll max-h-[min(60vh,28rem)] p-2">
            {total === 0 ? (
              <CommandEmpty className="py-8 text-center font-mono text-[12px] lowercase text-text-muted">
                {treeState === "loading" && query ? t("palette.cloud.loading") : t("palette.empty")}
              </CommandEmpty>
            ) : null}
            {groups.map((group) => (
              <CommandGroup
                key={group.key}
                heading={t(`palette.group.${group.key}`)}
                className="p-0 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-text-faint"
              >
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem
                      key={`${group.key}:${item.id}`}
                      value={`${group.key}:${item.id}`}
                      onSelect={() => select(item)}
                      className="cursor-pointer gap-3 rounded-xl px-2.5 py-2 font-mono text-[13px] lowercase text-text-secondary data-[selected=true]:bg-panel-hover data-[selected=true]:text-foreground"
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-panel-border bg-control"
                        style={item.accent ? { color: item.accent } : undefined}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>
                        {item.hint ? <span className="block truncate text-[11px] text-text-faint">{item.hint}</span> : null}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
            {query && treeState === "loading" && total > 0 ? (
              <p className="px-3 py-2 font-mono text-[11px] lowercase text-text-faint">{t("palette.cloud.loading")}</p>
            ) : null}
            {query && treeState === "unavailable" ? (
              <p className="px-3 py-2 font-mono text-[11px] lowercase text-text-faint">{t("palette.cloud.unavailable")}</p>
            ) : null}
            {query && cloudShown >= CLOUD_LIMIT ? (
              <p className="px-3 py-2 font-mono text-[11px] lowercase text-text-faint">{t("palette.cloud.more")}</p>
            ) : null}
          </CommandList>
          <div className={cn("flex items-center justify-between gap-3 border-t border-panel-border px-4 py-2 font-mono text-[10px] lowercase text-text-faint")}>
            <span className="flex items-center gap-2">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> {t("palette.hint.navigate")}
              <Kbd>↵</Kbd> {t("palette.hint.select")}
            </span>
            <span className="flex items-center gap-2">
              <Kbd>esc</Kbd> {t("palette.hint.close")}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-panel-border bg-control px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">{children}</kbd>
}
