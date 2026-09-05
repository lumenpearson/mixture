import { describe, expect, it } from "vitest"
import {
  INSERT_KINDS,
  MAX_SOURCE_URL_LENGTH,
  MAX_SOURCE_ZOOM,
  checkSourcePath,
  checkSourceUrl,
  defaultSource,
  hasSource,
  insertKindOf,
  isFileInsert,
  isSiteInsert,
  normalizeSource,
  parseInsertKind,
  parseInsertSource,
  validateSource,
} from "./insert-kinds"

const fail = (check: ReturnType<typeof validateSource>) => {
  if (check.ok) throw new Error("expected the source to be refused")
  return check
}

describe("kind metadata and guards", () => {
  it("describes every kind exactly once", () => {
    expect(INSERT_KINDS.map((kind) => kind.id)).toEqual(["scene", "site", "file"])
    expect(INSERT_KINDS.every((kind) => kind.icon.length > 0)).toBe(true)
  })

  it("treats an insert without a kind as a scene", () => {
    expect(insertKindOf({ kind: undefined })).toBe("scene")
    expect(isSiteInsert({ kind: undefined })).toBe(false)
    expect(isSiteInsert({ kind: "site" })).toBe(true)
    expect(isFileInsert({ kind: "file" })).toBe(true)
    expect(isFileInsert({ kind: "site" })).toBe(false)
  })

  it("starts a site still and a file playing", () => {
    expect(defaultSource("scene")).toEqual({})
    expect(defaultSource("site")).toEqual({ fit: "contain", zoom: 1, scroll: false })
    expect(defaultSource("file")).toEqual({ fit: "contain", autoplay: true, loop: true, muted: true })
    // a fresh copy every time: the caller edits it
    expect(defaultSource("site")).not.toBe(defaultSource("site"))
  })
})

describe("source urls", () => {
  it("accepts https and loopback http", () => {
    expect(checkSourceUrl("https://example.com/dashboard?x=1#top").ok).toBe(true)
    expect(checkSourceUrl("http://localhost:3000/preview").ok).toBe(true)
    expect(checkSourceUrl("http://127.0.0.1:8080/").ok).toBe(true)
  })

  it("refuses everything that is not an https url", () => {
    expect(fail(checkSourceUrl("javascript:alert(1)")).field).toBe("source.url")
    expect(fail(checkSourceUrl("data:text/html,<h1>hi</h1>")).message).toBe("must be an https url")
    expect(fail(checkSourceUrl("http://example.com")).message).toBe("must be an https url")
    expect(fail(checkSourceUrl("file:///etc/passwd")).message).toBe("must be an https url")
    // a bare host is not a url; the client normalizes before sending
    expect(fail(checkSourceUrl("example.com")).message).toBe("must be a valid url")
    expect(fail(checkSourceUrl("   ")).message).toBe("an https url is required")
  })

  it("caps the length", () => {
    const long = `https://example.com/${"a".repeat(MAX_SOURCE_URL_LENGTH)}`
    expect(fail(checkSourceUrl(long)).message).toContain("2000")
  })
})

describe("source paths", () => {
  it("cleans a cloud path the way the cloud service does", () => {
    expect(checkSourcePath("/public//clips/./hall.mp4").ok).toBe(true)
    expect(normalizeSource("file", { path: "/public//clips/./hall.mp4" }).path).toBe("public/clips/hall.mp4")
  })

  it("refuses traversal, .git and control characters", () => {
    expect(fail(checkSourcePath("../../etc/passwd")).message).toBe("forbidden path segment")
    expect(fail(checkSourcePath("public/../../secrets.txt")).message).toBe("forbidden path segment")
    expect(fail(checkSourcePath(".git/config")).message).toBe("forbidden path segment")
    // the cloud service lower-cases each segment before this comparison
    expect(fail(checkSourcePath(".GIT/config")).message).toBe("forbidden path segment")
    expect(fail(checkSourcePath("clips/ha\u0000ll.mp4")).message).toBe("forbidden path segment")
    expect(fail(checkSourcePath("a".repeat(600))).message).toBe("path is too long")
    expect(fail(checkSourcePath("/")).message).toBe("a cloud path is required")
  })
})

