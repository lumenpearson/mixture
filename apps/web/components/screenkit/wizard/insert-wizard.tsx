"use client"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, X } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { useScreenkit } from "../store"
import {
  WIZARD_STEPS,
  clearDraft,
  emptyDraft,
  isDraftStarted,
  loadDraft,
  normalizeHttpUrl,
  saveDraft,
  splitLines,
  validateStep,
  type DraftDefaults,
  type WizardDraft,
  type WizardStep,
} from "./draft"
import { IdentityStep, KindStep, ReviewStep, SourceStep, TextsStep } from "./steps"
import { useNarrow } from "./use-narrow"

/* ------------------------------------------------------------------ *
 * the insert creation wizard
 *
 * Five screens with a progress bar, back / next and a draft that saves
 * itself. Wide screens get a dialog with a step rail; narrow screens get
 * one full-screen step at a time with a sticky footer.
 * ------------------------------------------------------------------ */

const STEP_COMPONENTS: Record<WizardStep, React.ComponentType<{ draft: WizardDraft; update: (patch: Partial<WizardDraft>) => void }>> = {
  kind: KindStep,
  source: SourceStep,
  identity: IdentityStep,
  texts: TextsStep,
  review: ReviewStep,
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

export function InsertWizardButton() {
  const { persistent, t } = useScreenkit()
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-control-active px-3 py-2 font-mono text-xs lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!persistent}
        title={!persistent ? t("editor.noDatabase") : undefined}
      >
        <Plus className="size-3.5" /> {t("editor.addInsert")}
      </button>
      {open ? <InsertWizard open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}

export function InsertWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, categories, addInsert, libraryBusy } = useScreenkit()
  const narrow = useNarrow()
  const defaults = React.useMemo<DraftDefaults>(
    () => ({ category: String(categories[0]?.id ?? "phones"), device: "phone", aspect: "9:16" }),
    [categories],
  )
  const [draft, setDraft] = React.useState<WizardDraft>(() => emptyDraft(defaults))
  const [resumable, setResumable] = React.useState<WizardDraft | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const saveTimer = React.useRef<number | null>(null)
  const bodyRef = React.useRef<HTMLDivElement | null>(null)

  // offer to resume a saved draft once per opening
  React.useEffect(() => {
    if (!open) return
    const saved = loadDraft()
    if (saved && isDraftStarted(saved, defaults)) setResumable(saved)
  }, [open, defaults])

  const update = React.useCallback((patch: Partial<WizardDraft>) => {
    setError(null)
    setDraft((current) => {
      const next = { ...current, ...patch }
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => saveDraft(next), 300)
      return next
    })
  }, [])

  React.useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    },
    [],
  )

  const index = WIZARD_STEPS.indexOf(draft.step)
  const total = WIZARD_STEPS.length
  const isLast = index === total - 1

  const goTo = (step: WizardStep) => {
    update({ step })
    bodyRef.current?.scrollTo({ top: 0 })
  }

  const next = () => {
    const problem = validateStep(draft, draft.step)
    if (problem) {
      setError(t(problem))
      return
    }
    if (!isLast) goTo(WIZARD_STEPS[index + 1])
  }

  const back = () => {
    if (index > 0) goTo(WIZARD_STEPS[index - 1])
  }

  const submit = async () => {
    const problem = validateStep(draft, "review")
    if (problem) {
      setError(t(problem))
      return
    }
    setBusy(true)
    try {
      await addInsert({
        slug: draft.slug.trim() || undefined,
        category: draft.category,
        device: draft.device,
        aspect: draft.aspect,
        status: draft.status,
        episode: draft.episode || "ep-01",
        scene: draft.scene || "sc-01",
        date: draft.date,
        titleRu: draft.titleRu.trim(),
        titleEn: draft.titleEn.trim() || undefined,
        descriptionRu: draft.descriptionRu || undefined,
        descriptionEn: draft.descriptionEn || undefined,
        promptRu: draft.promptRu || undefined,
        promptEn: draft.promptEn || undefined,
        shortPromptRu: draft.shortPromptRu || undefined,
        shortPromptEn: draft.shortPromptEn || undefined,
        negativePromptRu: draft.negativePromptRu || undefined,
        negativePromptEn: draft.negativePromptEn || undefined,
        technicalNotesRu: splitLines(draft.technicalNotesRu),
        technicalNotesEn: splitLines(draft.technicalNotesEn),
        kind: draft.kind,
        source:
          draft.kind === "scene"
            ? undefined
            : draft.kind === "site"
              ? { ...draft.source, url: normalizeHttpUrl(draft.source.url) }
              : draft.source,
      })
    } catch {
      setBusy(false)
      return
    }
    setBusy(false)
    clearDraft()
    setDraft(emptyDraft(defaults))
    onOpenChange(false)
    toast.success(t("editor.saved"))
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey) return
    const target = event.target as HTMLElement
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON" || target.getAttribute("role") === "combobox") return
    event.preventDefault()
    if (isLast) void submit()
    else next()
  }

  const Step = STEP_COMPONENTS[draft.step]
  const progress = ((index + 1) / total) * 100
  const stepLabel = fill(t("wizard.stepOf"), { n: index + 1, total })

  const footer = (
    <div className={cn("flex items-center gap-2 border-t border-panel-border bg-panel px-4 py-3", narrow && "sk-safe-bottom sticky bottom-0")}>
      <button
        type="button"
        onClick={back}
        disabled={index === 0 || busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowLeft className="size-3.5" /> {t("wizard.back")}
      </button>
      {error ? <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-accent-red">{error}</span> : <span className="flex-1" />}
      {isLast ? (
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || libraryBusy}
          className="inline-flex items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {busy ? t("wizard.creating") : t("wizard.create")}
        </button>
      ) : (
        <button
          type="button"
          onClick={next}
          className="inline-flex items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90"
        >
          {t("wizard.next")} <ArrowRight className="size-4" />
        </button>
      )}
    </div>
  )

  const resumeBanner = resumable ? (
    <div className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-sm lowercase text-foreground">{t("wizard.resume")}</span>
        <span className="font-mono text-[12px] text-text-muted">{t("wizard.resumeDesc")}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(resumable)
            setResumable(null)
          }}
          className="rounded-xl bg-control-active px-3 py-2 font-mono text-xs lowercase text-control-active-foreground transition-opacity hover:opacity-90"
        >
          {t("wizard.continue")}
        </button>
        <button
          type="button"
          onClick={() => {
            clearDraft()
            setResumable(null)
          }}
          className="rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover"
        >
          {t("wizard.startOver")}
        </button>
      </div>
    </div>
  ) : null

  const body = (
    <div ref={bodyRef} onKeyDown={onKeyDown} className={cn("sk-scroll min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6", !narrow && "max-h-[70vh]")}>
      <div key={draft.step} className="sk-animate-in flex flex-col gap-5">
        {resumeBanner}
        <Step draft={draft} update={update} />
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-panel-border bg-panel p-0",
          narrow
            ? "inset-0 top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none"
            : "max-w-[calc(100%-2rem)] sm:max-w-4xl",
        )}
      >
        <DialogTitle className="sr-only">{t("wizard.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("wizard.desc")}</DialogDescription>

        {narrow ? (
          <div className="flex flex-col gap-2 border-b border-panel-border px-4 pb-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm lowercase text-foreground">{t("wizard.title")}</span>
              <button type="button" onClick={() => onOpenChange(false)} aria-label={t("editor.cancel")} className="inline-flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-panel-hover">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] lowercase text-text-muted">
              <span>{stepLabel}</span>
              <span className="text-foreground">{t(`wizard.step.${draft.step}`)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-control">
              <div className="sk-resize h-full rounded-full bg-accent-cyan" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        <div className={cn("flex min-h-0 flex-1", narrow ? "flex-col" : "flex-row")}>
          {!narrow ? (
            <aside className="flex w-52 shrink-0 flex-col gap-4 border-r border-panel-border bg-panel-soft p-5">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-sm lowercase text-foreground">{t("wizard.title")}</span>
                <span className="font-mono text-[11px] lowercase text-text-muted">{stepLabel}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-control">
                <div className="sk-resize h-full rounded-full bg-accent-cyan" style={{ width: `${progress}%` }} />
              </div>
              <ol className="flex flex-col gap-1">
                {WIZARD_STEPS.map((step, stepIndex) => {
                  const done = stepIndex < index
                  const current = stepIndex === index
                  return (
                    <li key={step}>
                      <button
                        type="button"
                        onClick={() => stepIndex < index && goTo(step)}
                        disabled={stepIndex > index}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-mono text-[12px] lowercase transition-colors",
                          current ? "bg-control-active text-control-active-foreground" : done ? "text-foreground hover:bg-panel-hover" : "text-text-faint",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums",
                            current ? "border-transparent bg-panel text-foreground" : done ? "border-accent-green text-accent-green" : "border-panel-border",
                          )}
                        >
                          {done ? <Check className="size-3" /> : stepIndex + 1}
                        </span>
                        {t(`wizard.step.${step}`)}
                      </button>
                    </li>
                  )
                })}
              </ol>
              <p className="mt-auto font-mono text-[11px] leading-relaxed text-text-faint">{t("wizard.desc")}</p>
            </aside>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {body}
            {footer}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
