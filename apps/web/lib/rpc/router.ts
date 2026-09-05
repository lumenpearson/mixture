import "server-only"
import { createConnectRouter } from "@connectrpc/connect"
import type { UniversalHandler } from "@connectrpc/connect/protocol"
import { ChangelogService } from "@mixture/protocol/changelog"
import { CloudService } from "@mixture/protocol/cloud"
import { LibraryService } from "@mixture/protocol/library"
import { changelogServiceImpl } from "./changelog.service"
import { cloudServiceImpl } from "./cloud/service"
import { libraryServiceImpl } from "./library.service"
import { RPC_MAX_MESSAGE_BYTES } from "./limits"

/* ------------------------------------------------------------------ *
 * ConnectRPC router
 *
 * gRPC-Web and Connect share the same handlers; native gRPC needs HTTP/2
 * trailers, which serverless HTTP/1.1 functions cannot provide, so it stays
 * off. Message size caps the cloud upload path (Vercel accepts ~4.5 MB per
 * request body).
 * ------------------------------------------------------------------ */

const globalForRouter = globalThis as unknown as {
  __mixtureRpcHandlers?: Map<string, UniversalHandler>
}

function build(): Map<string, UniversalHandler> {
  const router = createConnectRouter({
    grpc: false,
    grpcWeb: true,
    connect: true,
    readMaxBytes: RPC_MAX_MESSAGE_BYTES,
    writeMaxBytes: RPC_MAX_MESSAGE_BYTES * 4,
    maxTimeoutMs: 60_000,
  })
  router.service(LibraryService, libraryServiceImpl)
  router.service(ChangelogService, changelogServiceImpl)
  router.service(CloudService, cloudServiceImpl)
  return new Map(router.handlers.map((handler) => [handler.requestPath, handler]))
}

export function rpcHandlers(): Map<string, UniversalHandler> {
  if (!globalForRouter.__mixtureRpcHandlers) {
    globalForRouter.__mixtureRpcHandlers = build()
  }
  return globalForRouter.__mixtureRpcHandlers
}
