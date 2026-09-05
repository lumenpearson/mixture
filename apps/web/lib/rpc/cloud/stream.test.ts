import { describe, expect, it } from "vitest"
import {
  STREAM_ROUTE,
  buildStreamUrl,
  inlineDisposition,
  parseByteRange,
  parseStreamParams,
  parseStreamUrl,
  safeStreamContentType,
  signTicket,
  streamSecret,
  timingSafeCompare,
  verifyStreamTicket,
} from "./stream"

const SECRET = "test-secret-value"
const NOW = 1_700_000_000_000
const ticket = { path: "renders/ep01/scene.mp4", expires: NOW + 60_000, sha: "a".repeat(40) }

const paramsOf = (url: string) => new URL(url, "http://cloud.invalid").searchParams

describe("streamSecret", () => {
  it("prefers the explicit secret over the repository token", () => {
    const secret = streamSecret({ MIXTURE_STREAM_SECRET: " s3cret ", MIXTURE_CLOUD_GITHUB_TOKEN: "ghp_x" })
    expect(secret).toBe("s3cret")
  })

  it("derives a key from the repository token, never the token itself", () => {
    const secret = streamSecret({ MIXTURE_CLOUD_GITHUB_TOKEN: "ghp_x" })
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(secret).not.toContain("ghp_x")
    // stable across calls, otherwise every deploy would invalidate live tickets
    expect(streamSecret({ MIXTURE_CLOUD_GITHUB_TOKEN: "ghp_x" })).toBe(secret)
    expect(streamSecret({ MIXTURE_CLOUD_GITHUB_TOKEN: "ghp_y" })).not.toBe(secret)
  })

  it("has nothing to sign with when neither variable is set", () => {
    expect(streamSecret({})).toBeNull()
    expect(streamSecret({ MIXTURE_STREAM_SECRET: "   " })).toBeNull()
  })
})

