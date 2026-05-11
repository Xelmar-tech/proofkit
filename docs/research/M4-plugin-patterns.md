# M4 — Plugin Patterns Research Briefing

**Status:** research only — input for ADR-002 (Claude plugin) and ADR-003 (Codex plugin).
**Author:** analyst (capsule-factory team)
**Date:** 2026-05-11
**Scope:** preparation for `apps/claude-plugin/` and `apps/codex-plugin/`. No code, no ADR drafting. Both ADRs are user-sign-off-gated.

---

## TL;DR for the ADR authors

1. Claude Code and Codex plugin formats are **structurally near-identical**: a top-level catalog (`marketplace.json`) lists plugins, each plugin is a directory with a `<vendor>-plugin/plugin.json` manifest, and skill/command/agent surfaces are discovered by walking the directory tree.
2. The biggest divergence is the **install/discovery surface**: Codex adds an `interface` block for marketplace presentation (icons, screenshots, brand color, ToS URL) and an explicit `policy` object (`installation` / `authentication`). Claude leaves this to ambient marketplace UX and the plugin's `description`.
3. Capsule-factory is a working, in-house reference implementation of Claude's marketplace spec (see §1). It demonstrates two plugin shapes — _vertical_ (skills + commands) and _agent_ (agent persona + skills). Proofkit's plugins are closest to vertical-plugin in shape.
4. **The smallest useful verb question** (epic §"Notes / open questions") is genuinely open. Three candidates are scored in §5; my recommendation is `scaffold-proof` first, `run-proof` second, but the user owns the call.

---

## 1. Capsule-factory anatomy

Local clone: `/Users/abuusama/projects/capxul/capsule-factory/`. Public mirror: `https://github.com/Xelmar-tech/capsule-factory`.

### 1.1 Repository shape

```
capsule-factory/
├── .claude-plugin/marketplace.json    # catalog (spec-compliant: name + owner + plugins[])
├── CLAUDE.md                          # authoring rules for this repo
├── README.md                          # consumer-facing
├── commands/                          # repo-level commands (rare — most live in plugins/)
└── plugins/
    ├── vertical-plugins/<name>/
    │   ├── .claude-plugin/plugin.json
    │   ├── skills/<skill>/SKILL.md
    │   └── commands/<cmd>.md
    └── agent-plugins/<name>/
        ├── .claude-plugin/plugin.json
        ├── agents/<name>.md
        └── skills/<skill>/SKILL.md
```

Concrete citations:

- Marketplace catalog: `capsule-factory/.claude-plugin/marketplace.json:1-78` — 13 plugins listed (8 vertical, 5 agent) using `name` + `source` (relative `./` paths).
- Authoring rules: `capsule-factory/CLAUDE.md:24-29` — non-spec fields (`installCommand`, `mcpServers`, `verticalDependencies`, etc.) are _silently ignored_ by Claude Code. **Do not add them.** Discovery is by tree-walk.
- Plugin manifest minimum: `capsule-factory/CLAUDE.md:30` — `.claude-plugin/plugin.json` needs `name`, `version`, `description`; `name` must match the catalog entry.

### 1.2 Vertical-plugin example: `pm-core`

Path: `capsule-factory/plugins/vertical-plugins/pm-core/`.

```
pm-core/
├── .claude-plugin/plugin.json        # {name, version, description}
├── commands/
│   ├── orchestrate.md                # /orchestrate
│   ├── plan-epic.md                  # /plan-epic
│   └── report.md                     # /report
└── skills/
    ├── agent-orchestrator/SKILL.md
    ├── linear-epic-planning/SKILL.md
    └── pm-reporting/SKILL.md
```

The pattern: **a command is a thin wrapper that loads a skill**. From `pm-core/commands/orchestrate.md:1-10`:

```yaml
---
description: Spawn the agent team to execute a Linear epic
argument-hint: '<epic-id> (e.g. CAP-42 or full Linear URL)'
---

Load skill: **agent-orchestrator**.

The user invoked `/orchestrate` with `$ARGUMENTS`. Apply the
`agent-orchestrator` skill: resolve the epic via the Linear MCP, run
the env-materialization pre-flight, decide team composition, spawn the
team via `TeamCreate`...
```

The skill itself (`pm-core/skills/agent-orchestrator/SKILL.md:1-9`) is auto-invocable; its frontmatter declares when it applies:

```yaml
---
name: agent-orchestrator
version: 1.0.0
description: |
  Bootstrap an agent team to execute a Linear epic. Use when the user
  invokes "/orchestrate <epic-id>", says "run the team on epic X"...
---
```

