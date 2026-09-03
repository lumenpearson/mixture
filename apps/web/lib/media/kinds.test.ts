import { describe, expect, it } from "vitest"
import {
  contentTypeOf,
  decodeText,
  extensionOf,
  formatBytes,
  formatTime,
  guessEncoding,
  looksBinary,
  mediaKindOf,
} from "./kinds"

describe("mediaKindOf", () => {
  it("classifies by extension when the type is generic or missing", () => {
    expect(mediaKindOf("renders/lock.png")).toBe("image")
    expect(mediaKindOf("take-3.MOV", "application/octet-stream")).toBe("video")
    expect(mediaKindOf("notes.md")).toBe("markdown")
    expect(mediaKindOf("cloud.config.json")).toBe("code")
    expect(mediaKindOf("dailies.zip")).toBe("archive")
    expect(mediaKindOf("README")).toBe("other")
  })

  it("prefers a specific content type over the extension", () => {
    expect(mediaKindOf("file.bin", "image/webp")).toBe("image")
    expect(mediaKindOf("file.bin", "video/mp4; codecs=avc1")).toBe("video")
    expect(mediaKindOf("file.dat", "application/pdf")).toBe("pdf")
    expect(mediaKindOf("script.srt", "text/plain")).toBe("text")
  })
})

describe("extensionOf / contentTypeOf", () => {
  it("handles dotfiles and paths", () => {
    expect(extensionOf(".env")).toBe("")
    expect(extensionOf("a/b/c.tar.gz")).toBe("gz")
    expect(contentTypeOf("shot.webm")).toBe("video/webm")
    expect(contentTypeOf("unknown.xyz")).toBe("application/octet-stream")
  })
})

describe("text decoding", () => {
  it("decodes windows-1251 cyrillic", () => {
    // "привет" in windows-1251
    const bytes = new Uint8Array([0xef, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2])
    expect(decodeText(bytes, "windows-1251")).toBe("привет")
    expect(guessEncoding(bytes)).toBe("windows-1251")
  })

  it("detects utf-8 and byte-order marks", () => {
    const utf8 = new TextEncoder().encode("привет, мир")
    expect(guessEncoding(utf8)).toBe("utf-8")
    expect(guessEncoding(new Uint8Array([0xff, 0xfe, 0x41, 0x00]))).toBe("utf-16le")
    expect(guessEncoding(new Uint8Array([0xfe, 0xff, 0x00, 0x41]))).toBe("utf-16be")
  })

  it("spots binary content", () => {
    expect(looksBinary(new TextEncoder().encode("plain text\nwith lines"))).toBe(false)
    expect(looksBinary(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d]))).toBe(true)
  })
})

describe("formatters", () => {
  it("formats sizes and durations", () => {
    expect(formatBytes(512)).toBe("512 b")
    expect(formatBytes(4 * 1024 * 1024)).toBe("4 mb")
    expect(formatBytes(1536)).toBe("1.5 kb")
    expect(formatTime(65)).toBe("1:05")
    expect(formatTime(3725)).toBe("1:02:05")
    expect(formatTime(Number.NaN)).toBe("0:00")
  })
})
