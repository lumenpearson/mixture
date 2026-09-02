"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  CLOUD_KEY_STORAGE_KEY,
  CLOUD_TOKEN_STORAGE_KEY,
  cloudClient,
  getCloudKey,
  getCloudToken,
  rpcErrorMessage,
  writeStorage,
} from "@/lib/rpc/client"
import { RPC_MAX_MESSAGE_BYTES } from "@/lib/rpc/limits"
import { cn } from "@/lib/utils"
import { EntryKind, Role, Visibility, type Entry, type Status } from "@mixture/protocol/cloud"
import {
  ChevronRight,
  Cloud,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  File as FileIcon,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderPlus,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  MoveRight,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { CloudAccessEditor } from "../cloud-access"
import { staggerDelay } from "../motion"
import { Explain, SectionHeading } from "../primitives"
import { SettingsTabs } from "../settings-tabs"
import { useScreenkit } from "../store"

/* ------------------------------------------------------------------ *
 * cloud drive — files on a private GitHub repository over CloudService
 *
 * Entering the tab always loads the current listing from the repository;
 * every action (upload, folder, move, delete) is one git commit and the
 * listing is refreshed from the server afterwards, so what you see is what
 * the repository holds.
 * ------------------------------------------------------------------ */

const ROLE_KEY: Record<Role, string> = {
  [Role.UNSPECIFIED]: "cloud.role.anonymous",
  [Role.ANONYMOUS]: "cloud.role.anonymous",
  [Role.VIEWER]: "cloud.role.viewer",
  [Role.EDITOR]: "cloud.role.editor",
  [Role.OWNER]: "cloud.role.owner",
}

const VISIBILITY_KEY: Record<Visibility, string> = {
  [Visibility.UNSPECIFIED]: "cloud.visibility.private",
  [Visibility.PRIVATE]: "cloud.visibility.private",
  [Visibility.PUBLIC]: "cloud.visibility.public",
  [Visibility.HIDDEN]: "cloud.visibility.hidden",
}

const inputCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"

const buttonCls =
  "inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-50"

const primaryCls =
  "inline-flex items-center gap-1.5 rounded-xl bg-control-active px-3 py-2 font-mono text-xs lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"

function formatBytes(value: bigint | number): string {
  const n = Number(value)
  if (n < 1024) return `${n} b`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kb`
  return `${(n / (1024 * 1024)).toFixed(2)} mb`
}

function joinPath(base: string, name: string) {
  return base ? `${base}/${name}` : name
}

function readUrlPath(): string {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("path") ?? ""
}

function writeUrlPath(path: string) {
  const params = new URLSearchParams(window.location.search)
  if (path) params.set("path", path)
  else params.delete("path")
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`)
}

function iconFor(entry: Entry) {
  if (entry.kind === EntryKind.DIRECTORY) return Folder
  const type = entry.contentType
  if (type.startsWith("image/")) return FileImage
  if (type.startsWith("video/")) return FileVideo
  if (type.startsWith("audio/")) return FileAudio
  if (type.startsWith("text/") || type === "application/json") return FileText
  return FileIcon
}

function VisibilityIcon({ visibility }: { visibility: Visibility }) {
  if (visibility === Visibility.PUBLIC) return <Globe className="size-3" />
  if (visibility === Visibility.HIDDEN) return <EyeOff className="size-3" />
  return <Lock className="size-3" />
}

type PreviewState = {
  entry: Entry
  url: string | null
  text: string | null
  truncated: boolean
}

