import * as React from "react"
import { useColorScheme } from "react-native"
import { useSettings } from "@/lib/settings"
import { resolvePalette, type Palette, type Scheme } from "./tokens"

/* ------------------------------------------------------------------ *
 * the resolved palette
 *
 * `theme.tsx` on the web writes `data-*` attributes on <html>; here the
 * same choice (scheme + accent palette) is read from the settings store
 * and handed down as plain objects, because react native has no cascade.
 * ------------------------------------------------------------------ */

type ThemeValue = { palette: Palette; scheme: Scheme }

const ThemeContext = React.createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const system = useColorScheme()
  const scheme: Scheme =
    settings.scheme === "system" ? (system === "light" ? "light" : "dark") : settings.scheme

  const value = React.useMemo<ThemeValue>(
    () => ({ scheme, palette: resolvePalette(scheme, settings.palette) }),
    [scheme, settings.palette],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = React.useContext(ThemeContext)
  if (!value) throw new Error("useTheme() outside ThemeProvider")
  return value
}

export const usePalette = (): Palette => useTheme().palette

export * from "./tokens"
