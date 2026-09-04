#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 * the static export the desktop bundle ships
 *
 * `next build` with `output: "export"` renders every route to files. Two
 * things in this app cannot be rendered to a file:
 *
 *   - the route handlers under `app/api` — `/api/rpc` is a POST endpoint and
 *     `/api/cloud/stream` answers Range requests; there is no static form of
 *     either, and the desktop app calls them on the deployment instead;
 *   - `export const dynamic = "force-dynamic"` on the pages that read
 *     `searchParams` or the database on every request.
 *
 * Both are moved aside for the duration of the export and put back in a
 * `finally`, rather than being conditionally compiled: the web build must
 * come out of exactly the sources that are committed, and a `pageExtensions`
 * split would have renamed files owned by other parts of the app.
 *
 * Nothing here writes into the working tree permanently. The originals are
 * copied to `.desktop-export.tmp/` (gitignored through `*.tmp`), the export
 * runs, and the copies are restored — on success, on failure and on ^C.
 * ------------------------------------------------------------------ */

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const stash = path.join(root, ".desktop-export.tmp")

/** must match `distDir` in next.config.mjs and `frontendDist` in tauri.conf.json */
const EXPORT_DIR = path.join("out", "desktop")

/**
 * files and directories that must not exist while the export runs.
 *
 * `app/api` holds the two route handlers: `/api/rpc` is a POST endpoint and
 * `/api/cloud/stream` answers Range requests, and the desktop app calls both
 * on the deployment rather than on itself. `app/manifest.ts` is the web app
 * manifest — an installed exe is not a PWA, and a metadata route has no
 * static form unless the file itself opts in.
 */
const REMOVED = ["app/api", "app/manifest.ts"]

/**
 * route-segment config that has to change for the export. Next parses these
 * directives out of the source instead of evaluating them, so a flag inside
 * the page cannot switch them — the literal itself is rewritten here and put
 * back afterwards. A rewrite that matches nothing is a hard failure: a
 * renamed directive must break the build, not quietly ship a bundle whose
 * pages still ask for a server.
 */
const REWRITTEN = [
  { file: "app/page.tsx", edits: [['export const dynamic = "force-dynamic"', 'export const dynamic = "force-static"']] },
  {
    file: "app/insert/[id]/page.tsx",
    edits: [
      ['export const dynamic = "force-dynamic"', 'export const dynamic = "force-static"'],
      ["export const dynamicParams = true", "export const dynamicParams = false"],
    ],
  },
]

/** absolute path of the copy kept for `entry` */
const stashPath = (entry) => path.join(stash, entry.replaceAll("/", "__"))

const saved = []

function save(entry) {
  const from = path.join(root, entry)
  if (!fs.existsSync(from)) throw new Error(`build-desktop: ${entry} is missing`)
  fs.cpSync(from, stashPath(entry), { recursive: true })
  saved.push(entry)
}

function restore() {
  for (const entry of saved.splice(0).reverse()) {
    const to = path.join(root, entry)
    fs.rmSync(to, { recursive: true, force: true })
    fs.cpSync(stashPath(entry), to, { recursive: true })
  }
  fs.rmSync(stash, { recursive: true, force: true })
}

/* a signal kills the child first; put the tree back before leaving */
let leaving = false
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (leaving) return
    leaving = true
    restore()
    process.exit(1)
  })
}

fs.rmSync(stash, { recursive: true, force: true })
fs.mkdirSync(stash, { recursive: true })

let status = 1
try {
  for (const entry of REMOVED) {
    save(entry)
    fs.rmSync(path.join(root, entry), { recursive: true, force: true })
  }
  for (const { file, edits } of REWRITTEN) {
    save(file)
    const target = path.join(root, file)
    let source = fs.readFileSync(target, "utf8")
    for (const [from, to] of edits) {
      if (!source.includes(from)) throw new Error(`build-desktop: ${file} no longer contains ${from}`)
      source = source.replaceAll(from, to)
    }
    fs.writeFileSync(target, source)
  }

  // the api the exported app talks to. Unset means the same origin, which
  // inside the shell is tauri://localhost — a build without it is a desktop
  // app that can reach no server at all, so say so rather than ship it.
  const api = process.env.NEXT_PUBLIC_MIXTURE_API_URL ?? ""
  if (!api) {
    console.warn(
      "build-desktop: NEXT_PUBLIC_MIXTURE_API_URL is not set; the bundle will start with no api configured and the rpc settings card is the only way to point it at one",
    )
  } else {
    console.log(`build-desktop: rpc base url ${api}`)
  }

  const next = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/next/dist/bin/next"), "build"],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, MIXTURE_DESKTOP_BUILD: "1" },
    },
  )
  status = next.status ?? 1
} finally {
  restore()
}

if (status === 0) {
  const index = path.join(root, EXPORT_DIR, "index.html")
  if (!fs.existsSync(index)) {
    console.error(`build-desktop: the export produced no ${path.relative(root, index)}`)
    status = 1
  } else {
    console.log(`build-desktop: ${path.relative(root, index)}`)
  }
}

process.exit(status)
