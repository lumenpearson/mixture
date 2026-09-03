"use client"

import { Loader2, Plus } from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"

/** window event that opens the wizard from menus and the palette */
export const WIZARD_OPEN_EVENT = "screenkit:wizard-open"

export function openInsertWizard() {
  window.dispatchEvent(new CustomEvent(WIZARD_OPEN_EVENT))
}

/* the dialog is a few screens of forms and previews: load it on first open */
const InsertWizard = React.lazy(() => import("./insert-wizard").then((module) => ({ default: module.InsertWizard })))

export function InsertWizardButton() {
  const { persistent, t } = useScreenkit()
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    const onOpen = () => {
      if (persistent) setOpen(true)
    }
    window.addEventListener(WIZARD_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(WIZARD_OPEN_EVENT, onOpen)
  }, [persistent])
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
      {open ? (
        <React.Suspense
          fallback={
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
              <Loader2 className="size-3 animate-spin" />
            </span>
          }
        >
          <InsertWizard open={open} onOpenChange={setOpen} />
        </React.Suspense>
      ) : null}
    </>
  )
}
