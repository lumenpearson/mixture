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
