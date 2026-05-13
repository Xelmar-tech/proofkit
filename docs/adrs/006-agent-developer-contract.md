# ADR-006 — Agent-developer contract as proofkit's product framing

- **Status:** Proposed (2026-05-13)
- **Approved by:** —
- **Date:** 2026-05-13
- **Owner:** Aaron Griffith
- **Supersedes:** —
- **Supersedes (partial):** ADR-002 (Claude plugin) and ADR-003 (Codex plugin) — both contain a "verb" framing for the plugin surface (`scaffold-proof <tui-path>` as an MCP/slash-command verb that generates files) that contradicts the decision below. The verb framing in 002/003 will be superseded by new E4/E5 ADRs when those plugins are built. ADR-006 does **not** rewrite 002/003 here; it records the conflict so E4/E5 work picks up the corrected framing.
- **Superseded by:** —
- **Related:** ADR-002, ADR-003, ADR-004 (capsule-factory listing); E1 (story rewrite), E3 (dev path + evidence pack), E4 (Claude plugin v0), E5 (Codex plugin v0)

## Context

Proofkit shipped v0.2.0 as a "TUI testing framework": drive terminal apps, record sessions, produce evidence packs. The root README, the docs site index, the npm metadata, and ADRs 002/003 all describe the product through that lens.

Recent usage and a 2026-05-13 framing interview surface a different product underneath the same code: proofkit is the **contract between an AI agent and a TUI developer**. The developer writes a `defineProof()` spec — what the finished TUI must do. The agent reads that proof and builds toward it. The structured evidence pack is the artifact that proves the contract was met. Test-driven development where the test IS the contract.

Without a recorded decision, every downstream artifact (README, docs index, plugin manifests, capsule-factory listing, CONTRIBUTING, package metadata) drifts back toward "another TUI testing library." E1 prose (PFK-1, PFK-2), E4/E5 plugin scope, and the E3 evidence-pack work all need the framing fixed _before_ they ship.

## Decision

