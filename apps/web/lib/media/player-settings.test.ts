import { describe, expect, it } from "vitest"
import { DEFAULT_PLAYER_SETTINGS, normalizePlayerSettings } from "./player-settings"

describe("normalizePlayerSettings", () => {
  it("returns defaults for garbage", () => {
    expect(normalizePlayerSettings(null)).toEqual(DEFAULT_PLAYER_SETTINGS)
    expect(normalizePlayerSettings("nope")).toEqual(DEFAULT_PLAYER_SETTINGS)
  })

  it("keeps valid fields and repairs invalid ones", () => {
    const out = normalizePlayerSettings({
      autoplay: true,
      volume: 250,
      playbackRate: 3,
      preload: "everything",
      streaming: "inline",
      bufferAhead: -4,
      encoding: "koi8-r",
      imageFit: "stretch",
    })
    expect(out.autoplay).toBe(true)
    expect(out.volume).toBe(100)
    expect(out.playbackRate).toBe(1)
    expect(out.preload).toBe("metadata")
    expect(out.streaming).toBe("inline")
    expect(out.bufferAhead).toBe(0)
    expect(out.encoding).toBe("koi8-r")
    expect(out.imageFit).toBe("contain")
  })

  it("rejects unknown encodings", () => {
    expect(normalizePlayerSettings({ encoding: "ebcdic" }).encoding).toBe("auto")
  })
})
