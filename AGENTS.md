# AGENTS.md

Entry point for any AI coding agent working in this repository. It does not repeat the
rules; it points to where they live.

1. **Repository map, commands, state ownership** — [`CLAUDE.md`](CLAUDE.md).
2. **Invariants and how they are checked** — [`.agents/conventions.md`](.agents/conventions.md).
3. **Order of work, gates, commit rules** — [`.agents/workflows.md`](.agents/workflows.md).
4. **Specialised agents** (architect, ui-engineer, protocol-engineer, cloud-engineer,
   insert-engineer, tester, reviewer) — [`.claude/agents/`](.claude/agents/).
5. **Vendored skills** — [`.claude/skills/`](.claude/skills/), pinned by
   [`skills-lock.json`](skills-lock.json).
6. **What a contributor using AI tools confirms** — [`AI_USAGE_POLICY.md`](AI_USAGE_POLICY.md).

The short version:

- Every business operation is a ConnectRPC/gRPC-Web call defined in
  `packages/protocol/proto/mixture/*/v1`; regenerate and commit after a `.proto` edit.
- The app must build and serve without `DATABASE_URL` and without any cloud token.
- New UI is built from the existing tokens, primitives and vendored shadcn/ui set, in
  both languages of `lib/screenkit/i18n.ts`.
- Gate before reporting done: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`,
  with the real output in the report.
