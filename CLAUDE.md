# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

**mixture · screenkit** is a bilingual (RU/EN) screen-insert production library for the
crime series «Гремучая смесь»: a workspace to catalogue, preview, grade and export the
on-screen graphics ("inserts") that appear on phones, monitors, tvs, cctv feeds and
trackers as props. It ships as one Next.js 16 app on Vercel. **In-app content and the
README are Russian (with an English translation in the UI); code, identifiers and
comments are English.**

pnpm + Turborepo monorepo: `apps/web` (the app), `packages/protocol` (Protobuf contracts
and generated ConnectRPC bindings), `packages/screenkit-core` (insert types and manifests),
`packages/inserts/*` (one scene package per insert).

## Commands

Node 22+, pnpm 10.34 (`packageManager` pins it). Setup: `pnpm install`.

- `pnpm dev` — syncs inserts and licenses, then Next dev on `http://localhost:3000`
- `pnpm build` — the Vercel build (`turbo run build --filter=web`); must pass **without**
  `DATABASE_URL`
- `pnpm typecheck` / `pnpm lint` / `pnpm test` — across all packages (tsc, eslint + buf
  lint, vitest)
- `pnpm generate` — regenerate Protobuf bindings after any `.proto` edit
- `pnpm check:protocol-generation` — fails when the committed bindings are stale
- **`pnpm check`** — the local gate: protocol freshness, lint, typecheck, test, build

One test file: `pnpm --filter web test -- lib/rpc/cloud/config.test.ts`.
One package: `pnpm --filter @mixture/protocol lint`.

Environment (all optional, see `.env.example`): `DATABASE_URL` (Neon Postgres for
user-added inserts and categories; without it the library is read-only),
`MIXTURE_EDIT_TOKEN` (gates library mutations), `MIXTURE_GITHUB_REPO` /
`MIXTURE_GITHUB_TOKEN` (changelog source), `MIXTURE_CLOUD_REPO` / `MIXTURE_CLOUD_BRANCH` /
`MIXTURE_CLOUD_GITHUB_TOKEN` / `MIXTURE_CLOUD_OWNERS` (cloud drive),
`NEXT_PUBLIC_SITE_URL` (metadata base), `MIXTURE_RPC_ALLOWED_ORIGINS` (comma-separated
origins allowed to call `/api/rpc` cross-origin; the desktop bundle's own origins are
always allowed — see `lib/rpc/cors.ts`).

## Architecture

Dependency direction — **app → components → lib → protocol / core**, with scene
packages depending only on `@screenkit/core`:

```
apps/web/app            Next routes: "/", "/insert/[id]", "/api/rpc/[...path]", error pages, manifest
apps/web/components     screenkit shell (rail, category panel, content), sections, store, theme, motion, primitives; vendored shadcn/ui
apps/web/lib            rpc (services, router, client, codecs, cloud), screenkit (data, i18n, library fetch, export), db (drizzle)
packages/protocol       proto/mixture/{common,library,changelog,cloud}/v1 → src/gen (buf + protoc-gen-es)
packages/screenkit-core Insert, CategoryDef, LocalizedText, scene manifest types, Grain
packages/inserts/*      scene packages: manifest + Scene(insert, settings)
```

Package ownership:

- `@mixture/protocol` — contracts and generated bindings only; no runtime policy, no UI.
- `@screenkit/core` — plain types for inserts, categories, localized text, scene
  manifests.
- `@screenkit/insert-*` — one scene each; self-describing manifest; may carry a
  `screenkit.insert.json` card.
- `apps/web/lib/rpc` — `library.service.ts` (Postgres-backed library, zod validation,
  edit-token gate), `changelog.service.ts` (GitHub changelog with a 30 s cache),
  `cloud/` (GitHub-repository cloud drive: REST client, config schema, glob rules,
  service), `router.ts` (ConnectRPC router; gRPC-Web + Connect, gRPC off), `client.ts`
  (browser transport with the credential interceptor), `codec.ts` / `changelog.codec.ts`
  (proto ↔ domain).
