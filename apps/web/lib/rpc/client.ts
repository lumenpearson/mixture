import { createClient, type Client, type Interceptor, type Transport } from "@connectrpc/connect"
import { createGrpcWebTransport } from "@connectrpc/connect-web"
import { ChangelogService } from "@mixture/protocol/changelog"
import { CloudService } from "@mixture/protocol/cloud"
import { LibraryService } from "@mixture/protocol/library"
import { CLOUD_KEY_HEADER, CLOUD_TOKEN_HEADER, EDIT_TOKEN_HEADER, RPC_BASE_PATH } from "./headers"

/* ------------------------------------------------------------------ *
 * browser-side RPC clients (binary gRPC-Web)
 *
 * Credentials the user pastes into the UI live in localStorage and are
 * attached per request by the interceptor; nothing is stored server-side.
 * ------------------------------------------------------------------ */

export const EDIT_TOKEN_STORAGE_KEY = "mixture-edit-token"
export const CLOUD_TOKEN_STORAGE_KEY = "mixture-cloud-token"
export const CLOUD_KEY_STORAGE_KEY = "mixture-cloud-key"

function readStorage(key: string): string {
  if (typeof window === "undefined") return ""
  try {
    return window.localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

export function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return
  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const getEditToken = () => readStorage(EDIT_TOKEN_STORAGE_KEY)
export const getCloudToken = () => readStorage(CLOUD_TOKEN_STORAGE_KEY)
export const getCloudKey = () => readStorage(CLOUD_KEY_STORAGE_KEY)

const credentials: Interceptor = (next) => async (req) => {
  const edit = getEditToken()
  const token = getCloudToken()
  const key = getCloudKey()
  if (edit) req.header.set(EDIT_TOKEN_HEADER, edit)
  if (token) req.header.set(CLOUD_TOKEN_HEADER, token)
  if (key) req.header.set(CLOUD_KEY_HEADER, key)
  return next(req)
}

function baseUrl(): string {
  if (typeof window !== "undefined") return `${window.location.origin}${RPC_BASE_PATH}`
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  return `${site.replace(/\/$/, "")}${RPC_BASE_PATH}`
}

let transport: Transport | null = null

export function rpcTransport(): Transport {
  if (!transport) {
    transport = createGrpcWebTransport({
      baseUrl: baseUrl(),
      useBinaryFormat: true,
      interceptors: [credentials],
      defaultTimeoutMs: 60_000,
    })
  }
  return transport
}

let library: Client<typeof LibraryService> | null = null
let changelog: Client<typeof ChangelogService> | null = null
let cloud: Client<typeof CloudService> | null = null

export function libraryClient() {
  if (!library) library = createClient(LibraryService, rpcTransport())
  return library
}

export function changelogClient() {
  if (!changelog) changelog = createClient(ChangelogService, rpcTransport())
  return changelog
}

export function cloudClient() {
  if (!cloud) cloud = createClient(CloudService, rpcTransport())
  return cloud
}

/** a short human-readable message for any RPC failure */
export function rpcErrorMessage(error: unknown, fallback = "request failed"): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    // ConnectError messages carry the code in brackets: "[permission_denied] …"
    return error.message.replace(/^\[[a-z_]+\]\s*/i, "") || fallback
  }
  return fallback
}
