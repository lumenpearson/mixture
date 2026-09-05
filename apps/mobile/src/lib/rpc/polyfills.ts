import FastEncoder from "react-native-fast-encoder"
import "react-native-url-polyfill/auto"
import { ReadableStream, TransformStream, WritableStream } from "web-streams-polyfill"

/* ------------------------------------------------------------------ *
 * web apis connect-es expects
 *
 * Hermes has no TextEncoder/TextDecoder (protobuf needs both for string
 * fields) and no whatwg streams. `react-native-url-polyfill/auto` installs
 * URL/URLSearchParams the moment it is imported; the rest is installed
 * here, and only when the runtime is missing it, so a future Hermes that
 * ships its own keeps its faster implementation.
 *
 * Imported for its side effects from `client.ts` before anything touches
 * the transport.
 * ------------------------------------------------------------------ */

type Mutable = Record<string, unknown>

const scope = globalThis as unknown as Mutable

function install(name: string, value: unknown) {
  if (scope[name] === undefined) scope[name] = value
}

// one class covers both roles: it has `encode(string)` and `decode(bytes)`,
// so it stands in for TextEncoder and TextDecoder alike
install("TextEncoder", FastEncoder)
install("TextDecoder", FastEncoder)

install("ReadableStream", ReadableStream)
install("WritableStream", WritableStream)
install("TransformStream", TransformStream)

export {}