export function CloudSection() {
  const { t } = useScreenkit()
  const [status, setStatus] = React.useState<Status | null>(null)
  const [path, setPath] = React.useState(() => readUrlPath())
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [preview, setPreview] = React.useState<PreviewState | null>(null)
  const [showAccess, setShowAccess] = React.useState(false)
  const [showConnect, setShowConnect] = React.useState(false)
  const [folderOpen, setFolderOpen] = React.useState(false)
  const [folderName, setFolderName] = React.useState("")
  const [moveTarget, setMoveTarget] = React.useState<Entry | null>(null)
  const [movePath, setMovePath] = React.useState("")
  const [deleteTarget, setDeleteTarget] = React.useState<Entry | null>(null)
  const fileInput = React.useRef<HTMLInputElement | null>(null)

  const role = status?.role ?? Role.ANONYMOUS
  const canEdit = role === Role.EDITOR || role === Role.OWNER
  const isOwner = role === Role.OWNER
  const connected = Boolean(getCloudToken() || getCloudKey())

  const load = React.useCallback(async (target: string, silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const response = await cloudClient().listEntries({ path: target })
      setEntries(response.entries)
      if (response.status) setStatus(response.status)
    } catch (err) {
      setError(rpcErrorMessage(err))
      try {
        const s = await cloudClient().getStatus({})
        if (s.status) setStatus(s.status)
      } catch {
        // status unavailable too
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load(path)
    writeUrlPath(path)
  }, [path, load])

  React.useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true)
    try {
      await action()
      if (success) toast.success(success)
      await load(path, true)
    } catch (err) {
      toast.error(rpcErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    await run(async () => {
      let count = 0
      for (const file of list) {
        if (file.size > RPC_MAX_MESSAGE_BYTES) {
          toast.error(`${file.name}: ${t("cloud.tooLarge")}`)
          continue
        }
        const content = new Uint8Array(await file.arrayBuffer())
        await cloudClient().writeFile({ path: joinPath(path, file.name), content, sha: "", message: "" })
        count += 1
      }
      if (count) toast.success(`${t("cloud.uploaded")} · ${count}`)
    })
  }

  const openPreview = async (entry: Entry) => {
    try {
      const response = await cloudClient().readFile({ path: entry.path })
      if (preview?.url) URL.revokeObjectURL(preview.url)
      if (response.truncated) {
        setPreview({ entry, url: null, text: null, truncated: true })
        return
      }
      const type = entry.contentType
      const blob = new Blob([response.content as BlobPart], { type })
      const textual = type.startsWith("text/") || type === "application/json"
      setPreview({
        entry,
        url: textual ? null : URL.createObjectURL(blob),
        text: textual ? new TextDecoder().decode(response.content).slice(0, 20_000) : null,
        truncated: false,
      })
    } catch (err) {
      toast.error(rpcErrorMessage(err))
    }
  }

  const download = async (entry: Entry) => {
    try {
      const response = await cloudClient().readFile({ path: entry.path })
      if (response.truncated) {
        if (entry.downloadUrl) window.open(entry.downloadUrl, "_blank", "noopener")
        else toast.error(t("cloud.largeFile"))
        return
      }
      const blob = new Blob([response.content as BlobPart], { type: entry.contentType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = entry.name
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
    } catch (err) {
      toast.error(rpcErrorMessage(err))
    }
  }

  const crumbs = path ? path.split("/") : []

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      onDragOver={(e) => {
        if (!canEdit) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canEdit) return
        e.preventDefault()
        setDragging(false)
        void upload(e.dataTransfer.files)
      }}
    >
      <header className="flex min-w-0 flex-col gap-3">
        <SectionHeading title={t("cloud.title")} link />
        <Explain>{t("cloud.desc")}</Explain>
        <SettingsTabs />
      </header>

      <StatusCard
        status={status}
        connected={connected}
        onConnect={() => setShowConnect((v) => !v)}
        onRefresh={() => void load(path)}
        onAccess={canEdit ? () => setShowAccess((v) => !v) : undefined}
        refreshing={loading}
      />

      {showConnect || (!connected && !status?.configured) ? (
        <ConnectPanel
          onDone={() => {
            setShowConnect(false)
            void load(path)
          }}
        />
      ) : null}

      {status && !status.reachable && status.configured === false && connected ? (
        <InitCard onDone={() => void load(path)} />
      ) : null}
      {status && status.configured && !status.reachable ? <InitCard onDone={() => void load(path)} /> : null}

      {showAccess && canEdit ? <CloudAccessEditor canSave={isOwner} /> : null}

      {/* toolbar */}
      <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-panel-border bg-panel-soft p-3 md:flex-row md:items-center md:justify-between">
        <nav aria-label="path" className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-[12px] lowercase">
          <button type="button" onClick={() => setPath("")} className={cn("rounded-lg px-2 py-1 transition-colors hover:bg-panel-hover", !path ? "text-foreground" : "text-text-secondary")}>
            {t("cloud.root")}
          </button>
          {crumbs.map((crumb, index) => {
            const target = crumbs.slice(0, index + 1).join("/")
            const last = index === crumbs.length - 1
            return (
              <React.Fragment key={target}>
                <ChevronRight className="size-3 text-text-faint" />
                <button
                  type="button"
                  onClick={() => setPath(target)}
                  className={cn("max-w-[14rem] truncate rounded-lg px-2 py-1 transition-colors hover:bg-panel-hover", last ? "text-foreground" : "text-text-secondary")}
                >
                  {crumb}
                </button>
              </React.Fragment>
            )
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files)
              e.target.value = ""
            }}
          />
          <button type="button" className={primaryCls} disabled={!canEdit || busy} onClick={() => fileInput.current?.click()} title={!canEdit ? t("cloud.readOnly") : undefined}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {t("cloud.upload")}
          </button>
          <button type="button" className={buttonCls} disabled={!canEdit || busy} onClick={() => setFolderOpen(true)}>
            <FolderPlus className="size-3.5" /> {t("cloud.newFolder")}
          </button>
          <button type="button" className={buttonCls} onClick={() => void load(path)} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> {t("cloud.refresh")}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-panel-border bg-control px-4 py-3 font-mono text-[12px] lowercase text-accent-red">{error}</div>
      ) : null}

      {/* listing */}
      <div className={cn("relative min-w-0 rounded-3xl border transition-colors", dragging ? "border-ring bg-panel-hover" : "border-panel-border bg-panel-soft")}>
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl font-mono text-sm lowercase text-foreground">
            {t("cloud.dropHere")}
          </div>
        ) : null}
        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem_9rem] items-center gap-3 border-b border-panel-border/60 px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-text-faint sm:grid">
          <span>{t("cloud.name")}</span>
          <span>{t("cloud.visibility")}</span>
          <span className="text-right">{t("cloud.size")}</span>
          <span className="text-right">{t("cloud.actions")}</span>
        </div>
        {loading && !entries.length ? (
          <div className="flex items-center gap-2 px-4 py-6 font-mono text-[12px] lowercase text-text-muted">
            <Loader2 className="size-3.5 animate-spin" /> {t("cloud.loading")}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] lowercase text-text-muted">
            {status?.configured ? t("cloud.empty") : t("cloud.notConfigured")}
          </div>
        ) : (
          <ul className="flex flex-col">
            {entries.map((entry, index) => {
              const Icon = iconFor(entry)
              const isDir = entry.kind === EntryKind.DIRECTORY
              return (
                <li
                  key={entry.path}
                  className="sk-animate-in grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-panel-border/40 px-3 py-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_9rem] sm:px-4"
                  style={staggerDelay(index, 25)}
                >
                  <button
                    type="button"
                    onClick={() => (isDir ? setPath(entry.path) : void openPreview(entry))}
                    className="flex min-w-0 items-center gap-3 text-left"
                  >
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-panel-border", isDir ? "text-accent-orange" : "text-text-secondary")}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-sm lowercase text-foreground">{entry.name}</span>
                      <span className="block truncate font-mono text-[10px] text-text-faint sm:hidden">
                        {isDir ? t(VISIBILITY_KEY[entry.visibility]) : `${formatBytes(entry.size)} · ${t(VISIBILITY_KEY[entry.visibility])}`}
                      </span>
                    </span>
                  </button>
                  <span className="hidden items-center gap-1.5 font-mono text-[11px] lowercase text-text-secondary sm:inline-flex">
                    <VisibilityIcon visibility={entry.visibility} /> {t(VISIBILITY_KEY[entry.visibility])}
                  </span>
                  <span className="hidden text-right font-mono text-[11px] text-text-faint sm:block">{isDir ? "—" : formatBytes(entry.size)}</span>
                  <span className="flex items-center justify-end gap-1">
                    {!isDir ? (
                      <RowButton label={t("cloud.preview")} onClick={() => void openPreview(entry)}>
                        <Eye className="size-3.5" />
                      </RowButton>
                    ) : null}
                    {!isDir ? (
                      <RowButton label={t("cloud.download")} onClick={() => void download(entry)}>
                        <Download className="size-3.5" />
                      </RowButton>
                    ) : null}
                    {entry.editable ? (
                      <RowButton
                        label={t("cloud.rename")}
                        onClick={() => {
                          setMoveTarget(entry)
                          setMovePath(entry.path)
                        }}
                      >
                        <MoveRight className="size-3.5" />
                      </RowButton>
                    ) : null}
                    {entry.editable ? (
                      <RowButton label={t("cloud.delete")} onClick={() => setDeleteTarget(entry)} danger>
                        <Trash2 className="size-3.5" />
                      </RowButton>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* preview */}
      {preview ? (
        <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-panel-border bg-panel-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-mono text-sm lowercase text-foreground">{preview.entry.path}</span>
            <div className="flex items-center gap-1">
              <RowButton label={t("cloud.download")} onClick={() => void download(preview.entry)}>
                <Download className="size-3.5" />
              </RowButton>
              <RowButton label={t("common.close")} onClick={() => setPreview(null)}>
                <X className="size-3.5" />
              </RowButton>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-panel-border bg-black">
            {preview.truncated ? (
              <p className="p-4 font-mono text-[12px] lowercase text-text-muted">{t("cloud.largeFile")}</p>
            ) : preview.text !== null ? (
              <pre className="sk-scroll max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-relaxed text-text-secondary">{preview.text}</pre>
            ) : preview.url && preview.entry.contentType.startsWith("image/") ? (
              <img src={preview.url} alt={preview.entry.name} className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
            ) : preview.url && preview.entry.contentType.startsWith("video/") ? (
              <video src={preview.url} controls className="mx-auto max-h-[70vh] w-full" />
            ) : preview.url && preview.entry.contentType.startsWith("audio/") ? (
              <audio src={preview.url} controls className="w-full p-4" />
            ) : preview.url && preview.entry.contentType === "application/pdf" ? (
              <iframe src={preview.url} title={preview.entry.name} className="h-[70vh] w-full" />
            ) : (
              <p className="p-4 font-mono text-[12px] lowercase text-text-muted">{t("cloud.noPreview")}</p>
            )}
          </div>
        </div>
      ) : null}

      {/* new folder */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="max-w-md border-panel-border bg-panel">
          <DialogHeader>
            <DialogTitle className="font-mono lowercase text-foreground">{t("cloud.newFolder")}</DialogTitle>
            <DialogDescription className="font-mono text-xs lowercase text-text-muted">{path || t("cloud.root")}</DialogDescription>
          </DialogHeader>
          <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder={t("cloud.folderNamePh")} className={inputCls} />
          <DialogFooter>
            <button
              type="button"
              className={primaryCls}
              disabled={!folderName.trim() || busy}
              onClick={() =>
                void run(async () => {
                  await cloudClient().createDirectory({ path: joinPath(path, folderName.trim()) })
                  setFolderName("")
                  setFolderOpen(false)
                }, t("cloud.folderCreated"))
              }
            >
              <Plus className="size-3.5" /> {t("cloud.create")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* move / rename */}
      <Dialog open={moveTarget !== null} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent className="max-w-md border-panel-border bg-panel">
          <DialogHeader>
            <DialogTitle className="font-mono lowercase text-foreground">{t("cloud.rename")}</DialogTitle>
            <DialogDescription className="font-mono text-xs lowercase text-text-muted">{moveTarget?.path}</DialogDescription>
          </DialogHeader>
          <Input value={movePath} onChange={(e) => setMovePath(e.target.value)} placeholder={t("cloud.renamePh")} className={inputCls} />
          <DialogFooter>
            <button
              type="button"
              className={primaryCls}
              disabled={!movePath.trim() || movePath.trim() === moveTarget?.path || busy}
              onClick={() =>
                void run(async () => {
                  if (!moveTarget) return
                  await cloudClient().moveEntry({ from: moveTarget.path, to: movePath.trim() })
                  setMoveTarget(null)
                }, t("cloud.moved"))
              }
            >
              <MoveRight className="size-3.5" /> {t("cloud.move")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-panel-border bg-panel">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono lowercase text-foreground">{t("cloud.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs lowercase text-text-muted">
              {deleteTarget?.path} — {t("cloud.confirmDeleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-panel-border bg-control font-mono text-sm lowercase text-foreground">{t("editor.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void run(async () => {
                  if (!deleteTarget) return
                  await cloudClient().deleteEntry({ path: deleteTarget.path, sha: deleteTarget.sha })
                  if (preview?.entry.path === deleteTarget.path) setPreview(null)
                  setDeleteTarget(null)
                }, t("cloud.deleted"))
              }
              className="rounded-xl bg-accent-red font-mono text-sm lowercase text-white hover:opacity-90"
            >
              {t("cloud.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RowButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-text-faint transition-colors hover:bg-panel-hover",
        danger ? "hover:text-accent-red" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function StatusCard({
  status,
  connected,
  refreshing,
  onConnect,
  onRefresh,
  onAccess,
}: {
  status: Status | null
  connected: boolean
  refreshing: boolean
  onConnect: () => void
  onRefresh: () => void
  onAccess?: () => void
}) {
  const { t } = useScreenkit()
  const role = status?.role ?? Role.ANONYMOUS
  const ok = Boolean(status?.configured && status.reachable)
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border border-panel-border", ok ? "text-accent-green" : "text-text-faint")}>
          {ok ? <Cloud className="size-5" /> : <CloudOff className="size-5" />}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-sm lowercase text-foreground">
            <span className="truncate">{status?.repo ?? "—"}</span>
            {status?.branch ? <span className="rounded-full bg-control px-2 py-0.5 text-[10px] text-text-secondary">{status.branch}</span> : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-control px-2 py-0.5 text-[10px] text-text-secondary">
              <Shield className="size-3" /> {t(ROLE_KEY[role])}
            </span>
          </div>
          <div className="truncate font-mono text-[11px] lowercase text-text-muted">
            {status?.login ? `${t("cloud.signedInAs")} ${status.login}` : status?.message || (ok ? "" : t("cloud.notConfigured"))}
            {status?.login && status.message ? ` · ${status.message}` : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onAccess ? (
          <button type="button" className={buttonCls} onClick={onAccess}>
            <Shield className="size-3.5" /> {t("cloud.access.title")}
          </button>
        ) : null}
        <button type="button" className={buttonCls} onClick={onConnect}>
          <KeyRound className="size-3.5" /> {connected ? t("cloud.connect.saved") : t("cloud.connect.save")}
        </button>
        {status?.repo ? (
          <a href={`https://github.com/${status.repo}`} target="_blank" rel="noreferrer noopener" className={buttonCls}>
            {t("cloud.openOnGithub")}
          </a>
        ) : null}
        <button type="button" className={buttonCls} onClick={onRefresh} disabled={refreshing} aria-label={t("cloud.refresh")}>
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
        </button>
      </div>
    </div>
  )
}

function ConnectPanel({ onDone }: { onDone: () => void }) {
  const { t } = useScreenkit()
  const [token, setToken] = React.useState(() => getCloudToken())
  const [key, setKey] = React.useState(() => getCloudKey())

  const save = () => {
    writeStorage(CLOUD_TOKEN_STORAGE_KEY, token.trim())
    writeStorage(CLOUD_KEY_STORAGE_KEY, key.trim())
    toast.success(t("cloud.connect.saved"))
    onDone()
  }
  const clear = () => {
    setToken("")
    setKey("")
    writeStorage(CLOUD_TOKEN_STORAGE_KEY, "")
    writeStorage(CLOUD_KEY_STORAGE_KEY, "")
    onDone()
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:p-5">
      <SectionHeading title={t("cloud.connect.title")} />
      <Explain>{t("cloud.connect.desc")}</Explain>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] lowercase text-text-secondary">{t("cloud.connect.token")}</span>
          <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={t("cloud.connect.tokenPh")} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] lowercase text-text-secondary">{t("cloud.connect.key")}</span>
          <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={t("cloud.connect.keyPh")} className={inputCls} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryCls} onClick={save} disabled={!token.trim() && !key.trim()}>
          <KeyRound className="size-3.5" /> {t("cloud.connect.save")}
        </button>
        <button type="button" className={buttonCls} onClick={clear}>
          <X className="size-3.5" /> {t("cloud.connect.clear")}
        </button>
      </div>
    </div>
  )
}

function InitCard({ onDone }: { onDone: () => void }) {
  const { t } = useScreenkit()
  const [busy, setBusy] = React.useState(false)
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-dashed border-panel-border bg-control p-4 sm:p-5">
      <SectionHeading title={t("cloud.init.title")} />
      <Explain>{t("cloud.init.desc")}</Explain>
      <button
        type="button"
        className={cn(primaryCls, "w-fit")}
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const response = await cloudClient().initRepository({ private: true })
            toast.success(response.created ? t("cloud.init.created") : t("cloud.init.exists"))
            onDone()
          } catch (err) {
            toast.error(rpcErrorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} {t("cloud.init.button")}
      </button>
    </div>
  )
}