describe("validateSource", () => {
  it("accepts a site with an https url", () => {
    expect(validateSource("site", { url: "https://example.com", fit: "contain", zoom: 2 })).toEqual({ ok: true })
  })

  it("accepts a file from the drive or from an https url", () => {
    expect(validateSource("file", { path: "public/clips/hall.mp4" })).toEqual({ ok: true })
    expect(validateSource("file", { url: "https://cdn.example.com/hall.mp4" })).toEqual({ ok: true })
  })

  it("refuses a site without a usable url", () => {
    expect(fail(validateSource("site", {})).field).toBe("source.url")
    expect(fail(validateSource("site", { url: "javascript:alert(1)" })).field).toBe("source.url")
    expect(fail(validateSource("site", undefined)).field).toBe("source.url")
  })

  it("refuses a file with neither a path nor a url", () => {
    const problem = fail(validateSource("file", { fit: "cover" }))
    expect(problem.field).toBe("source.path")
    expect(problem.message).toBe("a cloud path or an https url is required")
  })

  it("refuses a source on a scene insert", () => {
    expect(fail(validateSource("scene", { url: "https://example.com" })).field).toBe("source")
    expect(validateSource("scene", {})).toEqual({ ok: true })
    expect(validateSource("scene", undefined)).toEqual({ ok: true })
    expect(validateSource("scene", { url: "" })).toEqual({ ok: true })
  })

  it("bounds zoom and fit", () => {
    expect(fail(validateSource("site", { url: "https://example.com", zoom: 0.1 })).field).toBe("source.zoom")
    expect(fail(validateSource("site", { url: "https://example.com", zoom: 9 })).field).toBe("source.zoom")
    expect(fail(validateSource("site", { url: "https://example.com", zoom: Number.NaN })).message).toBe(
      "must be a number",
    )
    expect(validateSource("site", { url: "https://example.com", zoom: 0.25 })).toEqual({ ok: true })
    // the ceiling is the one the renderer clamps to and both sliders stop at
    expect(validateSource("site", { url: "https://example.com", zoom: MAX_SOURCE_ZOOM })).toEqual({ ok: true })
    expect(fail(validateSource("site", { url: "https://example.com", zoom: MAX_SOURCE_ZOOM + 1 })).field).toBe(
      "source.zoom",
    )
    const fit = { url: "https://example.com", fit: "fill" } as unknown as Parameters<typeof validateSource>[1]
    expect(fail(validateSource("site", fit)).field).toBe("source.fit")
  })

  it("refuses a background that is not a colour", () => {
    expect(validateSource("site", { url: "https://example.com", background: "#0b0f17" })).toEqual({ ok: true })
    expect(validateSource("site", { url: "https://example.com", background: "var(--accent-blue)" })).toEqual({
      ok: true,
    })
    expect(validateSource("site", { url: "https://example.com", background: "rgba(0,0,0,0.5)" })).toEqual({
      ok: true,
    })
    const problem = fail(validateSource("site", { url: "https://example.com", background: "url(javascript:1)" }))
    expect(problem.field).toBe("source.background")
    expect(fail(validateSource("site", { url: "https://example.com", background: "red; position:fixed" })).field).toBe(
      "source.background",
    )
  })
})

describe("normalizeSource", () => {
  it("keeps only what the kind uses", () => {
    const raw = {
      url: "  https://example.com  ",
      path: "public/a.png",
      fit: "cover" as const,
      zoom: 1.25,
      scroll: true,
      autoplay: false,
      loop: true,
      muted: false,
      background: " #000000 ",
    }
    expect(normalizeSource("site", raw)).toEqual({
      url: "https://example.com",
      fit: "cover",
      zoom: 1.25,
      scroll: true,
      background: "#000000",
    })
    expect(normalizeSource("file", raw)).toEqual({
      url: "https://example.com",
      path: "public/a.png",
      fit: "cover",
      zoom: 1.25,
      autoplay: false,
      loop: true,
      muted: false,
      background: "#000000",
    })
    expect(normalizeSource("scene", raw)).toEqual({})
  })

  it("drops empty strings so a blank field is not stored", () => {
    expect(normalizeSource("site", { url: "   ", background: "" })).toEqual({})
    expect(normalizeSource("file", undefined)).toEqual({})
  })
})

