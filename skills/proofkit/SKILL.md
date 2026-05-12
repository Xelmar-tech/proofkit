---
name: proofkit
version: 0.1.0
description: |
  Write, scaffold, and debug tui-proof-kit proof files for terminal applications.
  Use when the user asks you to:
  - Scaffold a proof for a TUI / CLI
  - Write a proofkit test harness
  - Debug a failing proof file
  - Add snapshot assertions to an existing proof
  - Explain proofkit conventions or best practices
  - Generate a proof from a TUI path or command
---

# tui-proof-kit — proof authoring & debugging

You are an expert at writing and debugging proof files for the `tui-proof-kit` framework. Every proof file follows the same shape: `defineProof({...}).run({...})`.

## Framework cheat sheet

### Core concepts

- **State-driven gates** — `expectText("Ready")` waits until "Ready" appears on screen. No `sleep(N)` hacks. Always prefer expectText over waitMs.
- **Golden-frame snapshots** — `expectSnapshot("id")` captures the full terminal buffer and diffs it against a saved reference. First run with `PROOFKIT_UPDATE_SNAPSHOTS=1` records snapshots; subsequent runs verify.
- **Redactors** — strip non-deterministic content (version numbers, timestamps, spinners, PIDs) before frames are written or compared. Add redactors whenever a snapshot would flake.

### Proof file template

```ts
import { defineProof } from "@capxul/tui-test-kit";

const proof = defineProof({
  id: "unique-id", // stable, used in filenames
  title: "Human-readable title", // shown in report
  cwd: process.cwd(), // working dir for spawned process
  handoffRoot: "./evidence/<id>", // where evidence/ + REPORT.html land
  width: 100, // terminal columns
  height: 36, // terminal rows
  redactors: [], // patterns to strip from captures
});

const result = await proof.run({
  prepare: async (ctx) => {
    // Optional: clean temp dirs, fetch fixtures, etc. Runs before TUI launch.
  },
  launch: {
    command: "node", // or "npx", "./bin/cli", etc.
    args: ["script.ts"],
    env: { HOME: "/sandbox" }, // optional env overrides
  },
  steps: [
    {
      id: "step-id",
      actions: [
        // Actions execute sequentially. Runner stops at first failure.
      ],
    },
  ],
  verify: (ctx) => {
    // Final assertions. Throw to fail. Access ctx.vars, ctx.capture("id"), etc.
    ctx.finding({ status: "pass", title: "...", body: "..." });
  },
});

process.exit(result.status === "pass" ? 0 : 1);
```

### Action types

| Action           | Purpose                      | Example                                                             |
| ---------------- | ---------------------------- | ------------------------------------------------------------------- |
| `expectText`     | Gate on text appearing       | `{ expectText: "Ready", timeoutMs: 15_000 }`                        |
| `expectSnapshot` | Golden-frame comparison      | `{ expectSnapshot: "welcome" }`                                     |
| `capture`        | Save screen (no comparison)  | `{ capture: "debug" }`                                              |
| `type`           | Send text to stdin           | `{ type: "hello" }` or `{ type: (ctx) => ctx.vars.name as string }` |
| `press`          | Named keypress               | `{ press: "Enter" }`, `{ press: "Down" }`                           |
| `waitMs`         | Fixed delay (avoid)          | `{ waitMs: 200 }`                                                   |
| `resolve`        | Async computation → ctx.vars | `{ resolve: async () => "...", var: "key" }`                        |

Press keys: `Enter`, `Escape`, `Backspace`, `Tab`, `Up`, `Down`, `Left`, `Right`

### Running proofs

```bash
# First run: record snapshots
PROOFKIT_UPDATE_SNAPSHOTS=1 node --experimental-strip-types proof.ts

# Verify against saved snapshots
node --experimental-strip-types proof.ts

# Force-update a single snapshot (set update: true on one expectSnapshot)
node --experimental-strip-types proof.ts
```

## Best practices

### 1. Match substrings, not full lines