**Key lesson:** skills auto-invoke from `description` matches; commands exist only when the UX needs an explicit `/verb` trigger. Per capsule-factory's own `CLAUDE.md:90-93`: _"Do not author a command wrapper for every skill. Most skills auto-invoke from their `description` and a wrapper just adds maintenance."_

### 1.3 Agent-plugin example: `implementer`

Path: `capsule-factory/plugins/agent-plugins/implementer/`.

```
implementer/
├── .claude-plugin/plugin.json
├── agents/implementer.md            # @implementer persona
└── skills/pr-lifecycle/SKILL.md     # agent-private skill
```

Agent frontmatter (`implementer/agents/implementer.md:1-9`):

```yaml
---
name: implementer
description: |
  End-to-end coding agent. Takes a Linear ticket (or a clear spec),
  pre-flights env vars, designs, codes, tests, opens a PR, and
  addresses self-review comments. Invoke when the user says
  "@implementer", or when epic-conductor dispatches a ticket.
---
```

Agents are heavier than skills (50–200 lines per `CLAUDE.md:79-81`). They're invoked via `@<name>` or spawned by another agent. Agent-private skills sit under the agent plugin and are referenced internally (e.g. `pr-lifecycle` is invoked by `@implementer` but not exposed standalone).

### 1.4 Marketplace catalog shape

From `capsule-factory/.claude-plugin/marketplace.json:1-78` — the _only_ fields that matter:

```json
{
  "name": "capsule-factory",
  "owner": { "name": "Capxul", "email": "aaron@capxul.com" },
  "metadata": { "description": "...", "version": "1.0.0" },
  "plugins": [
    {
      "name": "pm-core",
      "source": "./plugins/vertical-plugins/pm-core",
      "description": "Linear epic planning, PM reporting, and agent orchestration."
    },
    ...
  ]
}
```

Top-level `owner` is required. `source` is a `./`-prefixed relative path. Everything else is decoration.

---

## 2. Vertical-plugin vs agent-plugin — when to use which

| Dimension           | Vertical-plugin                                                              | Agent-plugin                                         |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Primary surface** | Skills + slash commands                                                      | Agent persona (`@name`)                              |
| **Invocation**      | Auto-invoke on description match, or explicit `/cmd`                         | Explicit `@name`, or dispatched by another agent     |
| **Lifetime**        | Short — one skill execution per turn                                         | Long — multi-turn loop, owns a workflow end-to-end   |
| **State**           | Stateless                                                                    | Carries team context, ticket scope                   |
| **Examples**        | `code-quality` (`/pr`, `/simplify`), `evidence-capture` (`/demo`, `/verify`) | `implementer`, `analyst`, `qa-capture`               |
| **Has own skills?** | Yes — the skills _are_ the plugin                                            | Sometimes — agent-private skills like `pr-lifecycle` |

**For proofkit's M4 plugins:** vertical-plugin is the right shape. The plugin's job is to expose a few `/verb` commands that call into `tui-proof-kit`. No long-lived persona, no multi-turn ownership — those belong to the consumer's agent layer, not to proofkit.

---

## 3. Codex plugin shape

Source: `https://developers.openai.com/codex/plugins/build`. Self-serve publishing is marked "coming soon"; format is stable.

### 3.1 Directory layout

```
my-plugin/
├── .codex-plugin/plugin.json         # required
├── skills/<skill-name>/SKILL.md
├── assets/{icon.png,logo.png,screenshots/...}
├── .app.json                          # optional — app/connector mappings
├── .mcp.json                          # optional — MCP server config
└── hooks/hooks.json                   # optional — lifecycle hooks
```

All paths in manifest references must be `./`-prefixed and contained inside the plugin root.

### 3.2 Manifest fields (`.codex-plugin/plugin.json`)

Core:

- `name` (kebab-case, stable across versions)
- `version` (semver)
- `description`

Component references (paths to bundled resources):

- `skills`: path to skills directory
- `mcpServers`: path to MCP config (`.mcp.json`)
- `apps`: path to app mappings (`.app.json`)
- `hooks`: path to hooks config (`hooks/hooks.json` if omitted)

Publisher metadata:

- `author` `{name, email, url}`, `homepage`, `repository`, `license`, `keywords`

**Installation `interface` block** (this is Codex-specific UX surface):