Adopt the **agent-developer-contract** framing as proofkit's canonical product story. Three load-bearing claims, drawn verbatim from PFK-1's README rewrite (PR #2):

1. **The developer writes `defineProof()` first.** The spec describes what the finished terminal app must do — id, dimensions, the steps the TUI must support, and a `verify` function that decides pass/fail.
2. **The AI agent reads the proof and builds the TUI toward it.** The proof is the requirements document; no ambiguity, no "did you mean".
3. **The structured evidence pack completes the contract.** When the agent runs the proof, the evidence pack it produces (`REPORT.html` with findings, snapshots, diffs, replayable cast) is the artifact that proves the contract was met — or precisely where it wasn't.

**Primary user:** TUI application developers whose AI coding agents (Claude Code, Codex, etc.) write the TUI for them.

**Vocabulary (Aaron, 2026-05-13):** `contract` is the metaphor for the relationship; `proof` is the artifact / API noun (the file `defineProof()` produces); `spec` is a prose synonym used when prose flows better. No API rename — `defineProof()` stays. README, docs, and ADRs use `contract` for the relationship and `proof` for the file.

## What this framing implies for the surface area

- **TUI developer is the primary user.** Hand-writers can still use proofkit as a terminal test runner, but the design assumes an agent is on the other side of the proof.
- **AI agents are first-class consumers, not an afterthought.** Agent ergonomics drive downstream calls — error messages, action shape, evidence-pack layout.
- **The evidence pack is the deliverable, not a test report.** Structured artifact (findings + snapshots + diffs + replayable cast) hands back to the developer. **Formal evidence-pack schema is in scope for E3; it ships as `v0` / `unstable` and remains under that marker until v1.0.0 in E7.** The `v0` marker preserves flexibility while making the differentiator visible.
- **Plugins distribute the workflow, not verbs.** Claude/Codex plugins (E4/E5) are skill-distribution channels: they teach the agent how to read, write, and run proofs against the existing framework. No MCP server, no `scaffold-proof <tui-path>` verb that owns scaffolding logic. The agent already knows how to run npm packages — it just doesn't know the workflow. The plugin teaches it.

## What this framing rules out

- **MCP verbs that duplicate framework calls.** `scaffold-proof`, `run-proof`, `open-capture` as plugin-owned verbs are out. (Note: ADR-002 §"What `scaffold-proof <tui-path>` does" and ADR-003 §"What `scaffold-proof <tui-path>` does" describe exactly this verb shape; both will be superseded by new E4/E5 ADRs.)
- **Positioning proofkit as "another TUI testing library."** The old framing ("TUI testing framework") is actively deprecated in npm metadata in E1 — a separate PFK ticket covers the `package.json` keywords + description rewrite; this ADR records only the decision.
- **Plugin scope that competes with the framework.** Plugins teach the use of the framework; they do not re-implement parts of it.
- **Human-centric ergonomics as the primary design driver.** Where ergonomics conflict between a hand-writer and an agent consumer, the agent consumer wins for v1.0.0. Hand-writers remain supported, not optimized for.

## Rationale

### Why "contract" is the right metaphor

A contract names a two-sided agreement with an artifact that proves performance. That is exactly the shape of the work: developer specifies, agent fulfills, evidence pack proves. "Test framework" describes one side of the same shape (the assertions) without naming the relationship that gives the assertions meaning. The contract framing is what makes the evidence pack feel inevitable rather than incidental.

### Why agent-centric ergonomics

The primary user delegates the build to an agent. Every README example, error message, and action variant lands at an agent before it lands at a human. Optimizing for agent legibility (structured findings, deterministic actions, machine-readable evidence) is optimizing for the primary path. Humans inspecting the evidence pack benefit from the same investment — structured outputs render well in HTML too.

### Why the evidence pack is the differentiator

Recorders produce videos; test runners produce pass/fail. Neither hands the developer a structured artifact that proves _which contract terms were met where, with what observed screen state, and replayable_. The evidence pack is the proofkit-shaped thing nobody else ships. Codifying it as a versioned schema (E3) makes it citable, diffable, and a target for tooling.

### Why supersede ADR-002 / ADR-003 only partially

The infra decisions in those ADRs (shared package layout, catalog at repo root, capsule-factory plugin shape, Codex divergences) remain sound. Only the **verb framing** is wrong under the new product story. Writing new E4/E5 ADRs against the corrected framing is cheaper than retroactively editing 002/003 — and preserves the historical record of how the framing evolved.

## Consequences

**Positive**

- README (PFK-1, PR #2), docs index (PFK-2), CONTRIBUTING, npm metadata, and plugin scope all tell one story. PFK-2 lifts the three load-bearing claims directly from PFK-1; ADR-006 ratifies both.
- Agent ergonomics get first-class treatment — the primary user is named, so design tradeoffs have a tiebreaker.
- Evidence pack gets a formal schema (E3, `v0`) and visible version marker through v1.0.0.
- Capsule-factory listing (ADR-004, E6) has a clear pitch: "skill that teaches an agent the proofkit workflow," not "verb that generates files."
- E4/E5 plugin scope is decided in advance — skill-distribution only, no MCP verbs — so those milestones don't relitigate it.

**Negative / trade-offs**

- ADR-002 / ADR-003 carry conflicting verb framing on disk until new E4/E5 ADRs supersede them. Mitigation: this ADR's "Supersedes (partial)" line is the canonical pointer; the contradictions list lives in this team's coordination record and will be quoted into the E4/E5 ADR-supersession tickets.
- Some existing copy outside this PR set still says "TUI testing framework" (package keywords, possibly stray docs strings). E1 sweep + the deprecation ticket above clean these up; until merged, mixed framing is visible to npm searchers.
- The handful of human-only users who landed on v0.2.0 will read framing that isn't aimed at them. Acceptable: the README's "Who this is for" section names them as a supported-but-not-primary path.

**Neutral**

- `defineProof()` stays as the API entry point. No rename, no migration burden.
- "Contract" / "proof" / "spec" vocabulary is internally consistent (Aaron, 2026-05-13) but unfamiliar to readers expecting "test"/"assertion"/"spec" from xUnit lineage. The README leans on the metaphor explicitly so the vocabulary is taught on first contact.

## Open questions for sign-off

_None._ The three previously-open questions (npm metadata deprecation, evidence-pack schema formality, contract/proof/spec naming) were resolved by Aaron on 2026-05-13 and are codified in §Decision and §"What this framing implies for the surface area" above.

## How E1 acceptance maps to this ADR

> E1 acceptance: root README, docs index, and package README all clearly explain (a) proofkit is the contract between an AI agent and a TUI developer; (b) you write a `defineProof()` spec first, the agent builds toward it; (c) the structured evidence pack completes the contract.

- (a)–(c) are this ADR's three load-bearing claims, paragraph-for-paragraph.
- PFK-1 (root README, PR #2, analyst-approved) is the source of truth for the prose; this ADR codifies the decision behind it.
- PFK-2 (docs index) lifts the same three claims from PFK-1.
- PFK-3 commits this ADR to `docs/adrs/006-agent-developer-contract.md`.

The same three claims are the input to PFK-2 (docs index), the eventual E4/E5 plugin scope, and the E3 evidence-pack work.
