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
import { CATEGORY_LABEL_KEY, categoryFor } from "@/lib/cloud/file-types"
import { formatBytes } from "@/lib/cloud/paths"
import { EntryKind, type Entry } from "@mixture/protocol/cloud"
import { Copy, MoveRight, Plus } from "lucide-react"
import * as React from "react"
import { KeyVal } from "../primitives"
import { useScreenkit } from "../store"
import { VISIBILITY_KEY } from "./entry-row"
import { toolbarButtonCls, toolbarPrimaryCls } from "./toolbar"
import { copyText } from "@/lib/clipboard"

/* ------------------------------------------------------------------ *
 * the manager's dialogs: new folder, move, delete, properties
 *
 * Each one is controlled from the manager and holds only the text being
 * typed. Deletion always goes through a confirmation — the repository keeps
 * the history, but a folder delete is one commit and there is no undo in the
 * interface.
 * ------------------------------------------------------------------ */

const inputCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"

export function NewFolderDialog({
  open,
  parent,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  parent: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
}) {
  const { t } = useScreenkit()
  const [name, setName] = React.useState("")
  React.useEffect(() => {
    if (open) setName("")
  }, [open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overscroll-contain border-panel-border bg-panel">
        <DialogHeader>
          <DialogTitle className="font-mono lowercase text-foreground">{t("cloud.newFolder")}</DialogTitle>
          <DialogDescription className="font-mono text-xs lowercase text-text-muted" translate="no">
            {parent || t("cloud.root")}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          autoComplete="off"
          spellCheck={false}
          aria-label={t("cloud.newFolder")}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim()) onSubmit(name.trim())
          }}
          placeholder={t("cloud.folderNamePh")}
          className={inputCls}
        />
        <DialogFooter>
          <button
            type="button"
            className={toolbarPrimaryCls}
            disabled={!name.trim() || busy}
            onClick={() => onSubmit(name.trim())}
          >
            <Plus className="size-3.5" aria-hidden="true" /> {t("cloud.create")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MoveDialog({
  open,
  initial,
  count,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  /** the path being moved, or the destination folder for a multi-select move */
  initial: string
  /** more than one means the value is a destination folder */
  count: number
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (target: string) => void
}) {
  const { t } = useScreenkit()
  const [value, setValue] = React.useState(initial)
  React.useEffect(() => {
    if (open) setValue(initial)
  }, [open, initial])
  const many = count > 1
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overscroll-contain border-panel-border bg-panel">
        <DialogHeader>
          <DialogTitle className="font-mono lowercase text-foreground">
            {many ? t("cloudfm.select.move") : t("cloudfm.move.title")}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs lowercase text-text-muted" translate="no">
            {many ? `${t("cloudfm.select.moveDesc")} · ${count}` : initial}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={value}
          autoComplete="off"
          spellCheck={false}
          aria-label={t("cloudfm.move.target")}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim()) onSubmit(value.trim())
          }}
          placeholder={t("cloud.renamePh")}
          className={inputCls}
        />
        <DialogFooter>
          <button
            type="button"
            className={toolbarPrimaryCls}
            disabled={!value.trim() || busy || (!many && value.trim() === initial)}
            onClick={() => onSubmit(value.trim())}
          >
            <MoveRight className="size-3.5" aria-hidden="true" /> {t("cloud.move")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteDialog({
  open,
  targets,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  targets: readonly Entry[]
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useScreenkit()
  const many = targets.length > 1
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="overscroll-contain border-panel-border bg-panel">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono lowercase text-foreground">
            {t("cloud.confirmDelete")}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-xs lowercase text-text-muted [overflow-wrap:anywhere]">
            {many
              ? `${t("cloudfm.delete.many")} · ${targets.length}`
              : `${targets[0]?.path ?? ""} — ${t("cloud.confirmDeleteDesc")}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-panel-border bg-control font-mono text-sm lowercase text-foreground">
            {t("editor.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-xl bg-accent-red font-mono text-sm lowercase text-white hover:opacity-90"
          >
            {t("cloud.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function PropertiesDialog({
  entry,
  onOpenChange,
}: {
  entry: Entry | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useScreenkit()
  if (!entry) return null
  const isDir = entry.kind === EntryKind.DIRECTORY
  const category = isDir ? null : categoryFor(entry.name, entry.contentType)
  const copy = (value: string) => {
    void copyText(value, t("common.copied"), t("menu.copyFailed"))
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overscroll-contain border-panel-border bg-panel">
        <DialogHeader>
          <DialogTitle className="font-mono lowercase text-foreground">
            {isDir ? t("cloudfm.menu.folderProperties") : t("cloudfm.props.title")}
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-xs lowercase text-text-muted" translate="no">
            {entry.name}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col">
          <KeyVal label={t("cloudfm.props.path")} value={<span translate="no">{entry.path}</span>} />
          <KeyVal label={t("cloud.size")} value={isDir ? t("cloudfm.props.none") : formatBytes(entry.size)} />
          <KeyVal
            label={t("cloudfm.props.category")}
            value={category ? t(CATEGORY_LABEL_KEY[category]) : t("cloud.root")}
          />
          <KeyVal label={t("cloudfm.props.contentType")} value={entry.contentType || t("cloudfm.props.none")} />
          <KeyVal label={t("cloud.visibility")} value={t(VISIBILITY_KEY[entry.visibility])} />
          <KeyVal label={t("cloudfm.props.sha")} value={entry.sha || t("cloudfm.props.none")} />
          <KeyVal
            label={t("cloudfm.props.downloadUrl")}
            value={entry.downloadUrl ? t("cloud.download") : t("cloudfm.props.none")}
          />
        </div>
        <DialogFooter>
          <button type="button" className={toolbarButtonCls} onClick={() => copy(entry.path)}>
            <Copy className="size-3.5" aria-hidden="true" /> {t("cloudfm.menu.copyPath")}
          </button>
          {entry.downloadUrl ? (
            <a
              href={entry.downloadUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={toolbarButtonCls}
            >
              {t("cloudfm.props.downloadUrl")}
            </a>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