describe("reading a source back from jsonb", () => {
  it("keeps known fields with the right types", () => {
    expect(parseInsertSource({ url: "https://example.com", zoom: 2, muted: false })).toEqual({
      url: "https://example.com",
      zoom: 2,
      muted: false,
    })
    expect(parseInsertSource({ fit: "stretch", zoom: "2", extra: 1 })).toBeUndefined()
    expect(parseInsertSource(null)).toBeUndefined()
    expect(parseInsertSource("nope")).toBeUndefined()
    expect(parseInsertSource([])).toBeUndefined()
    expect(parseInsertSource({})).toBeUndefined()
  })

  it("drops a url whose scheme never passed the write-time check", () => {
    // a restored backup or a direct sql write reaches every visitor through
    // library.server.ts without validateSource ever running on it
    expect(parseInsertSource({ url: "javascript:alert(1)" })).toBeUndefined()
    expect(parseInsertSource({ url: "data:text/html,<script>1</script>" })).toBeUndefined()
    expect(parseInsertSource({ url: "example.com" })).toBeUndefined()
    expect(parseInsertSource({ url: "javascript:alert(1)", path: "public/a.png" })).toEqual({ path: "public/a.png" })
    expect(parseInsertSource({ url: "http://localhost:3000/a.png" })).toEqual({ url: "http://localhost:3000/a.png" })
  })

  it("falls back to scene for an unknown kind column", () => {
    expect(parseInsertKind("site")).toBe("site")
    expect(parseInsertKind("widget")).toBe("scene")
    expect(parseInsertKind(null)).toBe("scene")
  })

  it("reports whether anything was chosen", () => {
    expect(hasSource(undefined)).toBe(false)
    expect(hasSource({})).toBe(false)
    expect(hasSource({ url: "" })).toBe(false)
    expect(hasSource({ scroll: false })).toBe(true)
    expect(hasSource({ url: "https://example.com" })).toBe(true)
  })
})


describe("parseInsertSource on the read path", () => {
  it("drops a background that is not a colour", () => {
    // the value lands in an inline style; a row written by direct sql or
    // restored from a backup never passed validateSource
    expect(parseInsertSource({ url: "https://a.example/", background: "url(https://tracker.example/p.gif)" })).toEqual(
      { url: "https://a.example/" },
    )
    expect(parseInsertSource({ url: "https://a.example/", background: "#0b0f17" })).toEqual({
      url: "https://a.example/",
      background: "#0b0f17",
    })
  })

  it("keeps a scene key that looks like one and drops anything else", () => {
    expect(parseInsertSource({ sceneKey: "cctv" })).toEqual({ sceneKey: "cctv" })
    expect(parseInsertSource({ sceneKey: "../etc" })).toBeUndefined()
    expect(parseInsertSource({ sceneKey: "A B" })).toBeUndefined()
  })
})

describe("a scene insert", () => {
  it("carries the package the author picked and nothing else", () => {
    expect(validateSource("scene", { sceneKey: "countdown" })).toEqual({ ok: true })
    expect(normalizeSource("scene", { sceneKey: " countdown " })).toEqual({ sceneKey: "countdown" })
    expect(fail(validateSource("scene", { sceneKey: "no spaces allowed" })).field).toBe("source.sceneKey")
    expect(fail(validateSource("scene", { sceneKey: "countdown", url: "https://a.example/" })).field).toBe("source")
    // a scene source with nothing in it is still a scene
    expect(validateSource("scene", {})).toEqual({ ok: true })
    expect(normalizeSource("scene", { url: "https://a.example/" })).toEqual({})
  })
})

describe("checkSourceUrl", () => {
  it("refuses a url that frames this app itself", () => {
    // the frame keeps allow-scripts, and same-origin there would mean sharing
    // a document with the localStorage that holds the tokens
    const site = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = "https://mixture.example"
    try {
      expect(fail(checkSourceUrl("https://mixture.example/insert/gs-001")).message).toBe("cannot frame this app")
      expect(checkSourceUrl("https://elsewhere.example/")).toEqual({ ok: true })
    } finally {
      if (site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
      else process.env.NEXT_PUBLIC_SITE_URL = site
    }
  })
})
