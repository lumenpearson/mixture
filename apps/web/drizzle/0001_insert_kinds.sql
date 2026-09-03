-- 0001_insert_kinds
--
-- An insert is no longer always a packaged scene: it can also be a live
-- website shown inside the device frame, or a file from the cloud drive.
-- `kind` says which, `source` holds the site url / cloud path and the framing
-- options (see InsertSource in packages/screenkit-core/src/types.ts).
--
-- Existing rows are scenes: the default fills them in and `source` stays null.
--
-- The application runs the same two statements itself through
-- `apps/web/lib/db/ensure.ts` on the first library query of a process, so this
-- file is for running the migration by hand — both are idempotent.

ALTER TABLE "screenkit_inserts" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'scene';
ALTER TABLE "screenkit_inserts" ADD COLUMN IF NOT EXISTS "source" jsonb;
