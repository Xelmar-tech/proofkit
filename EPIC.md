# EPIC — `tui-proof-kit` monorepo migration + ecosystem buildout

**Status:** scoping
**Owner:** Aaron
**Branch:** `main` (proofkit standalone repo)
**Created:** 2026-05-11

## Why now

The proofkit was scaffolded as a single-package Bun project. A starter
kit (turborepo + pnpm + oxlint + oxfmt + Fumadocs) has been dropped into
`tmp/tui-proof-kit/`. We're adopting it as the foundation for the
project's next phase — a real monorepo with docs, plugins, marketplace
presence, deploy infra, and pre-commit quality gates.

The framework code itself works (11/11 tests, showcase passes, snapshots
clean after the Option D / `@xterm/headless` adoption). Goal here is
purely structural: get the project to a place where contributors and
external consumers can land.

## Scope

In scope:

1. Adopt the turborepo starter at repo root.
2. Move framework code into `packages/tui-proof-kit/` with history preserved.
3. Quality gates: oxlint + oxfmt + lefthook + lint-staged.
4. Fumadocs site with overview, getting-started, and a create-next-app tutorial.
5. MIT license.
6. Claude plugin + Codex plugin.
7. capsule-factory marketplace presence.
8. Deploy infra (docs site + eventual npm publish).

Out of scope (defer):

- Capxul-TUI consumption (downstream; separate plan).
- Color-aware snapshots / cursor-position assertions (v0.x → v1 feature work).
- Public marketing site (the docs site IS the front door for now).
- Cross-platform Windows testing — keep "best-effort" until someone needs it.

## Milestones & tickets

### M1 · Foundation merge (sequential — landed before anything else)

| ID  | Title                                                                                              | Est | Depends |
| --- | -------------------------------------------------------------------------------------------------- | --- | ------- |
| F-1 | Promote starter kit (`tmp/tui-proof-kit/*`) to repo root                                           | XS  | —       |
| F-2 | Scaffold `packages/tui-proof-kit/` with package.json + tsconfig                                    | XS  | F-1     |
| F-3 | `git mv` proofkit code into `packages/tui-proof-kit/`                                              | XS  | F-2     |
| F-4 | Rewrite changeset frontmatter from `@capxul/proofkit` → `tui-proof-kit`                            | XS  | F-3     |
| F-5 | Add `test` task to `turbo.json`; add root scripts (test, changeset, version-packages, release)     | XS  | F-1     |
| F-6 | `pnpm install` clean, `pnpm check` clean, `pnpm turbo check-types` clean, `pnpm turbo build` clean | S   | F-2..5  |
| F-7 | Re-seed showcase snapshots under new layout; verify pass                                           | S   | F-6     |
| F-8 | Add `LICENSE` (MIT) + update each package's `package.json#license` from `UNLICENSED` to `MIT`      | XS  | F-1     |

**M1 acceptance:** `pnpm install && pnpm test && pnpm build && pnpm check` all clean from a fresh clone. Showcase snapshot 04 is ≤ 10 lines (proves xterm-based driver intact under new layout).

### M2 · Quality gates

| ID  | Title                                                                                                            | Est | Depends |
| --- | ---------------------------------------------------------------------------------------------------------------- | --- | ------- |
| Q-1 | Research lefthook + lint-staged for pnpm monorepos                                                               | XS  | M1      |
| Q-2 | ADR-001: pre-commit hook config (lefthook config shape, what runs, perf budget)                                  | S   | Q-1     |
| Q-3 | Install lefthook + lint-staged, wire `lefthook.yml`; pre-commit runs oxlint + oxfmt --write on staged files only | S   | Q-2     |
| Q-4 | `pnpm prepare` installs hooks automatically (`lefthook install`)                                                 | XS  | Q-3     |

**M2 acceptance:** committing a file with a formatting violation gets auto-fixed and re-staged. Committing a file with a lint error blocks the commit with a clear message.

