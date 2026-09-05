import { contentTypeFor, serverCloudRepo } from "@/lib/rpc/cloud/service"
import {
  STREAM_MAX_BYTES,
  inlineDisposition,
  parseByteRange,
  parseStreamParams,
  safeStreamContentType,
  streamSecret,
  verifyStreamTicket,
} from "@/lib/rpc/cloud/stream"

/* ------------------------------------------------------------------ *
 * byte streaming for cloud files — the one route that is not an RPC
 *
 * Every business operation in this app is a ConnectRPC call over /api/rpc.
 * Media playback cannot be: a <video> element opens its own requests, sets
 * its own `Range` header, sends no `x-mixture-cloud-token`, and must receive
 * 206 responses the browser can seek in. gRPC-Web has no answer for that, and
 * pushing whole files through the rpc costs 4 MiB per message. So this route
 * exists, and it is deliberately the *only* exception: it performs no
 * business logic beyond checking a ticket CloudService already authorized.
 *
 * The ticket (see `lib/rpc/cloud/stream.ts`) is an hmac over path, expiry and
 * blob sha. CreateStreamTicket resolved the caller's role and the file's
 * visibility before signing it, so this route needs no identity of its own —
 * and it must not accept one, because a url in the DOM is not a credential.
 * The bytes are fetched with the server token, which is why a deployment
 * without MIXTURE_CLOUD_GITHUB_TOKEN cannot mint tickets at all.
 * ------------------------------------------------------------------ */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ten minutes, the ticket's own lifetime; `private` because these bytes were
 *  handed to one viewer, not to a shared cache */
const CACHE_CONTROL = "private, max-age=600"

function fail(status: number, reason: string, headers: Record<string, string> = {}): Response {
  return new Response(reason, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers },
  })
}

/** drop the upstream body we are not going to forward (HEAD, errors, caps) */
function discard(response: Response) {
  void response.body?.cancel().catch(() => undefined)
}

/**
 * Cut `[start, end]` out of a stream while it flows. GitHub answers some raw
 * requests with the whole file even when a Range was asked for; slicing here
 * keeps at most one chunk in memory, so a 90 MB video never lands in the
 * function's heap.
 */
function sliceStream(source: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  const reader = source.getReader()
  const wanted = end - start + 1
  let seen = 0
  let sent = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done || !value) {
          controller.close()
          return
        }
        const chunkStart = seen
        seen += value.byteLength
        if (seen <= start) continue // still before the window
        const from = Math.max(0, start - chunkStart)
        const to = Math.min(value.byteLength, end - chunkStart + 1)
        if (to <= from) continue
        const piece = value.subarray(from, to)
        sent += piece.byteLength
        controller.enqueue(piece)
        if (sent >= wanted) {
          controller.close()
          await reader.cancel().catch(() => undefined)
          return
        }
        return
      }
    },
    cancel(reason) {
      void reader.cancel(reason).catch(() => undefined)
    },
  })
}

async function handle(request: Request, withBody: boolean): Promise<Response> {
  const secret = streamSecret()
  // no secret means no ticket was ever valid; the same 403 as a forged one
  if (!secret) return fail(403, "stream ticket rejected")

  const url = new URL(request.url)
  const verdict = verifyStreamTicket(parseStreamParams(url.searchParams), secret)
  // forged, malformed and expired all answer alike: the difference between
  // them is an oracle over the signing key
  if (!verdict.ok) return fail(403, "stream ticket rejected")

  const repo = serverCloudRepo()
  // only reachable when the server token was removed after a ticket was minted
  if (!repo) return fail(503, "cloud streaming is not configured")

  const path = verdict.ticket.path
  const name = path.split("/").pop() ?? path
  const range = request.headers.get("range")

  let upstream: Response
  try {
    upstream = await repo.rawContents(path, range ? { Range: range } : {})
  } catch {
    return fail(502, "cloud storage did not answer")
  }

  if (upstream.status === 404) {
    discard(upstream)
    return fail(404, "file not found")
  }
  if (upstream.status !== 200 && upstream.status !== 206) {
    // 401/403/429 from GitHub are our problem, not the visitor's: the ticket
    // was valid, the upstream was not
    discard(upstream)
    return fail(502, `cloud storage answered ${upstream.status}`)
  }

  const headers = new Headers({
    "Content-Type": safeStreamContentType(contentTypeFor(name)),
    "Content-Disposition": inlineDisposition(name),
    "Accept-Ranges": "bytes",
    "Cache-Control": CACHE_CONTROL,
    // the type is derived from the extension, so sniffing must not override it
    "X-Content-Type-Options": "nosniff",
  })

  // GitHub honoured the Range: forward its window untouched
  if (upstream.status === 206) {
    const contentRange = upstream.headers.get("content-range")
    const length = upstream.headers.get("content-length")
    if (contentRange) headers.set("Content-Range", contentRange)
    if (length) headers.set("Content-Length", length)
    if (!withBody || !upstream.body) {
      discard(upstream)
      return new Response(null, { status: 206, headers })
    }
    return new Response(upstream.body, { status: 206, headers })
  }

  const declared = Number(upstream.headers.get("content-length") ?? "")
  const size = Number.isSafeInteger(declared) && declared >= 0 ? declared : Number.NaN
  if (size > STREAM_MAX_BYTES) {
    discard(upstream)
    return fail(413, "file is too large to stream")
  }

  const view = parseByteRange(range, size)
  if (view === "unsatisfiable") {
    discard(upstream)
    return fail(416, "requested range not satisfiable", { "Content-Range": `bytes */${size}` })
  }

  if (!view) {
    if (Number.isFinite(size)) headers.set("Content-Length", String(size))
    if (!withBody || !upstream.body) {
      discard(upstream)
      return new Response(null, { status: 200, headers })
    }
    return new Response(upstream.body, { status: 200, headers })
  }

  // GitHub ignored the Range and sent the whole file: answer 206 anyway, or
  // the browser will re-request from byte 0 on every seek
  headers.set("Content-Range", `bytes ${view.start}-${view.end}/${size}`)
  headers.set("Content-Length", String(view.end - view.start + 1))
  if (!withBody || !upstream.body) {
    discard(upstream)
    return new Response(null, { status: 206, headers })
  }
  return new Response(sliceStream(upstream.body, view.start, view.end), { status: 206, headers })
}

export async function GET(request: Request): Promise<Response> {
  return handle(request, true)
}

export async function HEAD(request: Request): Promise<Response> {
  return handle(request, false)
}
