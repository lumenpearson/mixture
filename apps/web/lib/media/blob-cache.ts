/* ------------------------------------------------------------------ *
 * blob cache
 *
 * Bytes read through the cloud rpc become an object url, and switching back
 * to a file must not download it twice. Two rules make that safe:
 *
 *  - a url is revoked only when nothing holds it. Every consumer takes a
 *    lease and releases it when it unmounts; eviction drops the entry from
 *    the map at once but defers the revoke until the last lease is gone, so
 *    an <img> on screen never goes blank because a 25th file was opened.
 *  - the cache is bounded by total bytes as well as by entry count, because
 *    24 clips of the 4 MiB rpc limit is not a cache, it is a leak.
 *
 * There is no invalidation and none is needed: the caller's key carries the
 * blob sha (the local provider uses the modification time), so a file that
 * changed is a different key and the old entry simply ages out.
 *
 * No React and no DOM beyond URL.revokeObjectURL, so the rules are testable.
 * ------------------------------------------------------------------ */

export type BlobCacheEntry = {
  url: string
  /** the decoded bytes, kept only for consumers that asked for them (text) */
  bytes?: Uint8Array
  contentType: string
  name: string
  size: number
}

/** a cached entry plus the lease that keeps its url alive */
export type BlobCacheHandle = {
  entry: BlobCacheEntry
  release: () => void
}

export type BlobCacheOptions = {
  maxEntries?: number
  maxBytes?: number
}

type Slot = {
  entry: BlobCacheEntry
  /** how many consumers currently hold this entry */
  leases: number
  /** evicted from the map; revoke as soon as the last lease is released */
  dropped: boolean
  revoked: boolean
}

const DEFAULT_MAX_ENTRIES = 24
/** the rpc reads at most 4 MiB per file, so this is about sixteen of them */
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024

export type BlobCache = {
  /** an entry with a lease taken, or undefined when the key is not cached */
  take: (key: string) => BlobCacheHandle | undefined
  /**
   * cache an entry and lease it. When an equal key is already cached (two
   * components loaded the same file at once) the newcomer's url is revoked
   * and the handle points at the entry consumers may already be showing.
   */
  put: (key: string, entry: BlobCacheEntry) => BlobCacheHandle
  /** for tests and diagnostics */
  stats: () => { entries: number; bytes: number }
}

export function createBlobCache(options?: BlobCacheOptions): BlobCache {
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES
  const slots = new Map<string, Slot>()
  let bytes = 0

  const revoke = (slot: Slot) => {
    if (slot.revoked || slot.leases > 0) return
    slot.revoked = true
    URL.revokeObjectURL(slot.entry.url)
  }

  const lease = (slot: Slot): BlobCacheHandle => {
    slot.leases += 1
    let released = false
    return {
      entry: slot.entry,
      release: () => {
        if (released) return
        released = true
        slot.leases -= 1
        if (slot.dropped) revoke(slot)
      },
    }
  }

  const drop = (key: string, slot: Slot) => {
    slots.delete(key)
    bytes -= slot.entry.size
    slot.dropped = true
    revoke(slot)
  }

  const trim = () => {
    // Map iterates in insertion order, so the first key is the oldest use
    while (slots.size > 1 && (slots.size > maxEntries || bytes > maxBytes)) {
      const oldest = slots.keys().next().value
      if (oldest === undefined) return
      const slot = slots.get(oldest)
      if (!slot) return
      drop(oldest, slot)
    }
  }

  return {
    take(key) {
      const slot = slots.get(key)
      if (!slot) return undefined
      // refresh recency: the newest use goes to the end of the map
      slots.delete(key)
      slots.set(key, slot)
      return lease(slot)
    },
    put(key, entry) {
      const existing = slots.get(key)
      if (existing) {
        if (existing.entry.url !== entry.url) URL.revokeObjectURL(entry.url)
        // the bytes of the same file are the same bytes: a text preview that
        // arrives after a media element may fill in what it decoded
        if (!existing.entry.bytes && entry.bytes) existing.entry.bytes = entry.bytes
        slots.delete(key)
        slots.set(key, existing)
        return lease(existing)
      }
      const slot: Slot = { entry, leases: 0, dropped: false, revoked: false }
      slots.set(key, slot)
      bytes += entry.size
      const handle = lease(slot)
      trim()
      return handle
    },
    stats: () => ({ entries: slots.size, bytes }),
  }
}

/** the cache the media loader uses */
export const mediaBlobCache = createBlobCache()