### M3 · Documentation site

| ID  | Title                                                                                                                      | Est | Depends |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| D-1 | Audit `apps/fumadocs/` layout; understand the content tree + nav config                                                    | XS  | M1      |
| D-2 | Author `content/index.mdx` — "what is tui-proof-kit" overview (lift from HOW-IT-WORKS)                                     | S   | D-1     |
| D-3 | Author `content/getting-started.mdx` — install, write your first proof, run it                                             | S   | D-2     |
| D-4 | Author `content/tutorial-create-next-app.mdx` — full walkthrough of the showcase, screen-by-screen, with snapshot examples | M   | D-3     |
| D-5 | Author `content/reference/actions.mdx` — every Action variant with one-line examples                                       | S   | D-3     |
| D-6 | Author `content/concepts/mental-model.mdx` — expectText-as-gate, snapshot semantics, plug-in seams                         | S   | D-2     |
| D-7 | Author `content/concepts/architecture.mdx` — distilled from ARCHITECTURE.html                                              | M   | D-2     |
| D-8 | Author `content/concepts/decisions.mdx` — index of ADRs + decision packs                                                   | S   | D-7     |

**M3 acceptance:** `pnpm --filter fumadocs dev` boots; sidebar shows all sections; getting-started example copy-pastes and runs against the published (or workspace-linked) `tui-proof-kit`. Tutorial mdx renders snapshot 04 / 05 inline as code blocks.

### M4 · Editor plugins

| ID  | Title                                                                                                                 | Est | Depends |
| --- | --------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| P-1 | Research Claude Code plugin format (skills, slash commands, MCP servers)                                              | S   | M1      |
| P-2 | ADR-002: what does the Claude plugin DO — scope decision (slash commands? proof-template scaffolder? capture-viewer?) | M   | P-1     |
| P-3 | Build `apps/claude-plugin/` per ADR-002                                                                               | M   | P-2     |
| P-4 | Research Codex plugin format — https://developers.openai.com/codex/plugins/build                                      | S   | M1      |
| P-5 | ADR-003: what does the Codex plugin DO (scope must mirror or justify divergence from ADR-002)                         | M   | P-4     |
| P-6 | Build `apps/codex-plugin/` per ADR-003                                                                                | M   | P-5     |

**M4 acceptance:** both plugins install locally and expose at least one verb that calls into `tui-proof-kit` (e.g. "run this proof file" or "scaffold a proof for this TUI").

### M5 · Marketplace + deploy

