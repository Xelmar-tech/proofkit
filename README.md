# Proofkit

![Proofkit banner](./assets/proofkit-banner.png)

**Proofkit is the contract between you and the AI agent building your TUI.**

You write a `defineProof()` spec describing what the finished terminal app must do. Your AI coding agent reads that spec and builds toward it. When the agent runs the proof, the structured evidence pack it produces is the artifact that proves the contract was met.

It is test-driven development for AI-built TUIs, where the test is the contract.

## Who this is for

TUI application developers whose AI coding agents (Claude Code, Codex, etc.) write the TUI for them. Proofkit gives the agent something concrete to build against and gives you something concrete to inspect when it claims it's done.

If you are hand-writing every line of your TUI yourself, you can still use Proofkit as a terminal test runner — but the design assumes an agent is on the other side of the proof.

## The loop

1. **You write `defineProof()`** — id, dimensions, the steps the TUI must support, and a `verify` function that decides pass/fail.
2. **The agent reads the proof and builds the TUI** toward it. The proof is the requirements document; no ambiguity, no "did you mean".
3. **The agent runs the proof.** Proofkit launches the TUI in a real PTY, drives it with state-based actions, and captures every frame.
4. **You read the evidence pack.** A `REPORT.html` with findings, snapshots, diffs, and a replayable cast — proof that the contract was fulfilled (or precisely where it wasn't).

## A minimal example

```ts
import { defineProof } from "@capxul/tui-test-kit";

const proof = defineProof({
  id: "hello",
  title: "My first proof",
  cwd: process.cwd(),
  handoffRoot: "./evidence/hello",
  width: 80,
  height: 24,
});

await proof.run({
  launch: { command: "node", args: ["my-cli.ts"] },
  steps: [
    {
      id: "greet",
      actions: [{ expectText: "Ready", timeoutMs: 5_000 }, { type: "hello" }, { press: "Enter" }],
    },
  ],
  verify: (ctx) => {
    ctx.finding({ status: "pass", title: "It works", body: "TUI responded correctly." });
  },
});
```

Snippet from [`packages/tui-proof-kit/README.md`](./packages/tui-proof-kit/README.md).

```bash
npm install @capxul/tui-test-kit
```

Requires Node.js 22+ and a working native toolchain for `node-pty`.

## Agent plugins

Proofkit ships with first-party plugins that teach your coding agent how to read, write, and run proofs:

- **Claude Code plugin** — coming in v1 (milestone E4).
- **Codex plugin** — coming in v1 (milestone E5).

No MCP server, no extra wiring — the plugins are skill packs the agent loads.

## Docs

Full documentation: **[proofkit-docs.pages.dev](https://proofkit-docs.pages.dev)**

- [Getting started](https://proofkit-docs.pages.dev/docs/getting-started)
- [Action reference](https://proofkit-docs.pages.dev/docs/reference/actions)
- [Mental model](https://proofkit-docs.pages.dev/docs/concepts/mental-model)

## Status, license, contributing

Pre-v1. The published package is [`@capxul/tui-test-kit`](https://www.npmjs.com/package/@capxul/tui-test-kit). API surface may shift before 1.0.

MIT licensed. See [LICENSE](./LICENSE). Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md).
