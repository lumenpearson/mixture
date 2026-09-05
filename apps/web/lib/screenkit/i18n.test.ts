import { describe, expect, it } from "vitest"
import { FEATURE_DICTIONARIES } from "./i18n/index"
import { dictionaryKeys, translate } from "./i18n"

describe("dictionaries", () => {
  it("keep the russian and english key sets identical", () => {
    const ru = new Set(dictionaryKeys("ru"))
    const en = new Set(dictionaryKeys("en"))
    const missingInEn = [...ru].filter((k) => !en.has(k))
    const missingInRu = [...en].filter((k) => !ru.has(k))
    expect(missingInEn).toEqual([])
    expect(missingInRu).toEqual([])
  })

  it("keep every feature dictionary balanced on its own", () => {
    for (const dictionary of FEATURE_DICTIONARIES) {
      const ru = Object.keys(dictionary.ru).sort()
      const en = Object.keys(dictionary.en).sort()
      expect(en).toEqual(ru)
    }
  })

  it("keep every snark block complete for the key prefixes it opens", () => {
    /* A module may voice only part of its strings, but a prefix it does open it
       has to finish, so no panel ends up half sarcastic and half plain russian
       through the runtime fallback. Today every feature dictionary voices all of
       its prefixes, so this is plain ru/snark parity for each of them. */
    const prefix = (key: string) => (key.includes(".") ? key.slice(0, key.indexOf(".")) : key)
    for (const dictionary of FEATURE_DICTIONARIES) {
      if (!dictionary.snark) continue
      const snark = Object.keys(dictionary.snark)
      const opened = new Set(snark.map(prefix))
      const expected = Object.keys(dictionary.ru).filter((k) => opened.has(prefix(k)))
      expect(snark.sort()).toEqual(expected.sort())
    }
  })

  it("never lets the sarcastic voice invent keys the base does not have", () => {
    const ru = new Set(dictionaryKeys("ru"))
    const unknown = dictionaryKeys("snark").filter((k) => !ru.has(k))
    expect(unknown).toEqual([])
  })

  it("falls back from snark to russian and from unknown keys to the key", () => {
    expect(translate("snark", "section.library")).toBe(translate("ru", "section.library"))
    expect(translate("en", "no.such.key")).toBe("no.such.key")
  })
})