| Field                                                 | Purpose                                                 |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `displayName`                                         | UI title                                                |
| `shortDescription`, `longDescription`                 | Marketplace copy                                        |
| `category`                                            | Discovery classification                                |
| `capabilities`                                        | High-level verbs ("Read", "Write") — _not_ fine-grained |
| `defaultPrompt`                                       | Suggested usage examples                                |
| `composerIcon`, `logo`, `screenshots`                 | Visual assets                                           |
| `websiteURL`, `privacyPolicyURL`, `termsOfServiceURL` | Legal/external                                          |
| `brandColor`                                          | Hex theming                                             |

### 3.3 Skills

Identical shape to Claude's: a directory with `SKILL.md`, frontmatter `{name, description}`, body is workflow instructions. Auto-discoverable, reusable across teams.

### 3.4 MCP integration (`.mcp.json`)

Two formats:

```json
// direct
{ "server-name": { "command": "cmd", "args": ["--stdio"] } }

// wrapped
{ "mcp_servers": { "server-name": { ... } } }
```

### 3.5 Lifecycle hooks (`hooks/hooks.json`)

`hooks` field is optional in the manifest; if omitted, Codex auto-checks `./hooks/hooks.json`. Hooks control activation, init, teardown. The reference doesn't enumerate hook events — to be confirmed before ADR-003 ships.

**OPEN QUESTION (Q1):** what hook events does Codex actually expose? Claude has `PreToolUse`, `PostToolUse`, `SessionStart`, etc. (see §4). Codex docs don't list events explicitly — needs a follow-up read of the hooks subpage before ADR-003 commits to lifecycle behavior.

### 3.6 Distribution

Marketplaces are JSON catalogs Codex reads from:

- Codex's official Plugin Directory
- `$REPO_ROOT/.agents/plugins/marketplace.json`
- `~/.agents/plugins/marketplace.json`
- **`$REPO_ROOT/.claude-plugin/marketplace.json`** ← Codex reads Claude's catalog format too

The Claude-compat path is significant: capsule-factory's existing catalog is already half-compatible with Codex's discovery.

Marketplace entry:

```json
{
  "name": "plugin-name",
  "source": { "source": "local", "path": "./plugins/plugin-name" },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

Policy values:

- `installation`: `AVAILABLE` | `INSTALLED_BY_DEFAULT` | `NOT_AVAILABLE`
- `authentication`: `ON_INSTALL` | (first-use activation)

Install path: `~/.codex/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME/$VERSION/`. Local-sourced plugins resolve `$VERSION → "local"`.

CLI:

```bash
codex plugin marketplace add owner/repo
codex plugin marketplace add ./local-path
codex plugin marketplace upgrade
codex plugin marketplace remove <name>
```

---

## 4. Claude / Codex feature-parity matrix

Reference: `https://code.claude.com/docs/en/plugins-reference` (Claude) and the Codex page above. Where Claude's spec is fully covered by capsule-factory's `CLAUDE.md`, that's cited too.

| Surface                  | Claude Code                                                               | Codex                                                              | Notes                                                    |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Manifest location        | `.claude-plugin/plugin.json`                                              | `.codex-plugin/plugin.json`                                        | Different directory, same shape                          |
| Required manifest fields | `name`, `version`, `description`                                          | `name`, `version`, `description`                                   | Identical                                                |
| Catalog file             | `.claude-plugin/marketplace.json`                                         | `.codex-plugin/...` OR Claude's path                               | **Codex reads Claude's catalog**                         |
| Catalog entry shape      | `{name, source: "./path", description}`                                   | `{name, source: {source:"local", path}, policy, category}`         | Codex wraps source in object; adds policy                |
| Owner block              | Top-level `owner` (required)                                              | `author` in plugin manifest                                        | Different placement                                      |
| **Skills**               | `skills/<name>/SKILL.md` with frontmatter `{name, description, version?}` | `skills/<name>/SKILL.md` with frontmatter `{name, description}`    | Effectively identical                                    |
| Skill auto-invocation    | Yes — on `description` match                                              | Yes — on `description` match                                       | Same model                                               |
| **Slash commands**       | `commands/<cmd>.md` with frontmatter `{description, argument-hint}`       | Not a first-class concept in the docs reviewed                     | Codex relies on skills + `defaultPrompt`; **divergence** |
| **Agents**               | `agents/<name>.md` with frontmatter `{name, description, tools?}`         | Not documented as a plugin surface                                 | Claude-only; **divergence**                              |
| **MCP servers**          | Plugin-bundled MCP config                                                 | `.mcp.json` (two formats)                                          | Both supported                                           |
| **Hooks**                | `PreToolUse`, `PostToolUse`, `SessionStart`, etc.                         | `hooks/hooks.json`; events not enumerated in main reference        | Q1 above                                                 |
| Marketplace presentation | Plugin `description` only                                                 | Rich `interface` block (icons, brand color, screenshots, ToS URLs) | Codex is publish-store-shaped                            |
| Install policy           | Implicit (user-driven)                                                    | Explicit `policy.installation` + `policy.authentication`           | Codex more formal                                        |
| Install path             | `~/.claude/plugins/...` (per CLI)                                         | `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/`            | Different roots; same idea                               |
| Asset bundling           | No spec-defined `assets/`                                                 | `./assets/{icon.png, logo.png, screenshots/}`                      | Codex formalizes                                         |

