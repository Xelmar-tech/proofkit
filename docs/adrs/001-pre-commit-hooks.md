# ADR-001 — Pre-commit and pre-push hooks via lefthook

- **Status:** Accepted (2026-05-11)
- **Approved by:** team-lead (per Aaron's delegation 2026-05-11)
- **Date:** 2026-05-11
- **Owner:** Aaron (decision); implementer (drafting)
- **Supersedes:** —
- **Superseded by:** —

## Context

M2 of the proofkit monorepo migration calls for local quality gates so
that contributors can't push (and ultimately can't open a PR with)
formatting violations, lint errors, or type errors. Two hook points
matter:

- **Pre-commit** — fast, staged-file-scoped, runs on every `git commit`.
  Auto-formats so contributors don't think about `oxfmt` themselves;
  blocks the commit on lint errors with a clear message.
- **Pre-push** — heavier, whole-workspace-scoped, runs on every
  `git push`. Pushed commits may include files the current diff doesn't
  touch (e.g. you rebased and pulled in a teammate's commit); staged-file
  scoping is the wrong abstraction at push time. This is a correctness
  gate, not a speed gate.

Two practical tools cover both:

1. **lefthook** — single Go binary, single YAML config, native
   staged-file template variable (`{staged_files}`), native auto-restage
   after a fix (`stage_fixed: true`). No Node runtime at hook time.
   One tool.
2. **husky + lint-staged** — two npm packages cooperating. husky owns
   git-hook registration; lint-staged owns staged-file filtering and
   command running. Two configs (husky shell file under `.husky/`,
   plus `.lintstagedrc.json` or a `lint-staged` field in
   `package.json`). Node has to spin up to run lint-staged on every
   commit.

Both auto-restage formatter changes. Both scope by glob. Both
self-install via a `prepare` lifecycle script.

The starter kit promoted in M1 did not ship a pre-commit setup; this is
a clean-slate decision.

## Decision

**Adopt lefthook.** Single config file (`lefthook.yml`) at repo root.
`pnpm prepare` runs `lefthook install` so every fresh clone gets the
git hooks wired automatically. Two hook points configured:

### Pre-commit (staged-file scoped, fast)

Runs two jobs in **parallel** on staged files only:

- `pnpm exec oxfmt --write {staged_files}` with `stage_fixed: true` —
  auto-formats and re-stages.
- `pnpm exec oxlint {staged_files}` — fails the commit on lint errors
  with oxlint's default stderr as the message (rule URL, file:line,
  fix-it hint).

Globs match what each tool actually handles:

- Format: `*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,json,jsonc,md,yml,yaml}`
- Lint: `*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`

lefthook auto-skips jobs whose glob matches zero staged files, so
commits that touch only out-of-glob file types (e.g. `.html`, `.svg`)
pay no cost.

### Pre-push (whole-workspace scoped, correctness gate)

Runs **sequentially with `fail_fast: true`** — second step is cheap
to skip after the first fails:

- `pnpm turbo check-types` — type-checks every workspace package that
  exposes a `check-types` task. Turbo caches per-package, so this is
  near-instant on a no-op push.
- `pnpm check` — runs `oxlint && oxfmt --check` at the repo root.
  `--check` (read-only) NOT `--write` (mutating) because pre-push is
  a gate, not an auto-fixer.

To make this contract honest, the root `pnpm check` script flipped
from `oxlint && oxfmt --write` to `oxlint && oxfmt --check`. A
separate `pnpm format` script (= `oxfmt --write`) replaces the
auto-write path for interactive use.

Both checks operate on the whole workspace, not staged files. Pushed
commits may include files unchanged in the current diff (rebases,
amended history, branch-with-multiple-commits push) — staged-file
scoping is the wrong abstraction at push time.

Hard-reject on any non-zero exit. No documented `--no-verify`
carve-out. Per Aaron: **"you should not be able to make a PR whatsoever
with any type check errors in it."** This is the standing rule going
forward, not just for proofkit.

## Rationale

### Why lefthook over husky+lint-staged

1. **One tool over two.** husky+lint-staged is the dominant JS pattern
   for historical reasons — the primitives (file globbing, restaging)
   had to be assembled across two packages. lefthook collapses both
   responsibilities into one binary with one config. Less moving
   surface, fewer abstractions to teach a contributor.
2. **No Node startup tax.** lefthook is a Go binary (~30 ms cold);
   husky+lint-staged spin up Node (~100–300 ms cold) before they spin
   up oxlint / oxfmt (themselves Rust binaries). Per the project's
   direction toward fast native tooling (oxlint, oxfmt, turbo), the
   alignment is cleaner.
3. **Native staged-file variable + auto-skip.** `{staged_files}` is
   built in with glob-based filtering; lint-staged exposes the same
   capability but through a JSON DSL that maps globs to commands. The
   lefthook YAML is shorter for this exact use case.
4. **Project convention.** The starter already pulled oxlint + oxfmt
   (Rust-native) and turbo (Go-native). lefthook fits that family.

### Why pre-push is whole-workspace and `--check`-only

Per Aaron: pre-push is a correctness gate, not a speed gate. The
staged-file model only describes "the files changed in the _current_
diff." A push event ships _all_ commits between local HEAD and the
remote ref, which may include commits authored at a different time
(rebased in, cherry-picked) whose files aren't in the current staged
set. Type errors and lint errors in those files would slip through if
we scoped pre-push the same way we scope pre-commit.

