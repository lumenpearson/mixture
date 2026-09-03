import type * as React from "react"

/* ------------------------------------------------------------------ *
 * context menu model
 *
 * Menus are data first: a list of actions with a `group` key. The menu
 * component draws a separator between groups and a faint label above a
 * group that has one, so the same builder serves the cloud, the library,
 * the preview stage and the desktop / android shells.
 * ------------------------------------------------------------------ */

export type MenuIcon = React.ComponentType<{ className?: string }>

export type MenuAction = {
  id: string
  label: string
  icon?: MenuIcon
  /** shown right-aligned, e.g. "⌘k" or "f" */
  shortcut?: string
  /** drawn in the danger colour */
  danger?: boolean
  disabled?: boolean
  /** a checkbox item when defined */
  checked?: boolean
  /** items with the same group sit together; groups are separated */
  group: string
  run: () => void
}

export type MenuRadio = {
  id: string
  label: string
  icon?: MenuIcon
  group: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export type MenuEntry = MenuAction | MenuRadio

export type MenuGroup = {
  id: string
  label?: string
  entries: MenuEntry[]
}

export type MenuModel = {
  /** a faint title line, e.g. the file name the menu is about */
  title?: string
  groups: MenuGroup[]
}

export const isRadio = (entry: MenuEntry): entry is MenuRadio => "options" in entry

/** group entries by their `group` key, first-seen order, dropping empty groups */
export function groupEntries(entries: MenuEntry[], labels: Record<string, string> = {}): MenuGroup[] {
  const map = new Map<string, MenuGroup>()
  for (const entry of entries) {
    const group = map.get(entry.group) ?? { id: entry.group, label: labels[entry.group], entries: [] }
    group.entries.push(entry)
    map.set(entry.group, group)
  }
  return [...map.values()].filter((group) => group.entries.length > 0)
}
