import * as React from "react"
import { useSettings, type UiLocale } from "@/lib/settings"
import en from "./en"
import ru, { type Dict } from "./ru"
import snark from "./snark"

/* ------------------------------------------------------------------ *
 * interface strings
 *
 * Three voices, one key set: `snark` is russian with light sarcasm and
 * kaomoji, exactly like the web dictionary. `t(key, vars)` substitutes
 * `{name}` placeholders; an unknown key falls back to russian and then
 * to the key itself, so a missing string is visible rather than blank.
 * ------------------------------------------------------------------ */

export type TKey = keyof Dict

const DICTS: Record<UiLocale, Dict> = { ru, en, snark }

/** the content language an interface language resolves to */
export const contentLocaleOf = (locale: UiLocale): "ru" | "en" => (locale === "en" ? "en" : "ru")

type I18nValue = {
  locale: UiLocale
  content: "ru" | "en"
  t: (key: TKey, vars?: Record<string, string | number>) => string
}

const I18nContext = React.createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const locale = settings.locale

  const value = React.useMemo<I18nValue>(() => {
    const dict = DICTS[locale] ?? ru
    return {
      locale,
      content: contentLocaleOf(locale),
      t: (key, vars) => {
        const raw = dict[key] ?? ru[key] ?? String(key)
        if (!vars) return raw
        return Object.entries(vars).reduce(
          (text, [name, replacement]) => text.split(`{${name}}`).join(String(replacement)),
          raw,
        )
      },
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = React.useContext(I18nContext)
  if (!value) throw new Error("useI18n() outside I18nProvider")
  return value
}
