import Constants from "expo-constants"
import * as React from "react"
import type { PaletteName } from "@/theme/tokens"
import { KEYS, readJson, writeJson } from "./storage"

/* ------------------------------------------------------------------ *
 * app settings
 *
 * One store for everything the settings tab changes: colour scheme and
 * accent palette, interface language (the third one, `snark`, is the
 * russian voice with kaomoji), the RPC endpoint and the granted local
 * folder. Everything is written to AsyncStorage on change and read back
 * once at start; until that read finishes `ready` is false and the root
 * layout keeps the splash screen up.
 * ------------------------------------------------------------------ */

export type UiLocale = "ru" | "en" | "snark"
export type SchemeSetting = "system" | "dark" | "light"
export type ListMode = "list" | "grid"

export type Settings = {
  scheme: SchemeSetting
  palette: PaletteName
  locale: UiLocale
  /** origin of the site that serves /api/rpc, no trailing slash */
  rpcBaseUrl: string
  /** connect protocol wire format; see lib/rpc/client.ts for why grpc-web is out */
  rpcFormat: "binary" | "json"
  rpcTimeoutMs: number
  editToken: string
  cloudToken: string
  cloudKey: string
  /** SAF tree uri of the folder the user granted, "" when none */
  localRoot: string
  localRootName: string
  cloudView: ListMode
}

const configuredBase =
  (Constants.expoConfig?.extra?.rpcBaseUrl as string | undefined) ??
  "https://mixture-codeilluminators.vercel.app"

export const DEFAULT_SETTINGS: Settings = {
  scheme: "system",
  palette: "default",
  locale: "ru",
  rpcBaseUrl: configuredBase.replace(/\/+$/, ""),
  rpcFormat: "binary",
  rpcTimeoutMs: 15000,
  editToken: "",
  cloudToken: "",
  cloudKey: "",
  localRoot: "",
  localRootName: "",
  cloudView: "list",
}

type SettingsValue = {
  settings: Settings
  ready: boolean
  update: (patch: Partial<Settings>) => void
  reset: () => void
}

const SettingsContext = React.createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await readJson<Partial<Settings>>(KEYS.settings)
      if (cancelled) return
      if (stored) setSettings((current) => ({ ...current, ...stored }))
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = React.useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      void writeJson(KEYS.settings, next)
      return next
    })
  }, [])

  const reset = React.useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    void writeJson(KEYS.settings, DEFAULT_SETTINGS)
  }, [])

  const value = React.useMemo<SettingsValue>(
    () => ({ settings, ready, update, reset }),
    [settings, ready, update, reset],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const value = React.useContext(SettingsContext)
  if (!value) throw new Error("useSettings() outside SettingsProvider")
  return value
}
