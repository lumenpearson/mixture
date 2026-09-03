import * as Legacy from "expo-file-system/legacy"
import { Platform } from "react-native"
import { contentTypeOf } from "@/lib/files"
import type { FileEntry } from "@/lib/rpc/codec"

/* ------------------------------------------------------------------ *
 * the local folder, through the storage access framework
 *
 * Android grants access to one folder tree at a time and identifies
 * everything inside it by a `content://` document uri, not by a path. The
 * bridge keeps that detail here: the rest of the app sees the same
 * `FileEntry` rows the cloud produces, with `source: "local"` and the
 * document uri in `path`.
 *
 * SAF lives in the legacy surface of expo-file-system; the new File /
 * Directory api does not cover content uris.
 * ------------------------------------------------------------------ */

export type LocalPermission = "granted" | "prompt" | "denied" | "unsupported"

export const isSupported = () => Platform.OS === "android"

/** ask for a folder; returns its tree uri, or "" when the user backed out */
export async function requestRoot(): Promise<string> {
  if (!isSupported()) return ""
  const result = await Legacy.StorageAccessFramework.requestDirectoryPermissionsAsync()
  return result.granted ? result.directoryUri : ""
}

/**
 * the display name of a SAF uri.
 *
 * A document uri ends with the encoded document id — `primary:DCIM/ep01`
 * for the folder, `primary:DCIM/ep01/still.png` for a file — so the name
 * is what follows the last separator of the decoded id.
 */
export function nameFromUri(uri: string): string {
  const tail = uri.split("/document/").pop() ?? uri
  let decoded = tail
  try {
    decoded = decodeURIComponent(tail)
  } catch {
    // a malformed escape: fall back to the raw tail rather than throwing
  }
  const afterColon = decoded.split(":").pop() ?? decoded
  return afterColon.split("/").filter(Boolean).pop() ?? decoded
}

/** the decoded document id, used as a human-readable path in the ui */
export function labelFromUri(uri: string): string {
  const tail = uri.split("/document/").pop() ?? uri
  try {
    const decoded = decodeURIComponent(tail)
    return decoded.split(":").pop() ?? decoded
  } catch {
    return tail
  }
}

/** list one folder; children are read one by one because SAF has no stat-all */
export async function listDirectory(uri: string): Promise<FileEntry[]> {
  if (!isSupported() || !uri) return []
  const children = await Legacy.StorageAccessFramework.readDirectoryAsync(uri)
  const entries = await Promise.all(
    children.map(async (child): Promise<FileEntry> => {
      const name = nameFromUri(child)
      let size = 0
      let directory = false
      try {
        const info = await Legacy.getInfoAsync(child)
        if (info.exists) {
          size = info.size
          directory = info.isDirectory
        }
      } catch {
        // an unreadable child still belongs in the listing, as a 0-byte file
      }
      return {
        path: child,
        name,
        directory,
        size,
        sha: "",
        editable: true,
        contentType: directory ? "" : contentTypeOf(name),
        downloadUrl: child,
        source: "local",
      }
    }),
  )
  return entries
}

export type LocalScan = { files: number; directories: number; bytes: number }

/** counts for the permission screen; one level deep, which is enough to explain */
export async function scan(uri: string): Promise<LocalScan> {
  const entries = await listDirectory(uri)
  return entries.reduce<LocalScan>(
    (total, entry) => ({
      files: total.files + (entry.directory ? 0 : 1),
      directories: total.directories + (entry.directory ? 1 : 0),
      bytes: total.bytes + entry.size,
    }),
    { files: 0, directories: 0, bytes: 0 },
  )
}

export async function createDirectory(parentUri: string, name: string): Promise<string> {
  return Legacy.StorageAccessFramework.makeDirectoryAsync(parentUri, name)
}

export async function deleteEntry(uri: string): Promise<void> {
  await Legacy.deleteAsync(uri, { idempotent: true })
}

/** base64 of a local file, for uploading it into the cloud */
export async function readBase64(uri: string): Promise<string> {
  return Legacy.readAsStringAsync(uri, { encoding: Legacy.EncodingType.Base64 })
}

/** write bytes into the granted folder — how a cloud file is downloaded */
export async function writeBase64(
  parentUri: string,
  name: string,
  base64: string,
): Promise<string> {
  const target = await Legacy.StorageAccessFramework.createFileAsync(
    parentUri,
    name.replace(/\.[^.]+$/, ""),
    contentTypeOf(name),
  )
  await Legacy.writeAsStringAsync(target, base64, { encoding: Legacy.EncodingType.Base64 })
  return target
}
