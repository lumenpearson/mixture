import {
  universalServerRequestFromFetch,
  universalServerResponseToFetch,
} from "@connectrpc/connect/protocol"
import { preflight, withCors } from "@/lib/rpc/cors"
import { RPC_BASE_PATH } from "@/lib/rpc/headers"
import { rpcHandlers } from "@/lib/rpc/router"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* Every mixture RPC (library, changelog, cloud) is served from this single
   route: POST /api/rpc/<package>.<Service>/<Method> in binary gRPC-Web or
   Connect encoding. */
async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.startsWith(RPC_BASE_PATH) ? url.pathname.slice(RPC_BASE_PATH.length) : url.pathname
  const handler = rpcHandlers().get(path)
  if (!handler) {
    return withCors(
      new Response("unknown rpc", { status: 404, headers: { "Cache-Control": "no-store" } }),
      request,
    )
  }
  const uReq = universalServerRequestFromFetch(request, { httpVersion: "1.1" })
  const uRes = await handler(uReq)
  const response = universalServerResponseToFetch(uRes)
  response.headers.set("Cache-Control", "no-store")
  return withCors(response, request)
}

/* The desktop bundle runs on its own local origin and the transport settings
   can point the browser at another deployment; both make every call
   cross-origin, and the connect headers force a preflight. `cors.ts` decides
   which origins may ask — never `*`, because the credential interceptor
   attaches the edit token and the user's GitHub token to every request. */
function options(request: Request): Response {
  return preflight(request)
}

export { handle as GET, handle as POST, options as OPTIONS }
