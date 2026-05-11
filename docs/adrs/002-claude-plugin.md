# ADR-002 — Claude Code plugin (`scaffold-proof` verb)

- **Status:** Accepted (2026-05-11)
- **Approved by:** team-lead (per Aaron's delegation 2026-05-11)
- **Date:** 2026-05-11
- **Owner:** Aaron (decision); analyst (drafting)
- **Supersedes:** —
- **Superseded by:** —
- **Related:** ADR-003 (Codex plugin, mirror), ADR-004 (capsule-factory listing, deferred)
- **Research input:** `docs/research/M4-plugin-patterns.md`

## Context

M4 of the proofkit monorepo migration calls for a Claude Code plugin
(ticket P-3) that exposes at least one verb calling into
`tui-proof-kit`. EPIC.md §"Notes / open questions" caps v0 scope at
**one** verb and asks ADR-002 to nail down which one.

Pre-decisions inherited from the research briefing and the
epic-conductor's product call:

- **Verb:** `scaffold-proof <tui-path>` — generate a proof file skeleton
  for the TUI at the given path. Lowest-friction verb that creates new
  value the bare CLI doesn't trivially provide (briefing §5 Q1, option A).
- **Shape:** vertical-plugin (skills + slash command), not an agent.
  Reference: capsule-factory's `pm-core` at
  `/Users/abuusama/projects/capxul/capsule-factory/plugins/vertical-plugins/pm-core/`.
- **Catalog:** a single `.claude-plugin/marketplace.json` at proofkit
  repo root; Codex reads it too (briefing §3.6), so the same catalog
  also lists the Codex plugin in ADR-003.
- **Shared code:** thin manifest app over a `packages/plugin-shared/`
  package; both plugin apps consume it.

## Decision (proposed)

Build `apps/claude-plugin/` as a Claude Code vertical-plugin exposing
one slash command and one auto-invocable skill, both backed by a
shared `packages/plugin-shared/` package that owns the scaffolding
logic. Register it in a root-level `.claude-plugin/marketplace.json`.

### Directory layout

```
proofkit/
├── .claude-plugin/
│   └── marketplace.json                          # catalog (both plugins)
├── apps/
│   └── claude-plugin/
│       ├── .claude-plugin/
│       │   └── plugin.json                       # {name, version, description}
│       ├── commands/
│       │   └── scaffold-proof.md                 # /scaffold-proof
│       ├── skills/
│       │   └── scaffold-proof/
│       │       └── SKILL.md                      # auto-invocable workflow
│       ├── package.json                          # depends on plugin-shared
│       └── README.md
└── packages/
    └── plugin-shared/
        ├── src/
        │   ├── index.ts                          # exports scaffoldProof()
        │   ├── scaffold.ts                       # core logic
        │   └── templates/
        │       └── proof.ts.tmpl                 # the generated file shape
        ├── package.json
        └── tsconfig.json
```

### What `scaffold-proof <tui-path>` does

Given a path to a TUI entrypoint (file path or shell command), the
verb produces a runnable proof file at a sibling location:

1. Resolve `<tui-path>`. Accept either:
   - A file path to a script (`./my-cli.ts`, `./bin/app.js`).
   - A bare command string with optional args (`my-cli`, `npx create-next-app`).
2. Infer the launch invocation: file path → derive `command`/`args`
   from extension + interpreter; bare command → split on whitespace
   into `command` + `args[]`.
3. Pick an output path. Default: `proofs/<basename>.proof.ts` under
   the current working directory. If the file already exists, append
   a numeric suffix or abort with a clear message (see "open questions"
   below).
4. Emit a TypeScript file from the template in `plugin-shared/src/templates/proof.ts.tmpl`.
   The template is minimal — one `defineProof({ ... })` call with the
   inferred launch invocation, an empty `steps: []`, and inline
   comments pointing at the public API (`expectText`, `expectSnapshot`,
   `type`, `press`). Contributors fill in the steps themselves; the
   verb does NOT attempt to introspect the running TUI.
5. Print the resulting file path and a one-liner showing how to run it
   (`node --experimental-strip-types proofs/<name>.proof.ts`).

### Skill (`apps/claude-plugin/skills/scaffold-proof/SKILL.md`)

Auto-invocable. Frontmatter mirrors capsule-factory conventions
(`name`, `version`, `description`). Description fires on phrases like
"scaffold a proof for X", "write a proofkit harness for this TUI",
"give me a starting proof file". Body is a 5-step workflow:

1. Confirm or solicit `<tui-path>`.
2. Call `scaffoldProof({ tuiPath, outDir })` from `plugin-shared`.
3. Read back the generated file, print it inline.
4. Suggest the next 1–2 steps the user is likely to fill in
   (typically: an `expectText` matching the TUI's first prompt).
5. Stop. Do not run the proof; do not modify other files.

### Slash command (`apps/claude-plugin/commands/scaffold-proof.md`)

Thin wrapper following capsule-factory's pattern
(`pm-core/commands/orchestrate.md:1-10`). Frontmatter:

```yaml
---
description: Scaffold a proofkit proof file for a TUI
argument-hint: '<tui-path-or-command> (e.g. ./my-cli.ts or "npx create-next-app")'
---
```

Body: `Load skill: **scaffold-proof**. The user invoked /scaffold-proof
with $ARGUMENTS. Apply the scaffold-proof skill...` — one paragraph,
no logic.

### Shared package (`packages/plugin-shared/`)

Exports one function:

```ts
export function scaffoldProof(input: {
  tuiPath: string;
  outDir?: string; // default: "proofs/" relative to CWD
  onCollision?: "suffix" | "abort";
}): { path: string; contents: string };
```

No I/O above the file write itself. Pure mapping from input to
generated file. Unit-testable in isolation. ADR-003 reuses this exact
function from the Codex plugin's skill body.

### Catalog entry (`.claude-plugin/marketplace.json`)

Single root-level catalog per the briefing's finding that Codex reads
this file too. Initial shape (just the Claude entry; ADR-003 adds the
Codex entry):

```json
{
  "name": "proofkit",
  "owner": { "name": "Capxul", "email": "aaron@capxul.com" },
  "plugins": [
    {
      "name": "proofkit-claude",
      "source": "./apps/claude-plugin",
      "description": "Scaffold proofkit proof files for terminal apps."
    }
  ]
}
```

Per capsule-factory's `CLAUDE.md:24-29` rule, no non-spec fields. The
plugin's `name` matches its `.claude-plugin/plugin.json#name`.

### How `tui-proof-kit` is consumed

The Claude plugin does **not** depend on `tui-proof-kit` at runtime.
It only generates a TS file that imports from `tui-proof-kit` when the
user runs it. `plugin-shared` is the only runtime dependency.
`tui-proof-kit` shows up only as a string literal in the template
(`import { defineProof } from "tui-proof-kit";`).

This avoids version-coupling the plugin to the framework: the user's
project picks the framework version via its own `package.json`, the
plugin doesn't enforce one.

## Rationale

### Why `scaffold-proof` for v0

From briefing §5 Q1 scoring: `scaffold-proof` is the only candidate
that produces value the bare CLI can't trivially provide. `run-proof`
duplicates `node --experimental-strip-types <file>` and adds nothing.
`open-capture` depends on a capture format that hasn't stabilized.

### Why one verb, not a small set

EPIC.md is explicit: _"Cap on plugin scope: keep the first plugin to
ONE useful verb. Don't ship a Swiss-army knife with v0."_ This ADR
honors that. Future verbs (`run-proof`, `open-capture`, `regen-snapshots`)
are deferred to a follow-up ADR after v0 ships and we see real usage.

### Why vertical-plugin (not agent)

Per briefing §2: the verb is short-lived, stateless, doesn't own a
multi-turn workflow. An agent persona would add ceremony with no
value. Capsule-factory's `pm-core` is the canonical example of this
shape.

### Why a shared package

Briefing §5 Q3 recommendation. The verb logic is the asset; the two
plugin manifests are just two distribution channels. Duplicating the
implementation in two `SKILL.md` files risks drift between Claude and
Codex behavior, which is exactly what we don't want.

### Why no TUI introspection

A more ambitious `scaffold-proof` could launch the TUI, observe its
first prompt, and pre-fill an `expectText` step. We deliberately do
not do that in v0 because:

1. Launching arbitrary user commands at scaffold time is a security
   surface we don't want to commit to without thought.
2. Many TUIs need env / cwd / sandbox setup before they boot
   meaningfully (see the showcase's `SANDBOX_HOME` dance in
   `packages/tui-proof-kit/examples/drive-create-next-app.ts:25-66`).
   Best-effort introspection would mislead more than help.
3. Skill cost: a static template ships now; introspection is a future
   verb.

## Acceptance criteria

A reviewer with a fresh clone of proofkit can do this end-to-end:

1. `pnpm install` from repo root succeeds.
2. `/plugin marketplace add ~/projects/capxul/proofkit` registers the
   catalog in their Claude Code instance.
3. `/plugin install proofkit-claude@proofkit` installs the plugin.
4. In any other repo, typing `/scaffold-proof ./some-cli.ts` produces
   a file at `proofs/some-cli.proof.ts` whose first line is
   `import { defineProof } from "tui-proof-kit";` and whose body is a
   minimal but valid `defineProof({ ... }).run({ ... })` call.
5. `node --experimental-strip-types proofs/some-cli.proof.ts` runs
   without throwing on syntax or import errors. (It may fail to drive
   the TUI — that's expected; the user fills in `steps` themselves.)
6. Unit test in `packages/plugin-shared/` covers the pure
   `scaffoldProof()` mapping with at least three inputs: file path,
   bare command, command-with-args.

EPIC.md M4 acceptance is satisfied by (4) for the Claude side; ADR-003
covers the Codex side of the same acceptance.

## Consequences

**Positive**

- Single shared package means Claude and Codex behave identically
  by construction.
- No runtime dependency on `tui-proof-kit` means the plugin doesn't
  pin framework versions; users pick their own.
- One verb keeps the maintenance surface small and the docs simple.
- Catalog at repo root serves both plugins from one file.

**Negative / trade-offs**

- Users with an existing `proofs/` directory may be confused by file
  collisions. Default `onCollision: "suffix"` softens this; abort is
  available as an explicit choice.
- No TUI introspection means the scaffolded file always needs hand
  editing before it does anything useful. We accept this; introducing
  a "run a stranger's CLI to inspect it" step in v0 is the wrong
  trade.
- Three moving parts (skill, command, shared package) for one verb is
  more files than feels strictly necessary, but each part is small
  and each is required by Claude's plugin model.

**Neutral**

- The plugin does not interact with the user's git tree (no commits,
  no staging). The generated file lands on disk; the user decides
  what to do with it.

## Open questions for sign-off

- **(a) Output directory default (resolved):** `proofs/` under CWD. Accepted.
- **(b) Collision policy default (resolved):** `suffix` as default (`my-cli.proof.ts` → `my-cli.proof.2.ts`); document `abort` as an option in the skill body. Accepted.
- **(c) Template language (resolved):** TypeScript-only for v0. Accepted.
- **(d) Plugin name in the catalog (resolved):** `proofkit-claude` (paired with `proofkit-codex` in ADR-003). Accepted.
- **(e) Telemetry / opt-in usage reporting (resolved):** None for v0. Accepted.

## How M4 acceptance maps to this ADR

> M4 acceptance: both plugins install locally and expose at least one
> verb that calls into `tui-proof-kit` (e.g. "run this proof file" or
> "scaffold a proof for this TUI").

- "Install locally" satisfied by acceptance criteria (1)–(3).
- "Expose at least one verb that calls into `tui-proof-kit`"
  satisfied by (4)–(5). The verb's _output_ calls into
  `tui-proof-kit`; the verb itself shells out via the shared package.
  Both interpretations of "calls into" are honored.

ADR-003 carries the Codex half of the same acceptance.
