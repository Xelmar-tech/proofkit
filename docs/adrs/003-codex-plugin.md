# ADR-003 — Codex plugin (`scaffold-proof` verb)

- **Status:** Accepted (2026-05-11)
- **Approved by:** team-lead (per Aaron's delegation 2026-05-11)
- **Date:** 2026-05-11
- **Owner:** Aaron (decision); analyst (drafting)
- **Supersedes:** —
- **Superseded by:** —
- **Related:** ADR-002 (Claude plugin, primary spec), ADR-004 (capsule-factory listing, deferred)
- **Research input:** `docs/research/M4-plugin-patterns.md` (esp. §3, §4, §5a)

## Context

M4 ticket P-6 calls for a Codex plugin mirroring the Claude plugin's
verb. EPIC.md M4 acceptance requires "both plugins install locally
and expose at least one verb that calls into `tui-proof-kit`."

Pre-decisions inherited from ADR-002 and the briefing:

- **Verb:** `scaffold-proof <tui-path>` — identical scope and behavior
  to ADR-002's verb.
- **Shape:** vertical-plugin-equivalent (skill + manifest). Codex does
  not have first-class slash commands; the skill carries the verb.
- **Catalog:** the same root-level `.claude-plugin/marketplace.json`
  ADR-002 introduces. Codex reads Claude's catalog format
  (briefing §3.6).
- **Shared code:** same `packages/plugin-shared/` package as ADR-002.

This ADR mirrors ADR-002 and **only specifies the divergences forced
by Codex's plugin model**. Everything not explicitly diverged below
follows ADR-002 verbatim.

## Decision (proposed)

Build `apps/codex-plugin/` as a Codex plugin that exposes
`scaffold-proof` via a single auto-invocable skill, backed by the
same `packages/plugin-shared/` package ADR-002 introduces. List it as
a second entry in the same root-level `.claude-plugin/marketplace.json`.

### Directory layout

```
proofkit/
├── .claude-plugin/
│   └── marketplace.json                          # shared catalog
└── apps/
    └── codex-plugin/
        ├── .codex-plugin/
        │   └── plugin.json                       # Codex manifest
        ├── skills/
        │   └── scaffold-proof/
        │       └── SKILL.md                      # auto-invocable workflow
        ├── assets/
        │   ├── icon.png
        │   └── logo.png
        ├── package.json                          # depends on plugin-shared
        └── README.md
```

### What `scaffold-proof <tui-path>` does

Identical to ADR-002's verb. Same inputs, same outputs, same template,
same shared-package call (`scaffoldProof()` from
`packages/plugin-shared/`). No Codex-specific behavior.

### Skill (`apps/codex-plugin/skills/scaffold-proof/SKILL.md`)

Frontmatter and body are the same as ADR-002's skill. Per briefing §3.3,
Codex skill format is "effectively identical" to Claude's:
`{name, description}` frontmatter, markdown body, auto-invocable on
description match. No divergence required.

### No slash command

Per briefing §4 feature-parity matrix: Codex does not document
first-class slash commands. The skill is the only invocation surface;
its frontmatter `description` carries the auto-invocation contract,
and the manifest's `interface.defaultPrompt` (below) carries the UX
hint.

This is the largest divergence from ADR-002. It is forced by Codex's
plugin model, not chosen.

### Manifest (`apps/codex-plugin/.codex-plugin/plugin.json`)

Per briefing §3.2. Required core fields plus the Codex-specific
`interface` block for marketplace presentation:

```json
{
  "name": "proofkit-codex",
  "version": "0.1.0",
  "description": "Scaffold proofkit proof files for terminal apps.",
  "skills": "./skills/",
  "author": {
    "name": "Capxul",
    "email": "aaron@capxul.com",
    "url": "https://capxul.com"
  },
  "homepage": "https://github.com/capxul/proofkit",
  "repository": "https://github.com/capxul/proofkit",
  "license": "MIT",
  "keywords": ["tui", "testing", "snapshot", "proofkit"],
  "interface": {
    "displayName": "Proofkit",
    "shortDescription": "Scaffold proofs for terminal apps.",
    "longDescription": "Generate a runnable tui-proof-kit harness for any TUI in one command.",
    "category": "Testing",
    "capabilities": ["Read", "Write"],
    "defaultPrompt": "Scaffold a proof file for the TUI at ./my-cli.ts",
    "composerIcon": "./assets/icon.png",
    "logo": "./assets/logo.png",
    "websiteURL": "https://proofkit.capxul.com"
  }
}
```

### No `.mcp.json`

The verb is a pure file-emission operation; it does not need an MCP
server. Per briefing §3.4, `.mcp.json` is optional and we omit it.

### No `.app.json`

No app/connector mappings needed for v0.

### No `hooks/`

**Deliberate omission.** Per briefing §5a (the hook-events follow-up
fetch), Codex's hook surface is publicly undocumented beyond "a slot
exists." There is no enumerated event list, no payload schema, no
exit-code contract, and no public `hooks.json` example.

Shipping a hooks file in v0 would either:

- Commit to unspecified behavior (fragile across Codex versions), or
- Carry an empty/no-op hooks.json (pointless surface area).

Neither is good. The `scaffold-proof` verb runs when the skill
auto-invokes or when the user explicitly requests it; no install-time,
session-start, or pre-tool-use lifecycle is required for v0 scope.

Revisit when Codex publishes a hooks reference, OR when a v0.2+ verb
needs lifecycle integration (e.g. auto-running a proof on file save).

### Catalog entry

Appended to the same root-level `.claude-plugin/marketplace.json`
ADR-002 introduces. Codex reads this file (briefing §3.6) so one
catalog serves both clients:

```json
{
  "name": "proofkit",
  "owner": { "name": "Capxul", "email": "aaron@capxul.com" },
  "plugins": [
    {
      "name": "proofkit-claude",
      "source": "./apps/claude-plugin",
      "description": "Scaffold proofkit proof files for terminal apps."
    },
    {
      "name": "proofkit-codex",
      "source": "./apps/codex-plugin",
      "description": "Scaffold proofkit proof files for terminal apps."
    }
  ]
}
```

Codex's richer catalog entry shape with `source: {source: "local",
path: ...}` and `policy` (briefing §3.6) is **deferred to ADR-004**
(capsule-factory marketplace integration). For v0 local install, the
Claude-compatible flat shape is enough; Codex accepts it.

### How `tui-proof-kit` is consumed

Same as ADR-002. The Codex plugin does not depend on `tui-proof-kit`
at runtime — only `plugin-shared`. The framework name appears only as
a string literal in the generated template.

## Rationale

### Why mirror ADR-002 instead of diverging

The user-visible verb is `scaffold-proof <tui-path>` in both clients.
If the two plugins behaved differently, the docs would have to
maintain a divergence matrix and contributors would have to remember
which client they're in. The shared package + identical skill body
makes drift impossible by construction.

### Why no hooks (Codex-specific divergence)

See §"No `hooks/`" above. The choice is forced by missing public
docs, not by a design preference. If Codex publishes a hooks
reference before P-6 ships, revisit this decision; it's the cheapest
part of the ADR to flip.

### Why a separate plugin directory rather than a polyglot manifest

Codex looks for `.codex-plugin/plugin.json`; Claude looks for
`.claude-plugin/plugin.json`. They could theoretically share a
parent directory with both manifest dirs side by side, but:

1. Each manifest has different required fields (Codex's `interface`
   block, Claude's lighter spec).
2. Each may grow surface-specific files (Codex's `assets/`,
   `.mcp.json`).
3. Separate directories keep the diffs readable when one client's
   spec evolves.

The cost — a tiny amount of duplication in `package.json` and
`README.md` — is worth the readability.

### Why the same catalog file

Briefing §3.6: Codex explicitly reads `.claude-plugin/marketplace.json`.
A single file at repo root is the smallest correct catalog surface;
splitting would just create a sync burden.

## Acceptance criteria

A reviewer with a fresh clone of proofkit can do this end-to-end:

1. `pnpm install` from repo root succeeds.
2. `codex plugin marketplace add ~/projects/capxul/proofkit`
   registers the catalog.
3. `codex plugin install proofkit-codex@proofkit` (or the equivalent
   first-class command surface Codex provides) installs the plugin.
4. In any other directory, prompting Codex with "scaffold a proof for
   ./some-cli.ts" auto-invokes the `scaffold-proof` skill and produces
   `proofs/some-cli.proof.ts`. The generated file is **byte-identical**
   to what the Claude plugin produces for the same input.
5. `node --experimental-strip-types proofs/some-cli.proof.ts` runs
   without throwing on syntax or import errors.
6. The unit test added in ADR-002 (in `packages/plugin-shared/`)
   continues to pass — the Codex plugin needs no separate test for
   the verb logic.

EPIC.md M4 acceptance is satisfied by (4) for the Codex side; ADR-002
covers the Claude side.

## Consequences

**Positive**

- One shared package guarantees identical Claude/Codex behavior.
- One catalog file serves both clients.
- Codex `interface` block gives a proper marketplace surface
  (icon, logo, category) without affecting Claude.
- Explicit "no hooks" decision means we are honest about not
  committing to undocumented behavior.

**Negative / trade-offs**

- Two directories with parallel scaffolding (skill, package.json,
  README) means small text changes happen in two places. Tolerable
  at one-verb scale; revisit if the plugins grow many surfaces.
- Codex's marketplace policies (`installation`, `authentication`)
  are not exercised in v0. ADR-004 will need to define them; until
  then, the catalog is local-install-only.
- We commit to a `0.1.0` version on both plugins without a published
  release flow. EPIC.md M5b (ADR-005) covers the eventual publish
  pipeline; until then, both plugins are local-only.

**Neutral**

- The plugin assets (icon, logo) need to exist before the first
  install attempt. Implementer can drop placeholder PNGs in P-6;
  visual design work is out of scope for this ADR.

## Open questions for sign-off

- **(a) Codex install surface (resolved):** Verify during P-6 build; if Codex auto-installs all catalog entries on `marketplace add`, drop explicit install step. Accepted.
- **(b) Telemetry / opt-in (resolved):** None in v0. Accepted.
- **(c) `interface.brandColor` (resolved):** Leave unset for v0; ADR-004 will set marketplace brand identity holistically. Accepted.
- **(d) Plugin name in catalog (resolved):** `proofkit-codex`, symmetric with `proofkit-claude`. Accepted.
- **(e) Hooks revisit trigger (resolved):** When Codex publishes a hooks subpage at `developers.openai.com/codex/plugins/hooks`, OR when a v0.2+ verb requires lifecycle integration — whichever is first. Accepted.

## How M4 acceptance maps to this ADR

> M4 acceptance: both plugins install locally and expose at least one
> verb that calls into `tui-proof-kit` (e.g. "run this proof file" or
> "scaffold a proof for this TUI").

- "Install locally" satisfied by acceptance criteria (1)–(3).
- "Expose at least one verb that calls into `tui-proof-kit`"
  satisfied by (4)–(5) — same as ADR-002, by construction (shared
  package).
- "Both plugins" satisfied jointly by ADR-002 + ADR-003.
