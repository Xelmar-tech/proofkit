# M2 research — lefthook under pnpm workspaces

Status: research notes only. ADR-001 to follow after direction sign-off.
Author: implementer agent, 2026-05-11.

## 1. lefthook + pnpm workspaces

lefthook is monorepo-agnostic — it operates at the git-repo level, not
the package level. Config discovery looks for one of `lefthook.yml`,
`.lefthook.yml`, or `.config/lefthook.yml` at the repo root and stops
there (lefthook.dev/configuration/). There's no per-package config
search; pnpm workspaces don't change this. The single root config is
exactly what we want: one file, one mental model.

Hook commands run with their cwd set to the **repo root**, not the
package directory. This matters for our setup: `oxlint` and `oxfmt`
both walk up to find their nearest `.oxlintrc.json` / `.oxfmtrc.json`,
which are already at the repo root in the M1 layout. So root-cwd is
the correct cwd; we don't need lefthook's `root:` per-job option.

Scoping to staged files is native via the `{staged_files}` template
variable. lefthook applies the job's `glob:` filter first, then
substitutes the (possibly empty) filtered list. Confirmed via the
lefthook configuration docs (lefthook.dev/configuration/, "Filter
files" section). Jobs whose glob matches zero staged files are
**auto-skipped**, so commits that only touch markdown / yml / json
won't spin up the toolchain at all. `stage_fixed: true` re-stages
files the command modified in place (oxfmt's `--write` mode), which
covers the M2 acceptance requirement that formatting fixes land in
the same commit.

## 2. Why not husky + lint-staged

lint-staged works standalone (husky isn't required — you can write the
pre-commit shell hook by hand), and it does auto-restage formatter
edits: "lint-staged will automatically add any modifications to the
commit as long as there are no errors" (github.com/lint-staged/lint-staged).
So functionally, lint-staged is equivalent. The difference is shape:

- **lint-staged** is a Node CLI that needs to spin up to do staged-file
  filtering before delegating to oxlint/oxfmt. That's one Node startup
  per commit — on the order of 100–300 ms — added to every hook
  invocation. Configuration lives in `.lintstagedrc.json` (or
  `lint-staged` field in package.json), and you separately wire up
  the git hook itself (husky shell file, or a hand-rolled
  `.git/hooks/pre-commit`).
- **lefthook** is a single Go binary that does both jobs (hook
  registration + staged-file filtering + command execution) in one
  process. Config is one YAML file. Cold startup is ~30 ms (Go, no
  runtime).

Both work. lefthook is the EPIC's directional choice and the cleaner
fit for a Rust/Go-native toolchain (oxlint, oxfmt, turbo). The
trade-off is ecosystem familiarity: husky+lint-staged is the default
JS pattern most contributors have seen. lefthook needs ~60 seconds
of orientation on a contributor's first read of `lefthook.yml`.

## 3. oxlint and oxfmt CLI sanity check

Both accept positional file lists. Confirmed locally on the M1
branch:

```
$ oxlint --help
Usage: [-c=<./.oxlintrc.json>] [PATH]...

$ oxfmt --help
Usage: [-c=PATH] [PATH]...
Output Options:
    --write           Format and write files in place (default)
    --check           Check if files are formatted, also show statistics
```

So `oxlint {staged_files}` and `oxfmt --write {staged_files}` are
straightforward — no xargs, no `--stdin-filepath`, no glob expansion
inside the command. oxfmt's `--write` is its default mode, so we can
spell the format job either way; explicit `--write` is clearer for
hook-config readers.

oxfmt also has `--no-error-on-unmatched-pattern` which becomes
relevant if lefthook _doesn't_ skip empty-glob jobs (it does — see §1
— but worth noting as a belt-and-suspenders fallback).

## 4. Performance

lefthook's parallel mode (`parallel: true` at the hook level) runs
all matching jobs concurrently. For our two-job setup (format + lint)
that's a measurable win: the lint job doesn't wait on the format job
to finish writing files. lefthook claims a benchmark of ~1.5× faster
than husky+lint-staged on equivalent workloads (lefthook README); the
delta is dominated by the Node startup cost we noted in §2 rather
than by lefthook itself being algorithmically faster.

Hard numbers for our specific stack would need an actual install to
measure. The order-of-magnitude expectation: on a 20-file commit
touching only TS, both jobs finish under ~500 ms (oxlint is ~50×
faster than ESLint on the same ruleset per the oxc benchmark page;
oxfmt is in the same family). That's well inside any reasonable
perf budget for a pre-commit hook.

## 5. Findings summary

No red flags. lefthook is a clean fit:

- One root config file; pnpm workspaces don't complicate anything.
- Native staged-file filtering with auto-skip on empty globs.
- `stage_fixed: true` satisfies the M2 acceptance "auto-fixed and
  re-staged" requirement directly.
- oxlint + oxfmt accept argv file lists, so command shape is
  trivial.
- Parallel job execution available out of the box.

Recommendation: proceed to ADR-001 drafting once direction is
confirmed. Open questions for the ADR phase: glob extension set
(include `.mts`/`.cts`?), commit-msg hook scope (Conventional
Commits enforcement — proposed: skip for v0), pre-push hook scope
(proposed: nothing — CI catches what pre-commit misses).
