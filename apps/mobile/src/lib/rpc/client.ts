import { createClient, type Client, type Interceptor, type Transport } from "@connectrpc/connect"
import { createConnectTransport } from "@connectrpc/connect-web"
import { CloudService } from "@mixture/protocol/cloud"
import { LibraryService } from "@mixture/protocol/library"
import "./polyfills"

/* ------------------------------------------------------------------ *
 * the RPC clients
 *
 * The same `/api/rpc` route the browser talks to, over the **Connect**
 * protocol rather than binary gRPC-Web: connect-es frames a gRPC-Web
 * response and reads it through `response.body`, and react native's fetch
 * has no streaming body. Connect unary calls read `response.arrayBuffer()`
 * instead, which react native does support, and the server's ConnectRPC
 * router already speaks both. The wire format still defaults to binary
 * protobuf; `json` is offered in settings for debugging with curl.
 *
 * Credentials come from the settings store and are attached per request;
 * nothing is kept server-side.
 * ------------------------------------------------------------------ */

export const RPC_BASE_PATH = "/api/rpc"
export const EDIT_TOKEN_HEADER = "x-mixture-edit-token"
export const CLOUD_TOKEN_HEADER = "x-mixture-cloud-token"
export const CLOUD_KEY_HEADER = "x-mixture-cloud-key"

export type RpcConfig = {
  baseUrl: string
  format: "binary" | "json"
  timeoutMs: number
  editToken: string
  cloudToken: string
  cloudKey: string
}

let config: RpcConfig = {
  baseUrl: "",
  format: "binary",
  timeoutMs: 15000,
  editToken: "",
  cloudToken: "",
  cloudKey: "",
}

let transport: Transport | null = null

/** called by the settings provider whenever any of these change */
export function setRpcConfig(next: RpcConfig) {
  const changed =
    next.baseUrl !== config.baseUrl ||
    next.format !== config.format ||
    next.timeoutMs !== config.timeoutMs
  config = next
  // the credential interceptor reads `config` on every call, so only the
  // three transport-shaped fields force a rebuild
  if (changed) transport = null
}

export const rpcUrl = () => `${config.baseUrl.replace(/\/+$/, "")}${RPC_BASE_PATH}`

const credentials: Interceptor = (next) => async (req) => {
  if (config.editToken) req.header.set(EDIT_TOKEN_HEADER, config.editToken)
  if (config.cloudToken) req.header.set(CLOUD_TOKEN_HEADER, config.cloudToken)
  if (config.cloudKey) req.header.set(CLOUD_KEY_HEADER, config.cloudKey)
  return next(req)
}

function activeTransport(): Transport {
  if (!transport) {
    transport = createConnectTransport({
      baseUrl: rpcUrl(),
      useBinaryFormat: config.format === "binary",
      interceptors: [credentials],
      defaultTimeoutMs: config.timeoutMs,
    })
  }
  return transport
}

/** forwards to whichever transport the current settings describe */
const delegating: Transport = {
  unary: (method, signal, timeoutMs, header, input, contextValues) =>
    activeTransport().unary(method, signal, timeoutMs, header, input, contextValues),
  stream: (method, signal, timeoutMs, header, input, contextValues) =>
    activeTransport().stream(method, signal, timeoutMs, header, input, contextValues),
}

let library: Client<typeof LibraryService> | null = null
let cloud: Client<typeof CloudService> | null = null

export function libraryClient(): Client<typeof LibraryService> {
  if (!library) library = createClient(LibraryService, delegating)
  return library
}

export function cloudClient(): Client<typeof CloudService> {
  if (!cloud) cloud = createClient(CloudService, delegating)
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
