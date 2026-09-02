import { describe, expect, it } from "vitest"
import { Role, Visibility } from "@mixture/protocol/cloud"
import {
  canSee,
  configFromPb,
  configToPb,
  defaultCloudConfig,
  parseCloudConfig,
  roleForKeyHash,
  roleForLogin,
  visibilityFor,
} from "./config"

const owner = "lumenpearson"

describe("parseCloudConfig", () => {
  it("falls back to the default config on damaged json", () => {
    const { config, error } = parseCloudConfig("{ nope", owner)
    expect(error).not.toBeNull()
    expect(config.access.owners).toEqual([owner])
    expect(config.defaultVisibility).toBe("private")
  })

  it("applies defaults for missing sections", () => {
    const { config, error } = parseCloudConfig(JSON.stringify({ version: 1 }), owner)
    expect(error).toBeNull()
    expect(config.rules).toEqual([])
    expect(config.access.allowAnonymousPublic).toBe(true)
  })

  it("rejects a key hash that is not sha256 hex", () => {
    const text = JSON.stringify({ version: 1, access: { keys: [{ name: "crew", role: "viewer", keyHash: "abc" }] } })
    expect(parseCloudConfig(text, owner).error).toContain("sha256")
  })
})

describe("visibilityFor", () => {
  const config = defaultCloudConfig(owner)

  it("uses the default visibility when nothing matches", () => {
    expect(visibilityFor("renders/a.png", config)).toBe("private")
  })

  it("lets the last matching rule win", () => {
    const layered = { ...config, rules: [...config.rules, { pattern: "public/secret/**", visibility: "hidden" as const }] }
    expect(visibilityFor("public/a.png", layered)).toBe("public")
    expect(visibilityFor("public/secret/a.png", layered)).toBe("hidden")
    expect(visibilityFor("nested/.gitkeep", layered)).toBe("hidden")
  })
})

describe("canSee", () => {
  const config = defaultCloudConfig(owner)

  it("shows hidden entries to owners only", () => {
    expect(canSee("owner", "hidden", config)).toBe(true)
    expect(canSee("editor", "hidden", config)).toBe(false)
  })

  it("shows private entries to viewers and above", () => {
    expect(canSee("anonymous", "private", config)).toBe(false)
    expect(canSee("viewer", "private", config)).toBe(true)
  })

  it("gates public entries for anonymous callers on allowAnonymousPublic", () => {
    expect(canSee("anonymous", "public", config)).toBe(true)
    const closed = { ...config, access: { ...config.access, allowAnonymousPublic: false } }
    expect(canSee("anonymous", "public", closed)).toBe(false)
    expect(canSee("viewer", "public", closed)).toBe(true)
  })
})

describe("roles", () => {
  const config = {
    ...defaultCloudConfig(owner),
    access: {
      owners: [owner],
      editors: ["Editor-One"],
      viewers: ["viewer"],
      allowAnonymousPublic: true,
      keys: [{ name: "crew", role: "editor" as const, keyHash: "sha256:" + "ab".repeat(32) }],
    },
  }

  it("resolves logins case-insensitively", () => {
    expect(roleForLogin("LumenPearson", config)).toBe("owner")
    expect(roleForLogin("editor-one", config)).toBe("editor")
    expect(roleForLogin("viewer", config)).toBe("viewer")
    expect(roleForLogin("stranger", config)).toBe("anonymous")
  })

  it("resolves key hashes with or without the sha256 prefix", () => {
    expect(roleForKeyHash("ab".repeat(32), config)).toBe("editor")
    expect(roleForKeyHash("sha256:" + "AB".repeat(32), config)).toBe("editor")
    expect(roleForKeyHash("cd".repeat(32), config)).toBe("anonymous")
  })
})

describe("proto round trip", () => {
  it("survives configToPb -> configFromPb and redacts key hashes", () => {
    const config = {
      ...defaultCloudConfig(owner),
      access: {
        ...defaultCloudConfig(owner).access,
        keys: [{ name: "crew", role: "viewer" as const, keyHash: "ab".repeat(32) }],
      },
    }
    const full = configToPb(config, false)
    expect(full.defaultVisibility).toBe(Visibility.PRIVATE)
    expect(full.access?.keys[0]?.keyHash).toBe("ab".repeat(32))
    expect(configFromPb(full, config)).toEqual(config)

    const redacted = configToPb(config, true)
    expect(redacted.access?.keys[0]?.keyHash).toBe("")
    expect(redacted.access?.keys[0]?.role).toBe(Role.VIEWER)
    // a redacted hash keeps the stored one for the same key name
    expect(configFromPb(redacted, config).access.keys[0]?.keyHash).toBe("ab".repeat(32))
  })
})