### Divergence summary

Three things proofkit's two plugins will _not_ share verbatim:

1. **Slash-command surface.** Claude has `commands/*.md`; Codex doesn't expose a `/cmd` primitive in the same way. For Codex, the equivalent UX is a skill with a clear `description` plus `interface.defaultPrompt`.
2. **Agent surface.** Claude has first-class agents (`agents/*.md`, `@name` invocation). Codex doesn't. This doesn't matter for proofkit — the plugins are vertical-plugin-shaped, no agents needed.
3. **Marketplace metadata.** Codex wants brand assets and policy declarations. Claude doesn't. For proofkit, this means: the _content_ of both plugins (skills, the verb, the underlying call into `tui-proof-kit`) can be a shared library; only the manifest + presentation layer differs.

### Reusable from existing capxul `.agents/skills/` patterns

Capxul-TUI's `.agents/handoffs/` + `.agents/skills/` patterns are working-tree state for in-flight agent work, **not** packageable plugin material. They don't directly port. What _is_ portable from capsule-factory:

- Skill frontmatter conventions (`name`, `version`, `description` with "Use when ..." phrasing).
- Command-as-thin-wrapper pattern (`Load skill: <name>.` + framing paragraph).
- Marketplace.json shape (`name` + `source` + `description`, top-level `owner`).
- The discipline of _not_ adding non-spec fields — keeps the catalog clean.

---

## 5. Open questions for ADR-002 / ADR-003 authors

### Q1 (highest-priority): What is the smallest useful verb?

The epic explicitly flags this (`EPIC.md` §"Notes / open questions"). Three candidates, scored:

| Candidate                          | What it does                                                                                                             | Pro                                                                                                        | Con                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **A. `scaffold-proof <tui-path>`** | Generate a proof file skeleton (imports, basic actions, expectText assertions) targeting a TUI entrypoint the user names | Highest "magic moment" — turns "I want to test this" into a runnable file in one command                   | Needs an AST-ish understanding of the target TUI to be useful; risk of generic output |
| **B. `run-proof <file>`**          | Execute a proof file, print the snapshot/verify report inline, surface failures                                          | Trivial to implement (shells out to existing `tui-proof-kit` CLI); useful as a Claude/Codex "tail" surface | Adds little over `bun run` directly; pure convenience                                 |
| **C. `open-capture <file>`**       | Take an existing capture (HTML/MP4) produced by tui-proof-kit and open it for review with annotations                    | Bridges the "evidence" half of proofkit into the IDE flow                                                  | Depends on capture output format stabilizing first; smallest user demand              |

**My recommendation:** ship **A (`scaffold-proof`) first**. It's the only one that creates new value the CLI can't trivially provide. B is a fallback if A turns out to need too much TUI introspection to land in M4 timeframe. C is post-v0.

The user owns this call. ADR-002 and ADR-003 need this decision before they can be drafted.

### Q2: Should ADR-002 and ADR-003 commit to _one_ verb or a small set?

EPIC.md §"Notes / open questions" says: _"Cap on plugin scope: keep the first plugin to ONE useful verb. Don't ship a Swiss-army knife with v0."_ Aligned. Recommend ADRs lock to exactly one verb each, with explicit "future verbs" deferral list.

### Q3: Shared package vs duplicated implementation?

Both plugins will need to call into `tui-proof-kit`. Two options:

- **Shared package** under `packages/plugin-shared/` (or similar) that exports the verb implementation; both `apps/claude-plugin/` and `apps/codex-plugin/` are thin manifests + skill wrappers calling into it.
- **Duplicate** the skill logic in each plugin's SKILL.md.

