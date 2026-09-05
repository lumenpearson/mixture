import { describe, expect, it } from "vitest"
import { CLOUD_KEY_HEADER, CLOUD_TOKEN_HEADER, EDIT_TOKEN_HEADER } from "./headers"
import { ALLOWED_REQUEST_HEADERS, allowedOrigins, corsHeaders, preflight, withCors } from "./cors"

const env = (extra: Record<string, string> = {}) => ({ ...extra })

describe("allowedOrigins", () => {
  it("always carries the desktop origins", () => {
    const origins = allowedOrigins(env())
    expect(origins).toContain("tauri://localhost")
    expect(origins).toContain("http://tauri.localhost")
  })

  it("adds the site url and the configured list, as origins and without duplicates", () => {
    const origins = allowedOrigins(
      env({
        NEXT_PUBLIC_SITE_URL: "https://mixture.example/",
        MIXTURE_RPC_ALLOWED_ORIGINS: "https://preview.example/some/path, https://mixture.example, nonsense",
      }),
    )
    expect(origins).toContain("https://mixture.example")
    expect(origins).toContain("https://preview.example")
    expect(origins).not.toContain("nonsense")
    expect(new Set(origins).size).toBe(origins.length)
  })
})

describe("corsHeaders", () => {
  it("says nothing for a request without an origin", () => {
    expect(corsHeaders(null, env())).toBeNull()
  })

  it("refuses an origin that is not on the list", () => {
    expect(corsHeaders("https://evil.example", env())).toBeNull()
  })

  it("echoes the matched origin rather than a wildcard, and varies on it", () => {
    const headers = corsHeaders("tauri://localhost", env())
    expect(headers?.["Access-Control-Allow-Origin"]).toBe("tauri://localhost")
    expect(headers?.["Access-Control-Allow-Origin"]).not.toBe("*")
    expect(headers?.Vary).toBe("Origin")
  })

  it("allows exactly the headers the transport and the credentials send", () => {
    const headers = corsHeaders("tauri://localhost", env())
    const allowed = (headers?.["Access-Control-Allow-Headers"] ?? "").split(", ")
    for (const name of ["content-type", "connect-protocol-version", "x-grpc-web"]) {
      expect(allowed).toContain(name)
    }
    for (const name of [EDIT_TOKEN_HEADER, CLOUD_TOKEN_HEADER, CLOUD_KEY_HEADER]) {
      expect(allowed).toContain(name)
    }
    expect(allowed).toEqual(ALLOWED_REQUEST_HEADERS)
  })

  it("exposes the grpc-web status headers, which carry the error", () => {
    const exposed = (corsHeaders("tauri://localhost", env())?.["Access-Control-Expose-Headers"] ?? "").split(", ")
    expect(exposed).toContain("grpc-status")
    expect(exposed).toContain("grpc-message")
  })
})

describe("preflight", () => {
  const request = (origin?: string) =>
    new Request("https://api.example/api/rpc/mixture.library.v1.LibraryService/GetLibrary", {
      method: "OPTIONS",
      headers: origin ? { origin } : {},
    })

  it("answers 204 with the headers for an allowed origin", () => {
    const response = preflight(request("tauri://localhost"), env())
    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe("tauri://localhost")
  })

  it("answers 403 and no allow-origin for anyone else", () => {
    const response = preflight(request("https://evil.example"), env())
    expect(response.status).toBe(403)
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })
})

describe("withCors", () => {
  const request = (origin?: string) =>
    new Request("https://api.example/api/rpc/x", { method: "POST", headers: origin ? { origin } : {} })

  it("mirrors the allow-list onto the answer", () => {
    const response = withCors(new Response("ok"), request("http://tauri.localhost"), env())
    expect(response.headers.get("access-control-allow-origin")).toBe("http://tauri.localhost")
    expect(response.headers.get("vary")).toContain("Origin")
  })

  it("leaves a disallowed origin without allow-origin but still varies", () => {
    const response = withCors(new Response("ok"), request("https://evil.example"), env())
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
    expect(response.headers.get("vary")).toContain("Origin")
  })
})
