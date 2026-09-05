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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { KeyRound, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { ICON_LIBRARY, ICON_NAMES } from "./icons"
import { useScreenkit } from "./store"
import { InsertWizardButton } from "./wizard/button"

/* accent colors offered when creating a category — inserts placed in the
   category inherit this color on their tiles */
const ACCENT_OPTIONS = [
  "var(--accent-blue)",
  "var(--accent-cyan)",
  "var(--accent-green)",
  "var(--accent-orange)",
  "var(--accent-red)",
  "var(--accent-purple)",
  "var(--accent-grey)",
]

/* ---------- shared field shell ---------- */

function Fld({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[11px] lowercase text-text-secondary">
        {label}
        {hint ? (
          <span className="ml-1 text-text-faint">— {hint}</span>
        ) : null}
      </Label>
      {children}
    </div>
  )
}

const inputCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"
const triggerCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm lowercase text-foreground focus:ring-ring"
const secondaryBtn =
  "inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-50"
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:opacity-60"

/* ---------- add category ---------- */

function AddCategoryDialog() {
  const { addCategory, libraryBusy, persistent, t } = useScreenkit()
  const [open, setOpen] = React.useState(false)
  const [labelRu, setLabelRu] = React.useState("")
  const [labelEn, setLabelEn] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [icon, setIcon] = React.useState<string>("layers")
  const [accent, setAccent] = React.useState<string>(ACCENT_OPTIONS[0])
  const [error, setError] = React.useState<string | null>(null)

  async function submit() {
    if (!labelRu.trim()) {
      setError(t("editor.required"))
      return
    }
    setError(null)
    try {
      await addCategory({
        labelRu,
        labelEn: labelEn || undefined,
        slug: slug || undefined,
        icon,
        accent,
      })
    } catch {
      return
    }
    setLabelRu("")
    setLabelEn("")
    setSlug("")
    setIcon("layers")
    setAccent(ACCENT_OPTIONS[0])
    setOpen(false)
    toast.success(t("editor.saved"))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={secondaryBtn} disabled={!persistent} title={!persistent ? t("editor.noDatabase") : undefined}>
          <Plus className="size-3.5" /> {t("editor.addCategory")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md border-panel-border bg-panel">
        <DialogHeader>
          <DialogTitle className="font-mono lowercase text-foreground">
            {t("editor.newCategory")}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs lowercase text-text-muted">
            {t("editor.newCategoryDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <Fld label={t("editor.labelRu")}>
            <Input
              value={labelRu}
              onChange={(e) => setLabelRu(e.target.value)}
              placeholder={t("editor.labelRuPh")}
              className={inputCls}
            />
          </Fld>
          <Fld label={t("editor.labelEn")} hint={t("editor.optional")}>
            <Input
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
              placeholder={t("editor.labelEnPh")}
              className={inputCls}
            />
          </Fld>
          <Fld label={t("editor.slug")} hint={t("editor.slugHint")}>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t("editor.slugPh")}
              className={inputCls}
            />
          </Fld>

          <Fld label={t("editor.color")} hint={t("editor.colorHint")}>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_OPTIONS.map((c) => {
                const selected = accent === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAccent(c)}
                    aria-pressed={selected}
                    aria-label={c}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform",
                      selected
                        ? "scale-110 border-foreground"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ background: c }}
                  />
                )
              })}
            </div>
          </Fld>

          <Fld label={t("editor.icon")} hint={t("editor.iconHint")}>
            <div className="grid max-h-40 grid-cols-7 gap-1.5 overflow-y-auto rounded-xl border border-panel-border bg-control p-2 sk-scroll sm:grid-cols-9">
              {ICON_NAMES.map((name) => {
                const Glyph = ICON_LIBRARY[name]
                const selected = icon === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    aria-pressed={selected}
                    aria-label={name}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                      selected
                        ? "border-transparent text-control-active-foreground"
                        : "border-panel-border text-text-secondary hover:bg-panel-hover hover:text-foreground",
                    )}
                    style={
                      selected
                        ? { background: accent, color: "#050505" }
                        : undefined
                    }
                  >
                    <Glyph className="size-4" />
                  </button>
                )
              })}
            </div>
          </Fld>

          {error ? (
            <p className="font-mono text-xs text-accent-red">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <button onClick={submit} disabled={libraryBusy} className={primaryBtn}>
            {libraryBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {t("editor.save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- delete insert (used by the preview header) ---------- */

export function DeleteInsertButton({ id, icon }: { id: string; icon?: React.ReactNode }) {
  const { t } = useScreenkit()
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("editor.deleteInsert")}
        title={t("editor.deleteInsert")}
        className="inline-flex size-9 items-center justify-center rounded-full border border-panel-border bg-control text-text-secondary transition-colors hover:bg-panel-hover hover:text-accent-red"
      >
        {icon ?? <Trash2 className="size-4" />}
      </button>
      <DeleteInsertDialog id={open ? id : null} onOpenChange={setOpen} />
    </>
  )
}

/** a controlled confirmation; `id` null keeps it closed */
export function DeleteInsertDialog({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const { deleteInsert, libraryBusy, t, inserts, selectedId, setSelectedId } = useScreenkit()
  return (
    <AlertDialog open={id !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-panel-border bg-panel">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono lowercase text-foreground">{t("editor.deleteInsert")}</AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-xs lowercase text-text-muted">
            {id} — {t("editor.deleteInsertDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-panel-border bg-control font-mono text-sm lowercase text-foreground">
            {t("editor.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={libraryBusy || id === null}
            onClick={() => {
              if (id === null) return
              void deleteInsert(id)
                .then(() => {
                  if (selectedId === id) {
                    const fallback = inserts.find((i) => i.id !== id)
                    if (fallback) setSelectedId(fallback.id)
                  }
                  toast.success(t("editor.deleted"))
                })
                .catch(() => null)
            }}
            className="rounded-xl bg-accent-red font-mono text-sm lowercase text-white hover:opacity-90"
          >
            {t("editor.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ---------- delete category ---------- */

function DeleteCategoryDialog() {
  const { categories, deleteCategory, libraryBusy, catLabel, t } = useScreenkit()
  const custom = categories.filter((c) => c.custom)
  const [target, setTarget] = React.useState<string>("")
  if (!custom.length) return null
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className={secondaryBtn}>
          <Trash2 className="size-3.5" /> {t("editor.deleteCategory")}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-panel-border bg-panel">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono lowercase text-foreground">{t("editor.deleteCategory")}</AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-xs lowercase text-text-muted">
            {t("editor.deleteCategoryDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className={triggerCls}>
            <SelectValue placeholder={t("library.category")} />
          </SelectTrigger>
          <SelectContent>
            {custom.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} className="lowercase">
                {catLabel(c.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-panel-border bg-control font-mono text-sm lowercase text-foreground">
            {t("editor.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!target || libraryBusy}
            onClick={() =>
              void deleteCategory(target)
                .then(() => {
                  setTarget("")
                  toast.success(t("editor.deleted"))
                })
                .catch(() => null)
            }
            className="rounded-xl bg-accent-red font-mono text-sm lowercase text-white hover:opacity-90"
          >
            {t("editor.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ---------- edit token ---------- */

function EditTokenDialog() {
  const { editLocked, editToken, setEditToken, t } = useScreenkit()
  const [value, setValue] = React.useState(editToken)
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => setValue(editToken), [editToken])
  if (!editLocked) return null
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={cn(secondaryBtn, editToken ? "text-accent-green" : "text-accent-orange")} title={t("editor.locked")}>
          <KeyRound className="size-3.5" /> {t("editor.editToken")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md border-panel-border bg-panel">
        <DialogHeader>
          <DialogTitle className="font-mono lowercase text-foreground">{t("editor.editToken")}</DialogTitle>
          <DialogDescription className="font-mono text-xs lowercase text-text-muted">{t("editor.editTokenDesc")}</DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("editor.editTokenPh")}
          className={inputCls}
        />
        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              setEditToken(value)
              setOpen(false)
            }}
            className={primaryBtn}
          >
            <KeyRound className="size-4" /> {t("editor.save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- reset ---------- */

function ResetButton() {
  const { resetLibrary, libraryBusy, hasCustom, t } = useScreenkit()
  if (!hasCustom) return null
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground">
          <RotateCcw className="size-3.5" /> {t("editor.reset")}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-panel-border bg-panel">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono lowercase text-foreground">
            {t("editor.resetTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-xs lowercase text-text-muted">
            {t("editor.resetDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-panel-border bg-control font-mono text-sm lowercase text-foreground">
            {t("editor.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void resetLibrary().catch(() => null)}
            disabled={libraryBusy}
            className="rounded-xl bg-accent-red font-mono text-sm lowercase text-white hover:opacity-90"
          >
            {t("editor.resetConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function LibraryEditor() {
  const { persistent, t } = useScreenkit()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <InsertWizardButton />
        <AddCategoryDialog />
        <DeleteCategoryDialog />
        <EditTokenDialog />
        <ResetButton />
      </div>
      {!persistent ? (
        <p className="font-mono text-[11px] lowercase text-text-faint">{t("editor.noDatabase")}</p>
      ) : null}
    </div>
  )
}
