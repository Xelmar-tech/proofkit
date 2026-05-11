# Proofkit epic — handoff (paused 2026-05-11)

Team `proofkit-epic-monorepo-migration` was driving EPIC.md. Paused to conserve token budget. Resume with `/orchestrate` pointed at this repo + EPIC.md.

## State of the world

- Repo: `~/projects/capxul/proofkit/` — monorepo, pnpm + turbo + oxlint + oxfmt + Fumadocs + changesets.
- **M1 Foundation merge: DONE and merged to `main`** (commit `b15bd4f` originally; merge SHA TBD per implementer's last run). All acceptance met: install/test/build/check/check-types clean; showcase snapshot 04 ≤ 10 lines; history-preserving renames. MIT license applied. Changeset access stays `restricted` until M5/X-6.
- 7 ratified deviations from EPIC.md (esbuild override, ignoreDeprecations, noEmit+ts-imports, pnpm-workspace.yaml move, packages/config exports map, MIT workspace-wide, .gitignore extension). All accepted; no rollback needed.
- **M2 Quality gates: DONE** — SHA `f7c2bb7`. All 4 acceptance criteria empirically verified (format violation auto-fixed + restaged; lint error blocked commit; type error blocked push; clean workspace pushes cleanly). ADR-001 accepted (lefthook over husky+lint-staged). Pre-commit = `oxfmt --write` + `oxlint` parallel on staged files. Pre-push = whole-workspace `pnpm turbo check-types` + `check`, `oxfmt --check`, hard-reject. `.mts`/`.cts` in glob. No commit-msg hook. `pnpm prepare` → `lefthook install`. Check branch state on resume; merge to main if not already.
- **M3 Docs site: PENDING** — blocked on M2 landing.
- **M4a Claude plugin + M4b Codex plugin: ADRs DRAFTED, awaiting sign-off.** Both target vertical-plugin shape + shared `packages/plugin-shared/` + the verb `scaffold-proof <tui-path>`. ADR-002 + ADR-003 at `docs/adrs/`. 10 trivial sub-decisions queued (see below).
- **M5a marketplace + M5b deploy: PENDING** — blocked on M1 merge (done) but not yet dispatched.

## Open ADR sub-decisions (10, low-stakes)

ADR-002:

1. Output dir: proposed `tests/proofs/<basename>.proof.ts` ✓
2. Collision: error + suggest `--force` ✓
3. Template language: TS only ✓
4. Plugin name: `tui-proof-kit` ✓
5. Telemetry: none ✓

ADR-003 (Codex):

1. Hook docs revisit: wait for use case, TODO note in manifest ✓
2. Interface block: minimum useful for v0 ✓
3. `.mcp.json`: no ✓
4. Plugin name: `tui-proof-kit` (parity) ✓
5. Cross-plugin install test: yes, document catalog-sharing in README ✓

All ten proposals are reasonable — sign all off as-proposed on resume unless something jumps out.

## Durable decisions already made (don't relitigate)

- Build framework: turborepo + pnpm + oxlint + oxfmt + Fumadocs.
- License: MIT, workspace-wide.
- Plugin verb (both clients): `scaffold-proof <tui-path>`.
- Plugin shape: vertical plugin per capsule-factory pattern, shared `packages/plugin-shared/` for core logic.
- Marketplace catalog: one `.claude-plugin/marketplace.json` shared by Claude + Codex (analyst's finding).
- Pre-push gate: typecheck + lint + format(--check), hard-reject, no `--no-verify` carve-outs.
- ADR sign-off authority delegated to assistant (Aaron approval recorded).

## Reference paths

- Epic: `EPIC.md` (repo root)
- ADRs: `docs/adrs/001-pre-commit-hooks.md`, `002-claude-plugin.md`, `003-codex-plugin.md`
- Research: `docs/research/M2-lefthook.md`, `docs/research/M4-plugin-patterns.md` (incl. Codex hooks 404 finding §5a)
- Plugin pattern reference: `~/projects/capxul/capsule-factory/plugins/vertical-plugins/pm-core/` (vertical) and `plugins/agent-plugins/implementer/` (agent)
- Living dashboard: `reports/2026-05-11-epic-monorepo-migration.html`
- Team config: `~/.claude/teams/proofkit-epic-monorepo-migration/config.json`
- Task list: `~/.claude/tasks/proofkit-epic-monorepo-migration/`

## Resume protocol

1. `cd ~/projects/capxul/proofkit && git log --oneline -5` — confirm M2 SHA `f7c2bb7` is in the tree. If on a branch, merge to main.
2. Sign off ADR-002 + ADR-003 (proposals above all green-lit; just rubber-stamp).
3. `/orchestrate` again — same team name, same EPIC.md, conductor resumes from task #3 onward.
4. Fan out wave 2: M3 docs + M4a Claude plugin build + M5a capsule listing (ADR-004 drafting).
5. Wave 3: M4b Codex build after M4a sets `packages/plugin-shared/` shape; M5b deploy infra (ADR-005).
6. Final: qa-capture full-epic verify report → final sign-off → close.

## Known unknowns

- M2 branch SHA at time of pause — check git log on resume.
- ADR-004 (capsule-factory listing) + ADR-005 (deploy infra) not yet drafted. Both will surface during M5 dispatch.
- GitHub remote for proofkit doesn't exist yet — must be created before M5b deploy CI lands.

## Token budget note

Paused at 5% weekly budget remaining. Team agents (implementer, analyst, qa-capture, debug-guru, conductor) were spawned but are idle. They'll be cleaned up by team TTL or can be explicitly shut down. Spawning fresh next week is fine — EPIC.md + this handoff + the ADRs on disk reconstitute full context.
