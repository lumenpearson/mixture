import { describe, expect, it } from "vitest"
import { groupEntries, isRadio, type MenuAction, type MenuRadio } from "./model"

const action = (id: string, group: string): MenuAction => ({ id, label: id, group, run: () => undefined })

describe("groupEntries", () => {
  it("keeps first-seen group order and attaches labels", () => {
    const radio: MenuRadio = { id: "view", label: "view", group: "view", value: "a", options: [], onChange: () => undefined }
    const groups = groupEntries([action("open", "open"), radio, action("copy", "open"), action("delete", "danger")], { danger: "danger zone" })
    expect(groups.map((group) => group.id)).toEqual(["open", "view", "danger"])
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["open", "copy"])
    expect(groups[2].label).toBe("danger zone")
    expect(isRadio(radio)).toBe(true)
    expect(isRadio(action("x", "y"))).toBe(false)
  })

  it("returns nothing for no entries", () => {
    expect(groupEntries([])).toEqual([])
  })
})
