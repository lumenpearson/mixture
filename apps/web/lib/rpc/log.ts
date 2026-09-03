/* ------------------------------------------------------------------ *
 * rpc activity log
 *
 * A ring buffer the logging interceptor in `client.ts` writes to and the
 * settings card reads. It exists because binary gRPC-Web is opaque in the
 * network tab: the payload is protobuf, so "which method took 900 ms and
 * came back unavailable" is otherwise a guess.
 *
 * What is recorded is deliberately thin: method, duration, transferred size
 * when the response reports one, the Connect code and the server's message.
 * Request and response bodies never enter this module, and neither do the
 * edit token, the cloud token or the access key — the log is copied into bug
 * reports, and those headers must not travel with it.
 * ------------------------------------------------------------------ */

export const RPC_LOG_CAPACITY = 200

/** longest server message kept; the rest is dropped, not stored elsewhere */
const MAX_MESSAGE_LENGTH = 160

export type RpcLogStatus = "ok" | "error"

export type RpcLogEntry = {
  /** monotonic within the session; the react key of the log table */
  id: number
  /** epoch milliseconds when the attempt finished */
  at: number
  /** fully qualified service name, e.g. `mixture.library.v1.LibraryService` */
  service: string
  /** bare method name, e.g. `GetLibrary` */
  method: string
  durationMs: number
  /** response body size when the server reported content-length, else null */
  bytes: number | null
  status: RpcLogStatus
  /** connect code in snake case (`unavailable`), null on success */
  code: string | null
  message: string
  /** zero-based attempt index; a retried call writes one entry per attempt */
  attempt: number
}

export type RpcLogInput = Omit<RpcLogEntry, "id">

type Listener = () => void

let entries: readonly RpcLogEntry[] = []
let paused = false
let nextId = 1
const listeners = new Set<Listener>()

const EMPTY: readonly RpcLogEntry[] = []

function notify() {
  listeners.forEach((listener) => listener())
}

export const rpcLog = {
  /** newest last; a new array on every change so useSyncExternalStore sees it */
  get: (): readonly RpcLogEntry[] => entries,
  /** nothing has happened during server rendering, and the ref must be stable */
  getServer: (): readonly RpcLogEntry[] => EMPTY,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  push(input: RpcLogInput) {
    if (paused) return
    const entry: RpcLogEntry = {
      ...input,
      id: nextId++,
      message: input.message.slice(0, MAX_MESSAGE_LENGTH),
    }
    const next = entries.length >= RPC_LOG_CAPACITY ? entries.slice(entries.length - RPC_LOG_CAPACITY + 1) : entries.slice()
    next.push(entry)
    entries = next
    notify()
  },
  clear() {
    if (entries.length === 0) return
    entries = EMPTY
    notify()
  },
  isPaused: () => paused,
  setPaused(value: boolean) {
    if (paused === value) return
    paused = value
    notify()
  },
}

/** `hh:mm:ss` for the log table; local time, no locale-specific separators */
export function formatClock(at: number): string {
  const date = new Date(at)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** `1.2 kb` / `340 b`; null when the response did not report a size */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "—"
  if (bytes < 1024) return `${bytes} b`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kb`
  return `${(bytes / (1024 * 1024)).toFixed(2)} mb`
}