Recommend **shared package**. The verb logic is the asset; the plugin manifests are just two different distribution channels. Duplicating risks drift.

### Q4: Codex hook events (deferred research)

Before ADR-003 commits to lifecycle behavior, read the Codex hooks subpage in detail. The main reference page lists `hooks/hooks.json` but doesn't enumerate events. If Codex hooks are weaker than Claude's, ADR-003 should explicitly note "no install-time hooks; verb is invoked on-demand only."

### Q5: Marketplace listing strategy (relates to M5a)

Two separate marketplaces, or one catalog covering both? Codex's ability to read `.claude-plugin/marketplace.json` means a single catalog file at proofkit's root _could_ serve both clients. ADR-004 (capsule-factory integration) and ADRs 002/003 should align — recommend the M4 ADRs name the catalog location but leave the catalog-entry policy fields for ADR-004.

### Q6: Plugin distribution — separate repo or monorepo `apps/`?

EPIC.md sequences M4 with `apps/claude-plugin/` and `apps/codex-plugin/` in the proofkit monorepo. That's the right call for v0 — co-located with the framework, versioned in lockstep. If/when plugins grow independent lifecycles, they can be extracted. No ADR needed for this unless the user wants to revisit.

---

## 5a. Codex hook events — follow-up fetch (2026-05-11)

Resolution of §5 Q4. Sources attempted:

- `https://developers.openai.com/codex/plugins/hooks` — **HTTP 404.** No dedicated hooks subpage exists.
- `https://developers.openai.com/codex/plugins/build` — only place hooks are mentioned.
- `https://developers.openai.com/codex/plugins/` (overview) — confirms Codex plugin docs are exactly two pages ("Overview" and "Build plugins"). No hooks subpage, no manifest-reference subpage, no lifecycle-events subpage.

**Everything the build page documents about hooks (cover-to-cover):**

1. Manifest field: `"hooks": "./hooks/hooks.json"`. Optional.
2. Auto-detection: _"If you omit the manifest field, Codex still checks `./hooks/hooks.json`."_
3. Accepted shapes: a single file path, an array of file paths, an inline lifecycle object, or an array of inline lifecycle objects. Paths obey the `./`-prefixed plugin-root rule.

**What is NOT publicly documented:**

- Event names. There is no Codex equivalent to Claude's `PreToolUse` / `PostToolUse` / `SessionStart` published in the reference.
- Payload schemas for any event.
- Whether a hook can **block**, **observe**, or **mutate**.
- An example `hooks.json` file.
- Matchers, ordering, exit-code contracts, failure handling.

**Implication for ADR-003.** Codex's hook surface is publicly undocumented beyond "a slot exists." ADR-003 cannot responsibly commit to lifecycle behavior that relies on specific event names. Recommendation: ship Codex plugin v0 **without any `hooks/` directory or `hooks` manifest field**. The `scaffold-proof` verb runs when the skill auto-invokes or when explicitly requested; no install-time, session-start, or pre-tool-use lifecycle is required for v0 scope. Revisit when Codex publishes the reference or when a v0.2+ verb needs lifecycle integration (e.g. auto-running a proof on file save).

---

## 6. What I did NOT cover (out of scope for this briefing)

- The actual ADR drafting (Q1 needs user sign-off first).
- Codex hooks event enumeration (Q4 — needs a follow-up fetch).
- capsule-factory listing mechanics (deferred to ADR-004 / M5a).
- LSP and monitor surfaces in Claude plugins — proofkit doesn't need them.

---

## 7. Source citations

- `capsule-factory/CLAUDE.md:1-100` — authoring rules
- `capsule-factory/.claude-plugin/marketplace.json:1-78` — catalog example
- `capsule-factory/plugins/vertical-plugins/pm-core/commands/orchestrate.md:1-10` — command wrapper pattern
- `capsule-factory/plugins/vertical-plugins/pm-core/skills/agent-orchestrator/SKILL.md:1-9` — skill frontmatter
- `capsule-factory/plugins/agent-plugins/implementer/agents/implementer.md:1-9` — agent frontmatter
- `capsule-factory/plugins/agent-plugins/implementer/skills/pr-lifecycle/SKILL.md:1-15` — agent-private skill
- `https://developers.openai.com/codex/plugins/build` — Codex plugin reference
- `https://code.claude.com/docs/en/plugins-reference` — Claude Code plugin reference
- `proofkit/EPIC.md` (§"M4 · Editor plugins", §"Notes / open questions") — scope and constraints
