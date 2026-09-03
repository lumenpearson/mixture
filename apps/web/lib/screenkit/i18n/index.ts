import type { UiLocale } from "@screenkit/core"
import cloudManager from "./cloud-manager"
import glass from "./glass"
import layout from "./layout"
import local from "./local"
import menu from "./menu"
import palette from "./palette"
import player from "./player"
import rpc from "./rpc"
import wizard from "./wizard"

/* ------------------------------------------------------------------ *
 * feature dictionaries
 *
 * Each feature keeps its own strings in one module so several people (or
 * agents) can extend the interface without editing the same file. Every
 * module exports `{ ru, en }` and optionally `snark`; `i18n.ts` merges them
 * on top of the base dictionary in this order, so a later module may
 * override an earlier key on purpose.
 * ------------------------------------------------------------------ */

export type Dict = Record<string, string>
export type FeatureDictionary = Partial<Record<UiLocale, Dict>> & { ru: Dict; en: Dict }

export const FEATURE_DICTIONARIES: FeatureDictionary[] = [
  cloudManager,
  glass,
  layout,
  local,
  menu,
  palette,
  player,
  rpc,
  wizard,
]