```ts
// GOOD: semantic anchor
{
  expectText: "recommended Next.js defaults";
}

// BAD: fragile against minor copy changes
{
  expectText: "Would you like to use the recommended Next.js defaults?";
}
```

### 2. Always pair expectText before expectSnapshot

Don't snapshot a screen you haven't confirmed arrived. The snapshot might be of a loading screen or a partial render.

```ts
// GOOD
{ expectText: "Welcome" },
{ expectSnapshot: "welcome-screen" },

// BAD — snapshot might fire before Welcome renders
{ expectSnapshot: "welcome-screen" },
```

### 3. Use dynamic actions for variable-length input

```ts
// Backspace count = bad input length (self-documenting)
...Array.from({ length: badInput.length }, () => ({ press: "Backspace" as const })),
```

### 4. Add redactors early

If a snapshot has a version number, timestamp, or spinner — redact it. Don't wait for the first CI flake.

```ts
redactors: [
  { pattern: /v\d+\.\d+\.\d+/g, replacement: "v<version>" },
  { pattern: /[⠀-⣿]/g, replacement: "" }, // Unicode Braille spinners
];
```

### 5. Use prepare() for hermetic environments

TUIs that read files, check caches, or depend on HOME need sandboxing:

```ts
prepare: async () => {
  const SANDBOX = "/tmp/proofkit-sandbox";
  rmSync(SANDBOX, { recursive: true, force: true });
  mkdirSync(SANDBOX, { recursive: true });
},
launch: {
  env: { HOME: SANDBOX },
}
```

### 6. One step = one screen transition

Don't cram multiple screens into one step. Each step should represent a single logical transition:

```ts
// GOOD: clear boundaries
{ id: "install-confirm", actions: [...] },
{ id: "name-bad", actions: [...] },
{ id: "validation-error", actions: [...] },

// BAD: muddled
{ id: "everything", actions: [/* 15 actions across 4 screens */] },
```

### 7. Use capture for debugging, snapshots for regression

`capture` saves a screen for human review. `expectSnapshot` locks it as a regression assertion. Use capture during development, then convert to expectSnapshot once stable.

### 8. Set generous timeouts, not tight ones

```ts
// GOOD: 60 seconds for npm install
{ expectText: "Ok to proceed?", timeoutMs: 60_000 }

// BAD: CI is slower than your laptop
{ expectText: "Ok to proceed?", timeoutMs: 5_000 }
```

The proof runs as fast as the TUI — the timeout is a safety net, not a performance driver.

## Debugging failing proofs

### Symptom: "Expected text not visible"

1. Open the REPORT.html and look at the asciinema replay — what screen was actually showing?
2. Is the substring correct? Case-sensitive? Did the TUI add a trailing space?
3. Did a previous action fail silently? Check the findings table.
4. Is the timeout too short? npm installs on slow CI can take 60s+.

### Symptom: "Snapshot mismatch"

1. Open the REPORT.html diff — what changed?
2. Did a dependency version bump? Add a redactor.
3. Did the TUI add a trailing newline? Check your redactors.
4. Is the mismatch a spinner/animation frame? Strip it with a Braille redactor.

### Symptom: TUI doesn't launch

1. Is `command` in PATH? Use absolute paths or `npx` for npm binaries.
2. Does the TUI need a specific `cwd`? Check `proofConfig.cwd`.
3. Are env vars set? Many TUIs fail silently without `TERM` or `HOME`.

## Scaffolding a new proof

When asked to scaffold a proof, generate a complete `.proof.ts` file following the template above:

1. **Infer the launch invocation** — file path → derive command/args from extension + interpreter; bare command → split on whitespace.
2. **Pick output path** — `proofs/<basename>.proof.ts` under CWD. If it exists, append numeric suffix (`basename.2.proof.ts`).
3. **Emit the template** — fill in the inferred launch, leave `steps: []` empty, add inline comments pointing at the action reference.
4. **Print the path** and a one-liner showing how to run it.

Do NOT:

- Launch the TUI to introspect its output (security risk + many TUIs need sandbox setup).
- Pre-fill steps based on assumptions about the TUI's behavior.
- Modify any file other than the scaffolded proof.
