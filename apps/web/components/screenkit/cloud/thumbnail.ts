"use client"

import { categoryFor } from "@/lib/cloud/file-types"
import type { Entry } from "@mixture/protocol/cloud"
import * as React from "react"
import type { CloudProvider } from "./provider"

/* ------------------------------------------------------------------ *
 * lazy image thumbnails
 *
 * A folder of 2 000 renders must not fetch 2 000 images: a tile only asks for
 * its bytes once it comes near the viewport. When GitHub hands out a direct
 * download url the browser streams from it and no object url exists at all;
 * otherwise the bytes come through the provider and the object url created
 * for them is revoked when the tile unmounts or the entry changes.
 * ------------------------------------------------------------------ */

const THUMBNAIL_BYTE_LIMIT = 2 * 1024 * 1024

export function useThumbnail(entry: Entry, provider: CloudProvider, enabled: boolean) {
  const [element, setElement] = React.useState<HTMLElement | null>(null)
  const [visible, setVisible] = React.useState(false)
  const [url, setUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!enabled || visible || !element) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((record) => record.isIntersecting)) setVisible(true)
      },
      { rootMargin: "300px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, enabled, visible])

  React.useEffect(() => {
    setUrl(null)
    if (!enabled || !visible) return
    if (categoryFor(entry.name, entry.contentType) !== "image") return
    if (entry.downloadUrl) {
      setUrl(entry.downloadUrl)
      return
    }
    if (Number(entry.size) > THUMBNAIL_BYTE_LIMIT) return

    let objectUrl: string | null = null
    let cancelled = false
    const controller = new AbortController()
    provider
      .read(entry.path, { signal: controller.signal })
      .then((result) => {
        if (cancelled || result.truncated || !result.content.byteLength) return
        objectUrl = URL.createObjectURL(new Blob([result.content as BlobPart], { type: entry.contentType }))
        setUrl(objectUrl)
      })
      .catch(() => {
        // a thumbnail that will not load is not worth a toast
      })
    return () => {
      cancelled = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [enabled, visible, entry, provider])

  return { ref: setElement, url }
}
