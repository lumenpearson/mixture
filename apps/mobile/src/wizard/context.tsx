import * as React from "react"
import { KEYS, readJson, remove, writeJson } from "@/lib/storage"
import { WIZARD_STEPS, emptyDraft, type WizardDraft, type WizardStep } from "./draft"

/* ------------------------------------------------------------------ *
 * the wizard's state
 *
 * One provider mounted by the wizard stack. Every patch is written to
 * AsyncStorage, so reopening the app lands on the step the draft stopped
 * at; `restored` tells the first screen whether to offer "continue".
 * ------------------------------------------------------------------ */

type WizardValue = {
  draft: WizardDraft
  /** true when a saved draft with real content was found at mount */
  restored: boolean
  ready: boolean
  patch: (values: Partial<WizardDraft>) => void
  discard: () => void
  stepIndex: number
  total: number
}

const WizardContext = React.createContext<WizardValue | null>(null)

export function WizardProvider({
  children,
  defaultCategory,
}: {
  children: React.ReactNode
  defaultCategory: string
}) {
  const [draft, setDraft] = React.useState<WizardDraft>(() => emptyDraft(defaultCategory))
  const [restored, setRestored] = React.useState(false)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    void (async () => {
      const stored = await readJson<Partial<WizardDraft>>(KEYS.wizardDraft)
      if (stored && stored.version === 1 && typeof stored.titleRu === "string") {
        const step = WIZARD_STEPS.includes(stored.step as WizardStep)
          ? (stored.step as WizardStep)
          : "kind"
        setDraft({ ...emptyDraft(defaultCategory), ...stored, step })
        setRestored(true)
      }
      setReady(true)
    })()
    // the default category comes from the library and can arrive late; the
    // draft is loaded once, on mount, and keeps whatever it stored
  }, [defaultCategory])

  const patch = React.useCallback((values: Partial<WizardDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...values, updatedAt: Date.now() }
      void writeJson(KEYS.wizardDraft, next)
      return next
    })
  }, [])

  const discard = React.useCallback(() => {
    setDraft(emptyDraft(defaultCategory))
    setRestored(false)
    void remove(KEYS.wizardDraft)
  }, [defaultCategory])

  const value = React.useMemo<WizardValue>(
    () => ({
      draft,
      restored,
      ready,
      patch,
      discard,
      stepIndex: Math.max(0, WIZARD_STEPS.indexOf(draft.step)),
      total: WIZARD_STEPS.length,
    }),
    [draft, restored, ready, patch, discard],
  )

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}

export function useWizard(): WizardValue {
  const value = React.useContext(WizardContext)
  if (!value) throw new Error("useWizard() outside WizardProvider")
  return value
}
