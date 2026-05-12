# ADR-004 — Capsule-factory marketplace integration

- **Status:** draft — awaiting team-lead sign-off
- **Date:** 2026-05-11
- **Owner:** Aaron (decision); assistant (drafting)
- **Supersedes:** —
- **Superseded by:** —
- **Related:** ADR-002 (Claude plugin), ADR-003 (Codex plugin), ADR-005 (deploy infra)

## Context

M5a of the proofkit monorepo migration calls for a capsule-factory marketplace presence. Capsule-factory (`github.com/Xelmar-tech/capsule-factory`) is Capxul's in-house plugin marketplace — a repository of Claude Code and Codex plugins consumed by coding agents.

Proofkit already has a root-level `.claude-plugin/marketplace.json` catalog that lists the `proofkit` plugin (a single skill teaching proofkit best practices for coding agents). The question is: should proofkit be listed in capsule-factory's marketplace as well, and if so, what does that listing look like?

## Decision (proposed)

Add proofkit as a capsule-factory marketplace entry by **submitting a PR to capsule-factory** that adds proofkit's plugin to capsule-factory's `.claude-plugin/marketplace.json` catalog. No separate capsule repo, no publish step — just a catalog entry pointing at proofkit's own catalog.

### What goes in the capsule-factory catalog

```json
{
  "name": "proofkit",
  "source": "https://github.com/Xelmar-tech/proofkit",
  "description": "Drive terminal apps, record sessions, produce evidence packs. Scaffold-proof skill for coding agents."
}
```

### How discovery works

1. User adds capsule-factory as a marketplace:

   ```bash
   # Claude
   /plugin marketplace add Xelmar-tech/capsule-factory

   # Codex
   codex plugin marketplace add Xelmar-tech/capsule-factory
   ```

2. Agent discovers proofkit as an available plugin from capsule-factory's catalog.
3. The `source` field tells the agent where to fetch the actual plugin files (proofkit's `.claude-plugin/marketplace.json` at the GitHub URL).
4. The agent reads proofkit's skill (`skills/proofkit/SKILL.md`) and auto-invokes it when relevant.

### Why a simple catalog entry, not a capsule

Capsule-factory defines a "capsule" as a self-contained plugin directory with a manifest. Proofkit is not a capsule — it's a full monorepo whose plugin surface is a single skill. Adding proofkit to capsule-factory's catalog as an external reference is the right abstraction:

- Proofkit's plugin stays co-located with its framework code (monorepo advantage).
- No sync burden between two repos.
- Capsule-factory acts as discovery, not hosting.

### What we do NOT do

- **Do not create a separate `capsule-factory/plugins/vertical-plugins/proofkit/` directory.** The skill lives in proofkit's own repo.
- **Do not mirror the skill to capsule-factory.** One source of truth.
- **Do not add a `policy` object to the capsule-factory entry.** Capsule-factory's catalog format is Claude-native (`{name, source, description}`), not Codex-extended. Codex reads this catalog and resolves to proofkit's own catalog for its `interface` block.

## Rationale

### Why capsule-factory at all

Capsule-factory is where Capxul's agent ecosystem discovers tools. If proofkit isn't listed there, coding agents working in Capxul projects won't know proofkit exists. The catalog entry is zero-cost discovery.

### Why external reference over in-repo capsule

1. **Single source of truth** — the skill lives where the framework code lives. Changes to the skill ship with framework releases.
2. **No duplication** — a capsule-factory copy of the skill would drift.
3. **Simplicity** — the entry is one JSON object. No new repo, no CI, no sync scripts.

### Why a PR to capsule-factory

Capsule-factory is a curated marketplace. Entries are added via PR. This is the established workflow — `pm-core`, `implementer`, and 11 other plugins were added the same way.

## Acceptance criteria

1. A PR exists on `Xelmar-tech/capsule-factory` adding proofkit to `.claude-plugin/marketplace.json`.
2. After merge, `codex plugin marketplace add Xelmar-tech/capsule-factory` followed by a prompt like "scaffold a proof for ./my-cli.ts" auto-invokes the proofkit skill.
3. The skill produces a valid proof file matching the template shape.

## Consequences

**Positive**

- Zero-cost discovery for all Capxul coding agents.
- No new infrastructure, no sync burden.
- Capsule-factory acts as a pure directory — proofkit owns its plugin content.

**Negative / trade-offs**

- The PR to capsule-factory needs review + merge. This is a manual gate, not automated.
- If proofkit's repo moves or is renamed, the `source` URL in capsule-factory's catalog must be updated. Low risk — proofkit is a core Capxul project.

**Neutral**

- The capsule-factory listing does not include version pinning. Agents always fetch the latest `main`-branch skill. Versioned plugin distribution is deferred to ADR-005 (npm publish).
