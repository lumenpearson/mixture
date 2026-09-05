import type { UploadCandidate } from "./upload-queue"

/* ------------------------------------------------------------------ *
 * turning a drop or a file picker into upload candidates
 *
 * Dropping a folder only yields files through the non-standard but
 * universally implemented `DataTransferItem.webkitGetAsEntry()`; the same is
 * true of `<input webkitdirectory>`, which reports the folder through
 * `webkitRelativePath`. Both are read here so the rest of the manager only
 * ever sees `{ file, relativePath }`.
 * ------------------------------------------------------------------ */

/** how many entries a single drop may expand to before we stop walking */
export const MAX_DROP_ENTRIES = 2_000

type FileSystemEntryLike = {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
}

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file(success: (file: File) => void, failure: (error: unknown) => void): void
}

type FileSystemDirectoryReaderLike = {
  readEntries(success: (entries: FileSystemEntryLike[]) => void, failure: (error: unknown) => void): void
}

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader(): FileSystemDirectoryReaderLike
}

const readFile = (entry: FileSystemFileEntryLike) =>
  new Promise<File | null>((resolve) => entry.file((file) => resolve(file), () => resolve(null)))

const readBatch = (reader: FileSystemDirectoryReaderLike) =>
  new Promise<FileSystemEntryLike[]>((resolve) => reader.readEntries((entries) => resolve(entries), () => resolve([])))

async function walk(entry: FileSystemEntryLike, prefix: string, out: UploadCandidate[]): Promise<void> {
  if (out.length >= MAX_DROP_ENTRIES) return
  if (entry.isFile) {
    const file = await readFile(entry as FileSystemFileEntryLike)
    if (file) out.push({ file, relativePath: prefix ? `${prefix}/${entry.name}` : entry.name })
    return
  }
  if (!entry.isDirectory) return
  const reader = (entry as FileSystemDirectoryEntryLike).createReader()
  const next = prefix ? `${prefix}/${entry.name}` : entry.name
  // readEntries hands back at most 100 children per call and signals the end
  // with an empty batch, so it has to be drained in a loop
  for (;;) {
    const batch = await readBatch(reader)
    if (!batch.length) return
    for (const child of batch) {
      await walk(child, next, out)
      if (out.length >= MAX_DROP_ENTRIES) return
    }
  }
}

/** every file in a drop, folders expanded, paths relative to the drop target */
export async function candidatesFromDrop(transfer: DataTransfer): Promise<UploadCandidate[]> {
  const items = Array.from(transfer.items ?? [])
  const roots: FileSystemEntryLike[] = []
  for (const item of items) {
    if (item.kind !== "file") continue
    const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntryLike | null })
      .webkitGetAsEntry?.()
    if (entry) roots.push(entry)
  }
  if (!roots.length) {
    // a browser without the entry API still gives the flat file list
    return Array.from(transfer.files ?? []).map((file) => ({ file, relativePath: file.name }))
  }
  const out: UploadCandidate[] = []
  for (const root of roots) await walk(root, "", out)
  return out
}

/** files from an `<input type="file">`, honouring `webkitdirectory` */
export function candidatesFromInput(files: FileList | readonly File[]): UploadCandidate[] {
  return Array.from(files).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }))
}