- `apps/web/lib/screenkit` — built-in catalogue (`data.ts`), the RU/EN dictionary
  (`i18n.ts`), `library.server.ts` (merges built-ins, generated packages and custom rows;
  never throws), `export.ts`, the generated `generated-inserts.ts`.
- `apps/web/components/screenkit` — the composition root: `store.tsx`
  (`ScreenkitProvider`), `theme.tsx`, `motion.tsx`, `primitives.tsx`, sections
  (overview, library, preview, timeline, prompts, style, cloud, about), `hotkeys.tsx`.

### Transport

Every business operation is an RPC: `LibraryService` (get / add / delete / reset),
`ChangelogService`, `CloudService`. The browser uses binary gRPC-Web
(`@connectrpc/connect-web`) against `/api/rpc`; the server is a universal ConnectRPC
router inside one Next.js route handler. No REST routes, no server actions. Native gRPC
is off because Vercel functions speak HTTP/1.1 without trailers.

### State ownership

- `ScreenkitProvider` owns: section (with url slugs in `SECTION_SLUGS`), selected
  insert, filters (incl. favourites), library list settings, preview settings, the
  library data (server-rendered first, then RPC), favourites, edit token, site locale
  and per-insert locale overrides. It is the only caller of the library RPCs.
- `theme.tsx` owns palette, gradients, scale and glow (`<html data-*>` attributes);
  `motion.tsx` owns reduce-motion and per-feature flags.
- `localStorage` keys — appearance: `screenkit-locale`, `screenkit-palette`,
  `screenkit-palette-recent-v1`, `screenkit-gradients`, `screenkit-scale`,
  `screenkit-glass-v1`, `screenkit-motion`, `screenkit-motion-features-v2`; layout:
  `screenkit-layout-v1`, `screenkit-content-width-v1`, `screenkit-category-panel-width`;
  library: `screenkit-favorites-v1`, `screenkit-library-list-v1`,
  `screenkit-kind-overrides-v1`, `screenkit-wizard-draft-v1`; media and transport:
  `screenkit-player-v1`, `screenkit-rpc-v1`; desktop: `screenkit-desktop-v1`; cloud:
  `screenkit-cloud-settings-v1`, `screenkit-cloud-favorites-v1`; plus
  `screenkit.reveal-mode` and the credentials `mixture-edit-token`,
  `mixture-cloud-token`, `mixture-cloud-key`. Two are legacy, read once to migrate and
  then removed: `screenkit-glow` (pre-glass) and `screenkit-motion-features-v1`.
  `sessionStorage`: `screenkit-library-cache-v2`, `screenkit-changelog-cache-v3`.
  `lib/screenkit/storage-keys.test.ts` fails when a key in the source is missing here,
  so add a new one to this list in the same change.
- Built-in inserts, scene packages and `cloud.config.json` are configuration, not state.

### Degradation by design

- No `DATABASE_URL`: `fetchLibrary()` returns the built-in library with
  `persistent: false`; the UI disables adding and explains why; mutations answer
  `failed_precondition`. The build prerenders `/_not-found` under exactly this condition.
- No cloud token: the cloud tab shows the connection panel; with a token whose login is
  the configured owner it can create the repository (`InitRepository`).
- No GitHub token for the changelog: the public rate limit applies; the cache absorbs it.

### Cloud drive

Files live in the root of a private repository (`MIXTURE_CLOUD_REPO`);
`cloud.config.json` there defines `defaultVisibility`, glob `rules` (`public/**`,
`*.png`) and `access` (`owners`, `editors`, `viewers`, `allowAnonymousPublic`, `keys` as
sha256 hashes). Roles: anonymous < viewer < editor < owner. Single-file changes use the
contents API; moves and recursive deletes are one commit through the git data API.
Uploads are capped at 4 MiB (Vercel body limit). Details: `.claude/agents/cloud-engineer.md`.