`oxfmt --check` (not `--write`) at push time because pre-push is a
gate, not an auto-fixer. If formatting is wrong at push time, the
contributor needs to know — not have their working tree silently
mutated by a hook running outside the commit they thought they were
making.

## Configuration shape

`lefthook.yml` at repo root (this is the file landed in Phase C):

```yaml
pre-commit:
  parallel: true
  jobs:
    - name: format
      glob: "*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,json,jsonc,md,yml,yaml}"
      run: pnpm exec oxfmt --write {staged_files}
      stage_fixed: true

    - name: lint
      glob: "*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
      run: pnpm exec oxlint {staged_files}

pre-push:
  parallel: false
  fail_fast: true
  jobs:
    - name: check-types
      run: pnpm turbo check-types

    - name: check
      run: pnpm check
```

Root `package.json` additions:

```jsonc
{
  "scripts": {
    "prepare": "lefthook install",
    "check": "oxlint && oxfmt --check",
    "format": "oxfmt --write",
  },
  "devDependencies": {
    "lefthook": "^1.13.6",
  },
}
```

Note the `pnpm exec` prefix on the pre-commit jobs: lefthook executes
hook commands in a shell that does not put `node_modules/.bin` on
PATH, so the workspace-local oxlint/oxfmt binaries need explicit
resolution via `pnpm exec`.

## Perf budget

### Pre-commit: < 1.5 s for a typical commit (≤ 20 files)

oxlint benchmarks at ~50× ESLint on equivalent rulesets; oxfmt at ~10×
prettier. lefthook startup ≈ 30 ms. Both jobs run in parallel.
Sub-second is the realistic expectation; 1.5 s leaves headroom for the
cold-FS-cache first run after a `git pull`. Escalate before optimizing
if we measurably exceed 1.5 s.

### Pre-push: 5–30 s depending on turbo cache state

Pre-push is heavier. `pnpm turbo check-types` typechecks every package
with a `check-types` task; on a warm turbo cache (every package
unchanged since last typecheck) this is near-instant (~500 ms),
dominated by turbo's own scheduling. On a cold cache or after a
significant change, expect a few seconds per package — currently 1
package (`tui-proof-kit`) with a real `check-types` task, so 1–3 s is
plausible. As we add packages (fumadocs in M3, plugins in M4), pre-push
will scale linearly until turbo's cache catches up between runs.

`oxlint . && oxfmt --check .` over the whole workspace is sub-second
for both — order-of-magnitude estimate based on oxc benchmarks; will
measure in Phase C.

**Honest realistic budget: 5–30 s.** Correctness gate > speed gate at
push time. If pre-push exceeds 30 s in practice, escalate before adding
parallelism tricks or skipping checks.

## Consequences

**Positive**

- One config file, one binary, one mental model.
- Pre-commit auto-formats so contributors don't think about `oxfmt`.
- Pre-push catches the "I rebased and broke a file I didn't touch"
  class of bug locally rather than in CI — same gate, much faster
  feedback loop.
- "You can't open a PR with type errors" becomes a structural property,
  not a discipline property.

**Negative / trade-offs**

- lefthook is less ubiquitous in the JS ecosystem than husky+lint-staged.
  Contributors who haven't seen it need ~60 s with the `lefthook.yml`
  to orient.
- A Go binary becomes a `devDependencies` entry. lefthook ships
  prebuilts for macOS/Linux/Windows via npm, so this is invisible in
  practice; flagging because the project is otherwise pnpm-pure.
- `stage_fixed: true` rewrites the staged version of a file during the
  commit. Unstaged edits in the same file stay unstaged (lefthook only
  touches the index, not the working tree). Same behavior as
  lint-staged; surfacing because it occasionally surprises people.
- Pre-push will get slower as the monorepo grows. We accept this
  explicitly — turbo's caching is the answer, not gate-removal.

**Neutral**

- The hook does not run `pnpm test`, `pnpm build` on pre-push. Tests
  and builds run in CI (M5 X-7). Local pre-push gates correctness
  (types + lint + format), not full validation.

## Final decisions baked in

- **Tool:** lefthook (over husky + lint-staged).
- **Pre-commit glob:** `.ts, .tsx, .mts, .cts, .js, .jsx, .mjs, .cjs,
.json, .jsonc, .md, .yml, .yaml` for the format step; same minus the
  non-JS extensions for the lint step. Globs match what each tool
  actually handles — no over-globbing.
- **No commit-msg hook.** The changeset workflow already prompts for
  change type at version time; author discipline + the changesets
  prompt beat a regex.
- **No pre-push staged-file scoping.** Pre-push is whole-workspace.
- **No `--no-verify` carve-out.** Hard-reject on any non-zero exit.

## How M2 acceptance maps to this ADR

> M2 acceptance: committing a file with a formatting violation gets
> auto-fixed and re-staged. Committing a file with a lint error blocks
> the commit with a clear message.

- "Auto-fixed and re-staged" satisfied by the pre-commit `format` job
  (`oxfmt --write {staged_files}` + `stage_fixed: true`).
- "Blocks the commit with a clear message" satisfied by the pre-commit
  `lint` job — non-zero exit aborts the commit, oxlint's stderr is the
  clear message.

The pre-push additions go beyond the original M2 acceptance criteria.
They land here because Aaron's standing "no PR with type errors" rule
makes pre-push the natural enforcement point.
