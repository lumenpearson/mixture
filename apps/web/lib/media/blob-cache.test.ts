import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createBlobCache, type BlobCacheEntry } from "./blob-cache"

/* URL.revokeObjectURL exists in the browser only; record the calls instead */
const revoked: string[] = []
const original = URL.revokeObjectURL

beforeEach(() => {
  revoked.length = 0
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url)
  }
})

afterEach(() => {
  URL.revokeObjectURL = original
})

const entry = (url: string, size = 10): BlobCacheEntry => ({ url, contentType: "video/mp4", name: url, size })

describe("blob cache", () => {
  it("serves a cached entry without a second url", () => {
    const cache = createBlobCache()
    const first = cache.put("a", entry("blob:a"))
    const again = cache.take("a")
    expect(again?.entry.url).toBe("blob:a")
    first.release()
    again?.release()
    expect(revoked).toEqual([])
    expect(cache.stats()).toEqual({ entries: 1, bytes: 10 })
  })

  it("revokes the loser when two loads race for the same key", () => {
    const cache = createBlobCache()
    const first = cache.put("a", entry("blob:first"))
    const second = cache.put("a", entry("blob:second"))
    // the second loader gets the url the first one is already showing
    expect(second.entry.url).toBe("blob:first")
    expect(revoked).toEqual(["blob:second"])
    expect(cache.stats().entries).toBe(1)
    first.release()
    second.release()
  })

  it("fills in bytes a later reader decoded for the same key", () => {
    const cache = createBlobCache()
    const media = cache.put("a", entry("blob:a"))
    expect(media.entry.bytes).toBeUndefined()
    const text = cache.put("a", { ...entry("blob:again"), bytes: new Uint8Array([1, 2]) })
    expect(text.entry.url).toBe("blob:a")
    expect(cache.take("a")?.entry.bytes).toEqual(new Uint8Array([1, 2]))
  })

  it("defers the revoke of an evicted entry until its lease ends", () => {
    const cache = createBlobCache({ maxEntries: 2 })
    const held = cache.put("a", entry("blob:a"))
    cache.put("b", entry("blob:b")).release()
    cache.put("c", entry("blob:c")).release()
    // "a" left the cache but a component still shows it
    expect(cache.stats().entries).toBe(2)
    expect(revoked).toEqual([])
    held.release()
    expect(revoked).toEqual(["blob:a"])
  })

  it("releases only once however often release is called", () => {
    const cache = createBlobCache({ maxEntries: 1 })
    const held = cache.put("a", entry("blob:a"))
    cache.put("b", entry("blob:b")).release()
    held.release()
    held.release()
    expect(revoked).toEqual(["blob:a"])
  })

  it("evicts by total bytes, not only by entry count", () => {
    const cache = createBlobCache({ maxEntries: 100, maxBytes: 25 })
    cache.put("a", entry("blob:a", 10)).release()
    cache.put("b", entry("blob:b", 10)).release()
    cache.put("c", entry("blob:c", 10)).release()
    expect(cache.stats()).toEqual({ entries: 2, bytes: 20 })
    expect(revoked).toEqual(["blob:a"])
  })

  it("keeps the newest use and drops the oldest", () => {
    const cache = createBlobCache({ maxEntries: 2 })
    cache.put("a", entry("blob:a")).release()
    cache.put("b", entry("blob:b")).release()
    cache.take("a")?.release()
    cache.put("c", entry("blob:c")).release()
    expect(revoked).toEqual(["blob:b"])
    expect(cache.take("a")?.entry.url).toBe("blob:a")
  })

  it("never evicts the only entry, however large", () => {
    const cache = createBlobCache({ maxEntries: 4, maxBytes: 1 })
    const handle = cache.put("a", entry("blob:a", 4_000_000))
    expect(cache.stats().entries).toBe(1)
    expect(revoked).toEqual([])
    handle.release()
  })
})
