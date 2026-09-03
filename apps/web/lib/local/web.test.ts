import { describe, expect, it } from "vitest"
import { LocalAccessError, type LocalPermission } from "./bridge"
import { WebLocalBridge, type DirHandle, type FileHandle } from "./web"

/* ------------------------------------------------------------------ *
 * the web bridge against an in-memory File System Access API
 *
 * Chromium is not available here, so these fakes implement exactly the
 * handle surface `web.ts` declares — including the two behaviours the bridge
 * depends on: `getFileHandle` throws for a directory, and `removeEntry`
 * refuses a non-empty folder without `recursive`.
 * ------------------------------------------------------------------ */

type Node = FakeFile | FakeDir

class FakeFile implements FileHandle {
  readonly kind = "file" as const
  constructor(
    readonly name: string,
    private data = "",
  ) {}
  async getFile(): Promise<File> {
    return new File([this.data], this.name, { lastModified: 1_700_000_000_000 })
  }
  async createWritable() {
    return {
      write: async (data: Uint8Array | Blob) => {
        this.data = data instanceof Uint8Array ? new TextDecoder().decode(data) : await data.text()
      },
      close: async () => {},
    }
  }
  text(): string {
    return this.data
  }
}

class FakeDir implements DirHandle {
  readonly kind = "directory" as const
  readonly children = new Map<string, Node>()
  constructor(
    readonly name: string,
    private granted: LocalPermission = "granted",
  ) {}

