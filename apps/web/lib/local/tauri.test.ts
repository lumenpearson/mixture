import { beforeEach, describe, expect, it, vi } from "vitest"

const { invoke, convertFileSrc } = vi.hoisted(() => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `http://asset.localhost/${encodeURIComponent(path)}`),
}))

vi.mock("@tauri-apps/api/core", () => ({ invoke, convertFileSrc }))

import { TAURI_COMMANDS } from "./bridge"
import { localBridge } from "./index"
import { createTauriBridge } from "./tauri"

describe("tauri local bridge", () => {
  beforeEach(() => {
    invoke.mockReset()
    convertFileSrc.mockClear()
  })

  it("maps entries and strips size and type from directories", async () => {
    invoke.mockResolvedValue([
      { path: "renders", name: "renders", kind: "directory", size: 4096, modifiedAt: 17, contentType: "x/y" },
      { path: "renders/a.png", name: "a.png", kind: "file", size: 12, modifiedAt: 42, contentType: "image/png" },
      { path: "renders/b.mov", name: "b.mov", kind: "file", size: 3, modifiedAt: 0, contentType: "" },
    ])
    const entries = await createTauriBridge().list("renders")
    expect(invoke).toHaveBeenCalledWith(TAURI_COMMANDS.list, { path: "renders" })
    expect(entries[0]).toEqual({ path: "renders", name: "renders", kind: "directory", size: 0, modifiedAt: 0, contentType: "" })
    expect(entries[1].size).toBe(12)
    // an empty content type falls back to the extension table, like the web bridge
    expect(entries[2].contentType).toBe("video/quicktime")
  })

  it("reads bytes from a raw ipc body and from a number array", async () => {
    const bridge = createTauriBridge()
    invoke.mockResolvedValueOnce(new Uint8Array([1, 2, 3]).buffer)
    expect(Array.from(await bridge.read("a.bin"))).toEqual([1, 2, 3])
    invoke.mockResolvedValueOnce([4, 5])
    expect(Array.from(await bridge.read("a.bin", { maxBytes: 2 }))).toEqual([4, 5])
    expect(invoke).toHaveBeenLastCalledWith(TAURI_COMMANDS.read, { path: "a.bin", maxBytes: 2 })
  })

  it("sends written bytes as a plain array the ipc can serialise", async () => {
    invoke.mockResolvedValue({ path: "a.bin", name: "a.bin", kind: "file", size: 2, modifiedAt: 1, contentType: "" })
    await createTauriBridge().write("a.bin", new Uint8Array([7, 8]))
    expect(invoke).toHaveBeenCalledWith(TAURI_COMMANDS.write, { path: "a.bin", content: [7, 8] })
  })

  it("streams through convertFileSrc and answers null when the shell has no file", async () => {
    const bridge = createTauriBridge()
    invoke.mockResolvedValueOnce("C:/shoot/a.png")
    expect(await bridge.streamUrl("a.png")).toBe("http://asset.localhost/C%3A%2Fshoot%2Fa.png")
    invoke.mockResolvedValueOnce(null)
    expect(await bridge.streamUrl("gone.png")).toBeNull()
    expect(convertFileSrc).toHaveBeenCalledTimes(1)
  })

  it("fills a scan with defaults when the shell omits fields", async () => {
    invoke.mockResolvedValue({ root: "shoot", files: 2, byExtension: { png: 2 } })
    const scan = await createTauriBridge().scan({ maxEntries: 10 })
    expect(invoke).toHaveBeenCalledWith(TAURI_COMMANDS.scan, { maxEntries: 10 })
    expect(scan).toEqual({ root: "shoot", files: 2, directories: 0, bytes: 0, byExtension: { png: 2 }, truncated: false })
  })

  it("reports unsupported outside the shell instead of invoking", async () => {
    expect(await createTauriBridge().permission()).toBe("unsupported")
    expect(invoke).not.toHaveBeenCalled()
  })

  it("selects the browser bridge when the page is not in tauri", () => {
    // the web build must be unaffected by @tauri-apps/api being installed
    expect(localBridge().runtime).toBe("web")
  })
})