### Deployment

Vercel builds from git: pushes become previews, `master` is production. The root
`vercel.json` (framework `nextjs`, `pnpm build`, output `apps/web/.next`) is what lets
the project build from the repository root; `next` is also a root devDependency because
the Vercel Next.js builder resolves it from the entry directory. Keep both in step with
`apps/web`.

### Further reading

- `.agents/conventions.md` — the invariants and how they are checked
- `.agents/workflows.md` — the order of work, gates and commit rules
- `packages/protocol/README.md` — contracts and codegen
- `packages/inserts/README.md` — how to add an insert (native package or exported Next
  project)
- `AI_USAGE_POLICY.md` — what a contributor using AI tools confirms with a change

## Delegation: one agent per task

Seven agents in `.claude/agents/`. Route work to the agent that owns the area rather than
doing it inline; the codebase is wide enough that one context reading everything reads
nothing carefully.

| Agent               | Owns                                                                   | Writes code |
| ------------------- | ---------------------------------------------------------------------- | ----------- |
| `architect`         | Where a capability belongs, layering, RPC vs new service, safe order   | no          |
| `ui-engineer`       | Shell, sections, store, theme/motion, tokens, shadcn set, i18n         | yes         |
| `protocol-engineer` | `.proto`, codegen, library/changelog services, router, client, codecs  | yes         |
| `cloud-engineer`    | Cloud drive: GitHub client, config rules, roles, cloud UI              | yes         |
| `insert-engineer`   | Scene packages, built-in catalogue, device frames and grades, registry | yes         |
| `tester`            | vitest suites, mutation testing, manual verification protocols         | yes         |
| `reviewer`          | Correctness, security, the boundaries — before a commit or PR          | no          |

- **One agent per task, matched to the area.** A task spanning the proto and the UI is
  two delegations, not one wide brief.
- **Independent tasks go out in one message** so they run concurrently.
- **`architect` before code** when the question is "where does this live".
- **`reviewer` before committing** anything touching tokens, roles, validation or the
  cloud repository operations. Read-only by design.
- **Do not delegate** a one-line fix in an open file, or a question one module answers.

### Skills

`.claude/skills/` holds six vendored skills, pinned by `skills-lock.json`: `shadcn`,
`vercel-composition-patterns`, `vercel-react-best-practices`,
`vercel-react-view-transitions`, `web-design-guidelines`, `writing-guidelines`. Each
agent's `## Skills` section says which apply. This repo uses the Radix build of shadcn/ui;
do not migrate it to Base UI.

## Git commit and pull request conventions

- **Conventional prefix, imperative subject** (`type(scope): do the thing`); scopes
  `web`, `protocol`, `cloud`, `inserts`, `docs`, `ci`.
- **Consequence before measure:** what was wrong first, what the change does second.
- **Plain declarative sentences.** No hedging, exclamation marks or self-praise.
- **Name concrete artefacts** — the file, the RPC, the setting — never "various fixes".
- **Redact** tokens, keys and connection strings; write `<redacted>`.
- **State scope, including what is out of it.** A change that stops short says so.
- Attribution trailers (`Co-Authored-By`, an agent session link) are allowed; they do not
  move responsibility off the human who pushes (`AI_USAGE_POLICY.md`).
- Never commit directly to `master`; open a pull request from a branch.

## Notes

- TypeScript is strict everywhere (`tsconfig.base.json`); `next.config.mjs` keeps
  `ignoreBuildErrors: false`.
- `lib/screenkit/generated-inserts.ts`, `licenses.generated.json` and
  `public/licenses/*` are generated by `pnpm --filter web prepare:assets` (run by `dev`
  and `build`); never hand-edit them.
- **Read a file before editing it; grep every caller before changing a function.**
  Re-research rather than trusting memory of this codebase.
- Every visible string is an i18n key present in both `RU` and `EN`; keep the counts
  equal (`node -e` over `i18n.ts` is the quick check).