  async *values(): AsyncIterable<FileHandle | DirHandle> {
    for (const child of [...this.children.values()]) yield child
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandle> {
    const existing = this.children.get(name)
    if (existing?.kind === "directory") return existing
    if (existing) throw new Error("TypeMismatchError: not a directory")
    if (!options?.create) throw new Error("NotFoundError")
    const created = new FakeDir(name)
    this.children.set(name, created)
    return created
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle> {
    const existing = this.children.get(name)
    if (existing?.kind === "file") return existing
    if (existing) throw new Error("TypeMismatchError: not a file")
    if (!options?.create) throw new Error("NotFoundError")
    const created = new FakeFile(name)
    this.children.set(name, created)
    return created
  }

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    const existing = this.children.get(name)
    if (!existing) throw new Error("NotFoundError")
    if (existing.kind === "directory" && existing.children.size > 0 && !options?.recursive) {
      throw new Error("InvalidModificationError")
    }
    this.children.delete(name)
  }

  async queryPermission(): Promise<"granted" | "denied" | "prompt"> {
    return this.granted === "granted" ? "granted" : "prompt"
  }

  async requestPermission(): Promise<"granted" | "denied" | "prompt"> {
    return this.granted === "granted" ? "granted" : this.granted === "denied" ? "denied" : "prompt"
  }
}

/** walk down the fake tree by name, null when the path is not all folders */
function dirAt(root: FakeDir, names: string[]): FakeDir | null {
  let current = root
  for (const name of names) {
    const child = current.children.get(name)
    if (child?.kind !== "directory") return null
    current = child
  }
  return current
}

function fileAt(root: FakeDir, ...names: string[]): FakeFile | null {
  const name = names.pop() as string
  const parent = dirAt(root, names)
  const child = parent?.children.get(name)
  return child?.kind === "file" ? child : null
}

/** shots/ raw/ a.txt, shots/ raw/ deep/ b.txt, shots/ note.md, loose.txt */
function sampleRoot(): FakeDir {
  const root = new FakeDir("root")
  const shots = new FakeDir("shots")
  const raw = new FakeDir("raw")
  const deep = new FakeDir("deep")
  deep.children.set("b.txt", new FakeFile("b.txt", "bee"))
  raw.children.set("a.txt", new FakeFile("a.txt", "ay"))
  raw.children.set("deep", deep)
  shots.children.set("raw", raw)
  shots.children.set("note.md", new FakeFile("note.md", "hello"))
  root.children.set("shots", shots)
  root.children.set("loose.txt", new FakeFile("loose.txt", "loose"))
  return root
}

describe("moving a directory", () => {
  it("renames a folder with everything inside it and removes the original", async () => {
    const root = sampleRoot()
    const bridge = new WebLocalBridge(root)

    const moved = await bridge.move("shots", "takes")

    expect(moved).toMatchObject({ path: "takes", name: "takes", kind: "directory" })
    expect(root.children.has("shots")).toBe(false)
    expect(fileAt(root, "takes", "note.md")?.text()).toBe("hello")
    expect(fileAt(root, "takes", "raw", "a.txt")?.text()).toBe("ay")
    expect(fileAt(root, "takes", "raw", "deep", "b.txt")?.text()).toBe("bee")
  })

  it("moves a folder into another folder", async () => {
    const root = sampleRoot()
    const bridge = new WebLocalBridge(root)

    await bridge.move("shots/raw", "archive/raw")

    expect(dirAt(root, ["shots", "raw"])).toBeNull()
    expect(fileAt(root, "archive", "raw", "deep", "b.txt")?.text()).toBe("bee")
  })

  it("refuses to move a folder into its own subtree instead of recursing forever", async () => {
    const bridge = new WebLocalBridge(sampleRoot())
    await expect(bridge.move("shots", "shots/inner")).rejects.toMatchObject({ code: "move-into-self" })
  })

  it("answers not-found for a source that is not there", async () => {
    const bridge = new WebLocalBridge(sampleRoot())
    await expect(bridge.move("ghost", "other")).rejects.toMatchObject({ code: "not-found" })
  })

  it("still renames a plain file", async () => {
    const root = sampleRoot()
    const bridge = new WebLocalBridge(root)

    const moved = await bridge.move("loose.txt", "shots/kept.txt")

    expect(moved).toMatchObject({ path: "shots/kept.txt", kind: "file" })
    expect(root.children.has("loose.txt")).toBe(false)
    expect(fileAt(root, "shots", "kept.txt")?.text()).toBe("loose")
  })
})

describe("permission failures", () => {
  it("raises a code, not an english sentence, when no folder is granted", async () => {
    const bridge = new WebLocalBridge(null)
    await expect(bridge.scan()).rejects.toBeInstanceOf(LocalAccessError)
    await expect(bridge.scan()).rejects.toMatchObject({ code: "no-root" })
  })

  it("raises `denied` when the runtime refuses the folder", async () => {
    const bridge = new WebLocalBridge(new FakeDir("root", "denied"))
    await expect(bridge.list("")).rejects.toMatchObject({ code: "denied" })
  })

  it("re-grants the remembered handle instead of asking for a new folder", async () => {
    expect(await new WebLocalBridge(new FakeDir("root", "prompt")).regrant()).toBe("prompt")
    expect(await new WebLocalBridge(new FakeDir("root", "denied")).regrant()).toBe("denied")
    expect(await new WebLocalBridge(new FakeDir("root")).regrant()).toBe("granted")
    expect(await new WebLocalBridge(null).regrant()).toBe("prompt")
  })
})

describe("listing", () => {
  it("keeps a child whose name the bridge itself would refuse to open", async () => {
    const root = sampleRoot()
    root.children.set("c:stream.txt", new FakeFile("c:stream.txt", "odd"))
    const entries = await new WebLocalBridge(root).list("")

    expect(entries.map((entry) => entry.path)).toContain("c:stream.txt")
    // directories first, then by name
    expect(entries[0]?.kind).toBe("directory")
  })

  it("builds child paths under the folder being listed", async () => {
    const entries = await new WebLocalBridge(sampleRoot()).list("shots/raw")
    expect(entries.map((entry) => entry.path).sort()).toEqual(["shots/raw/a.txt", "shots/raw/deep"])
  })
})
