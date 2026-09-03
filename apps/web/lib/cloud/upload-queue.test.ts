import { describe, expect, it } from "vitest"
import {
  DIRECT_UPLOAD_LIMIT,
  UPLOAD_LIMIT_RPC,
  buildUploadItems,
  nextPending,
  patchItem,
  queueIsFinished,
  resolveConflict,
  summarize,
  uploadRoute,
  type UploadCandidate,
} from "./upload-queue"

const candidate = (name: string, size = 10, relativePath = name): UploadCandidate => ({
  file: new File([new Uint8Array(size)], name.split("/").pop() ?? name),
  relativePath,
})

const build = (candidates: UploadCandidate[], patch: Partial<Parameters<typeof buildUploadItems>[1]> = {}) =>
  buildUploadItems(candidates, { basePath: "", existing: [], canUploadDirectly: false, ...patch })

describe("uploadRoute", () => {
  it("keeps small files on the rpc route", () => {
    expect(uploadRoute(1024, false)).toBe("rpc")
    expect(uploadRoute(UPLOAD_LIMIT_RPC, false)).toBe("rpc")
  })

  // the negative half: without the caller's own github token the vercel body
  // cap is the hard ceiling, and the ui must be able to say so
  it("refuses a large file when the caller has no github token", () => {
    expect(uploadRoute(UPLOAD_LIMIT_RPC + 1, false)).toBe("too-large")
  })

  it("sends a large file straight to github when the caller has a token", () => {
    expect(uploadRoute(UPLOAD_LIMIT_RPC + 1, true)).toBe("direct")
    expect(uploadRoute(DIRECT_UPLOAD_LIMIT, true)).toBe("direct")
    expect(uploadRoute(DIRECT_UPLOAD_LIMIT + 1, true)).toBe("too-large")
  })
})

describe("buildUploadItems", () => {
  it("resolves paths under the current folder and keeps folder structure", () => {
    const { items } = build([candidate("shots/a.png", 10, "shots/a.png")], { basePath: "renders" })
    expect(items[0]?.path).toBe("renders/shots/a.png")
    expect(items[0]?.name).toBe("a.png")
    expect(items[0]?.status).toBe("pending")
  })

  it("marks an item that would overwrite an existing file as a conflict", () => {
    const { items } = build([candidate("a.png")], { existing: [{ path: "a.png", sha: "abc" }] })
    expect(items[0]?.status).toBe("conflict")
    expect(items[0]?.sha).toBe("abc")
  })

  // same rule as the server: a path the service would refuse never gets queued
  it("rejects traversal and the config file instead of queueing them", () => {
    const { items, rejected } = build([candidate("../evil.png", 10, "../evil.png"), candidate("cloud.config.json")])
    expect(items).toHaveLength(0)
    expect(rejected.map((r) => r.reason)).toEqual(["forbidden-segment", "config-file"])
  })

  it("gives every item a distinct id even for identical names", () => {
    const { items } = build([candidate("a.png"), candidate("a.png")])
    expect(items[0]?.id).not.toBe(items[1]?.id)
  })
})

describe("resolveConflict", () => {
  const conflicted = () => build([candidate("a.png")], { existing: [{ path: "a.png", sha: "abc" }] }).items

  it("overwrite keeps the path and the sha so the commit replaces the blob", () => {
    const items = conflicted()
    const next = resolveConflict(items, items[0]!.id, "overwrite", ["a.png"])
    expect(next[0]?.status).toBe("pending")
    expect(next[0]?.sha).toBe("abc")
    expect(next[0]?.path).toBe("a.png")
  })

  it("keep-both renames and drops the sha so nothing is replaced", () => {
    const items = conflicted()
    const next = resolveConflict(items, items[0]!.id, "keep-both", ["a.png"])
    expect(next[0]?.path).toBe("a (copy).png")
    expect(next[0]?.sha).toBe("")
    expect(next[0]?.status).toBe("pending")
  })

  it("skip takes the item out of the run", () => {
    const items = conflicted()
    const next = resolveConflict(items, items[0]!.id, "skip", ["a.png"])
    expect(next[0]?.status).toBe("skipped")
    expect(nextPending(next)).toBeNull()
  })
})

describe("the runner view of the queue", () => {
  it("never hands the runner an item it cannot send", () => {
    const { items } = build([candidate("big.png", 0)])
    const oversized = patchItem(items, items[0]!.id, { route: "too-large" })
    expect(nextPending(oversized)).toBeNull()
  })

  it("summarises bytes moved across done, active and failed items", () => {
    const { items } = build([candidate("a.png", 100), candidate("b.png", 100)])
    let queue = patchItem(items, items[0]!.id, { status: "done", progress: 1 })
    queue = patchItem(queue, items[1]!.id, { status: "uploading", progress: 0.5 })
    const summary = summarize(queue)
    expect(summary.total).toBe(2)
    expect(summary.done).toBe(1)
    expect(summary.active).toBe(true)
    expect(summary.progress).toBeCloseTo(0.75, 5)
  })

  it("counts an error and reports the queue as unfinished until it is dealt with", () => {
    const { items } = build([candidate("a.png", 10)])
    const failed = patchItem(items, items[0]!.id, { status: "error", error: "github 403" })
    expect(summarize(failed).failed).toBe(1)
    expect(queueIsFinished(failed)).toBe(false)
    expect(queueIsFinished(patchItem(failed, items[0]!.id, { status: "done" }))).toBe(true)
  })

  it("has nothing to report for an empty queue", () => {
    expect(summarize([]).progress).toBe(0)
    expect(queueIsFinished([])).toBe(false)
  })
})
