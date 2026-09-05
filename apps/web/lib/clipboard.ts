import { toast } from "sonner"

/* ------------------------------------------------------------------ *
 * one clipboard write, one honest answer
 *
 * `navigator.clipboard` is undefined on a non-secure origin — the desktop
 * shell's http dev target and any plain-http preview — and `writeText` also
 * rejects when the document is not focused or the permission was refused.
 * Ten call sites used to fire the write and toast success in the same
 * statement, so the user was told «скопировано» over an empty clipboard, most
 * damagingly for a cloud access key, which is shown exactly once.
 * ------------------------------------------------------------------ */

/** Write `text`, then toast `done` or `failed`. Resolves to what happened. */
export async function copyText(text: string, done: string, failed: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("no clipboard api")
    await navigator.clipboard.writeText(text)
    toast.success(done)
    return true
  } catch {
    toast.error(failed)
    return false
  }
}