describe("stream tickets", () => {
  it("round-trips a valid ticket through the url", () => {
    const url = buildStreamUrl(ticket, SECRET)
    expect(url.startsWith(`${STREAM_ROUTE}?`)).toBe(true)
    const parsed = parseStreamUrl(url)
    expect(parsed?.path).toBe(ticket.path)
    expect(parsed?.expires).toBe(ticket.expires)
    const verdict = verifyStreamTicket(parsed, SECRET, NOW)
    expect(verdict.ok).toBe(true)
    expect(verdict.ok && verdict.ticket.path).toBe(ticket.path)
  })

  it("keeps credentials and the secret out of the url", () => {
    const url = buildStreamUrl(ticket, SECRET)
    expect(url).not.toContain(SECRET)
    expect(url.toLowerCase()).not.toContain("token")
    expect(url.toLowerCase()).not.toContain("authorization")
  })

  it("encodes paths with spaces and non-latin names", () => {
    const odd = { ...ticket, path: "кадры/эп 01/сцена+1.mp4" }
    const url = buildStreamUrl(odd, SECRET)
    expect(url).not.toContain(" ")
    const parsed = parseStreamUrl(url)
    expect(parsed?.path).toBe(odd.path)
    expect(verifyStreamTicket(parsed, SECRET, NOW).ok).toBe(true)
  })

  it("refuses a tampered path", () => {
    const url = buildStreamUrl(ticket, SECRET)
    const params = paramsOf(url)
    params.set("p", "private/secrets.mp4")
    const verdict = verifyStreamTicket(parseStreamParams(params), SECRET, NOW)
    expect(verdict).toEqual({ ok: false, reason: "signature" })
  })

  it("refuses a tampered expiry or sha", () => {
    const params = paramsOf(buildStreamUrl(ticket, SECRET))
    params.set("e", String(NOW + 10 * 365 * 24 * 3_600_000))
    expect(verifyStreamTicket(parseStreamParams(params), SECRET, NOW)).toEqual({ ok: false, reason: "signature" })

    const other = paramsOf(buildStreamUrl(ticket, SECRET))
    other.set("v", "b".repeat(40))
    expect(verifyStreamTicket(parseStreamParams(other), SECRET, NOW)).toEqual({ ok: false, reason: "signature" })
  })

  it("refuses a ticket signed with another secret", () => {
    const parsed = parseStreamUrl(buildStreamUrl(ticket, "another-secret"))
    expect(verifyStreamTicket(parsed, SECRET, NOW)).toEqual({ ok: false, reason: "signature" })
  })

  it("refuses an expired ticket even though the signature is genuine", () => {
    const stale = { ...ticket, expires: NOW - 1 }
    const parsed = parseStreamUrl(buildStreamUrl(stale, SECRET))
    expect(signTicket(stale, SECRET)).toBe(parsed?.signature)
    expect(verifyStreamTicket(parsed, SECRET, NOW)).toEqual({ ok: false, reason: "expired" })
  })

  it("refuses a missing or malformed ticket", () => {
    expect(verifyStreamTicket(null, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" })
    expect(parseStreamUrl("/api/cloud/other?p=a.mp4&e=1&v=x&s=ff")).toBeNull()
    expect(parseStreamUrl("not a url at all")).toBeNull()
  })

  it("rejects traversal, .git, control characters and oversized paths", () => {
    const bad = ["../etc/passwd", "a/../../b.mp4", ".git/config", "a/\u0007bell.mp4", "/leading.mp4", "x".repeat(513)]
    for (const path of bad) {
      const params = paramsOf(buildStreamUrl({ ...ticket, path }, SECRET))
      expect(parseStreamParams(params)).toBeNull()
    }
  })

  it("rejects a signature that is not hex", () => {
    const params = paramsOf(buildStreamUrl(ticket, SECRET))
    params.set("s", "not-a-signature")
    expect(parseStreamParams(params)).toBeNull()
  })
})

describe("timingSafeCompare", () => {
  it("compares equal digests in constant time and rejects the rest", () => {
    const digest = signTicket(ticket, SECRET)
    expect(timingSafeCompare(digest, digest)).toBe(true)
    // one flipped character: same length, so the compare stays constant-time
    expect(timingSafeCompare(digest, `${digest.slice(0, -1)}${digest.endsWith("0") ? "1" : "0"}`)).toBe(false)
    // different lengths cannot go through timingSafeEqual, and must not throw
    expect(timingSafeCompare(digest, digest.slice(0, 10))).toBe(false)
    expect(timingSafeCompare("", "")).toBe(false)
  })
})

describe("parseByteRange", () => {
  it("reads the common shapes against a known size", () => {
    expect(parseByteRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 })
    expect(parseByteRange("bytes=100-", 1000)).toEqual({ start: 100, end: 999 })
    expect(parseByteRange("bytes=-200", 1000)).toEqual({ start: 800, end: 999 })
    expect(parseByteRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 })
    expect(parseByteRange(" bytes=0-0 ", 1000)).toEqual({ start: 0, end: 0 })
  })

  it("asks for the whole file when there is no usable range", () => {
    expect(parseByteRange(null, 1000)).toBeNull()
    expect(parseByteRange("bytes=0-10, 20-30", 1000)).toBeNull()
    expect(parseByteRange("items=0-10", 1000)).toBeNull()
    expect(parseByteRange("bytes=-", 1000)).toBeNull()
    expect(parseByteRange("bytes=0-99", 0)).toBeNull()
  })

  it("reports a window that starts past the end as unsatisfiable", () => {
    expect(parseByteRange("bytes=1000-", 1000)).toBe("unsatisfiable")
    expect(parseByteRange("bytes=500-400", 1000)).toBe("unsatisfiable")
  })
})

describe("response shaping", () => {
  it("hands back media types as they are", () => {
    expect(safeStreamContentType("video/mp4")).toBe("video/mp4")
    expect(safeStreamContentType("audio/mpeg; charset=binary")).toBe("audio/mpeg")
    expect(safeStreamContentType("")).toBe("application/octet-stream")
  })

  it("never serves a type the browser would execute in our origin", () => {
    expect(safeStreamContentType("text/html")).toBe("application/octet-stream")
    expect(safeStreamContentType("IMAGE/SVG+XML")).toBe("application/octet-stream")
    expect(safeStreamContentType("application/javascript")).toBe("application/octet-stream")
  })

  it("quotes the file name safely in the disposition header", () => {
    expect(inlineDisposition("scene.mp4")).toContain('filename="scene.mp4"')
    expect(inlineDisposition('we"ird\\.mp4')).not.toContain('we"ird')
    expect(inlineDisposition("сцена.mp4")).toContain("filename*=UTF-8''%D1%81")
  })
})