| ID  | Title                                                                                                                           | Est | Depends |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| X-1 | Research capsule-factory marketplace — https://github.com/Xelmar-tech/capsule-factory (what is it? how do packages list there?) | S   | M1      |
| X-2 | ADR-004: capsule-factory integration approach (do we publish a capsule? if so, what's its scope?)                               | S   | X-1     |
| X-3 | Author capsule listing per ADR-004                                                                                              | S   | X-2     |
| X-4 | Research deploy targets for Fumadocs (Vercel, Cloudflare Pages, Netlify, self-host on Capxul-VPS)                               | S   | M1      |
| X-5 | ADR-005: deploy infra — docs host, custom domain, build trigger, npm-publish CI workflow                                        | M   | X-4     |
| X-6 | Implement deploy per ADR-005 — `.github/workflows/{ci.yml, docs-deploy.yml, release.yml}`                                       | M   | X-5     |
| X-7 | First successful CI run: lint + typecheck + test + build (no publish)                                                           | S   | X-6     |
| X-8 | First successful docs-deploy run; live URL                                                                                      | S   | X-6     |

**M5 acceptance:** docs site is live at a public URL. `git tag v0.2.0 && git push --tags` triggers a successful (dry-run) publish workflow. capsule-factory listing exists.

## ADRs to write

Each ADR is a 1–2 page markdown file under `docs/adrs/NNN-<slug>.md` following the proofkit ADR conventions already established in capxul-tui (status, context, decision, consequences, supersedes).

| ADR | Title                                       | Owned by ticket |
| --- | ------------------------------------------- | --------------- |
| 001 | Pre-commit hooks via lefthook + lint-staged | Q-2             |
| 002 | Claude plugin scope and architecture        | P-2             |
| 003 | Codex plugin scope and architecture         | P-5             |
| 004 | capsule-factory marketplace integration     | X-2             |
| 005 | Deploy infrastructure (docs host + npm CI)  | X-5             |

## Cross-cutting research checklist (the team does these in M2–M5 prep)

- [ ] Read https://developers.openai.com/codex/plugins/build cover-to-cover; note the manifest format, verbs, lifecycle, install path.
- [ ] Skim Claude Code plugin docs (skill format, MCP server format, slash command format). Inventory what's reusable from existing `.agents/skills/` patterns in capxul.
- [ ] Read https://github.com/Xelmar-tech/capsule-factory README + browse a couple of existing capsules. Understand: what is a "capsule"? What's the install/discovery model? Does proofkit fit?
- [ ] Compare deploy targets: cost, build minutes, custom domain, edge functions (for Fumadocs's Tanstack-Start server functions).
- [ ] Confirm lefthook works under pnpm workspaces — does it run from repo root or per-package? How do we scope hooks to changed files only?

## Dependencies & sequencing

```
M1 (foundation)
   ├── M2 (lefthook)        ──┐
   ├── M3 (docs site)         │
   ├── M4 (plugins)           │── all can run in parallel after M1
   └── M5 (marketplace+deploy)│
                              │
                          Public launch readiness
```

M2 lefthook should land _before_ the team starts opening PRs into the
docs and plugin tickets, otherwise reviewers see formatting noise.

## Definition of done (epic)

- Fresh `git clone` + `pnpm install` + `pnpm test` works.
- Docs site live on a public URL with overview, getting-started, and
  create-next-app tutorial pages rendering.
- Either a Claude plugin OR Codex plugin (whichever lands first)
  installs and exposes one working verb. Second plugin in flight.
- capsule-factory listing exists, even if minimal.
- CI runs lint + typecheck + test + build on every PR.
- MIT license file in repo root.

## Notes / open questions

- **Plugin product question:** what's the smallest verb a Claude/Codex
  plugin would expose that's actually useful? "Scaffold a proof from
  this open TUI"? "Run the proof in this file and open the report"?
  ADR-002 should answer this before code is written.
- **Docs deployment target:** Fumadocs uses Tanstack Start which needs
  edge/serverless function support for the search API. Vercel and
  Cloudflare Pages both support this; pure-static hosts (GitHub Pages)
  don't. Confirm in ADR-005.
- **npm publish gating:** we want a CI workflow that publishes on
  `changeset version` commits to `main`. Standard pattern; ADR-005
  should cite the changesets-action GitHub Action.
- **Cap on plugin scope:** keep the first plugin to ONE useful verb.
  Don't ship a Swiss-army knife with v0.

## Files this epic will create or move (high level)

Source moves (history-preserving):

```
proof-kit/{src,test,examples}    →   packages/tui-proof-kit/{src,test,examples}
.changeset/*                      →   .changeset/* (stays at root)
```

New files (rough inventory):

```
LICENSE                                     (MIT)
lefthook.yml
.github/workflows/{ci,release,docs-deploy}.yml
apps/fumadocs/content/{index,getting-started,tutorial-create-next-app,...}.mdx
apps/claude-plugin/                         (per ADR-002)
apps/codex-plugin/                          (per ADR-003)
docs/adrs/{001..005}-*.md
```

Deletions:

```
tmp/                              (starter kit's old location)
proof-kit/                        (after git mv)
bun.lock                          (replaced by pnpm-lock.yaml)
CLAUDE.md                         (the bun init carry-over; rewrite as a real CLAUDE.md later if useful)
```
