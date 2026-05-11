// @capxul/proofkit showcase — drives the interactive `create-next-app` flow.
//
// Exercises every public framework feature in one place:
//   - expectText as a state-driven gate (waits for the screen we expect, not a fixed delay)
//   - expectSnapshot for golden-frame regression assertion
//   - the type/press/Backspace pipeline including arrow-key menu navigation
//   - redactors (the create-next-app version number drifts over time)
//   - a prepare() hook that cleans the working directory
//
// First run:   PROOFKIT_UPDATE_SNAPSHOTS=1 node --experimental-strip-types examples/drive-create-next-app.ts
// Later runs:  node --experimental-strip-types examples/drive-create-next-app.ts
//
// Note: this example launches npx with HOME pointed at an empty sandbox dir so
// the install-confirm prompt fires every run regardless of the user's real
// ~/.npm cache state. No user-level files are touched.

import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
// In a real consumer this is `import { defineProof } from "@capxul/proofkit";`
// During in-repo development we import the compiled dist output — Node's
// strip-only TS loader doesn't transform parameter properties, but dist/ is
// plain JS so this works in both worlds.
import { defineProof } from "../dist/index.js";

const TMP_DIR = "/tmp/proofkit-showcase";
const SANDBOX_HOME = "/tmp/proofkit-showcase-home";
const BAD_NAME = "tui proof kit";
const FIXED_NAME = "tui-proof-kit";

const proof = defineProof({
  id: "drive-create-next-app",
  title: "@capxul/proofkit drives create-next-app",
  cwd: TMP_DIR,
  handoffRoot: path.join(
    import.meta.dirname,
    "..",
    "evidence",
    "drive-create-next-app",
  ),
  width: 100,
  height: 36,
  redactors: [
    {
      pattern: /create-next-app@\d+\.\d+\.\d+/g,
      replacement: "create-next-app@<version>",
    },
    // npx's spinner uses Unicode Braille chars (U+2800–U+28FF). They cycle
    // through frames over time, which would cause snapshot mismatches on every
    // run. Strip them — the spinner frame is never load-bearing for assertion.
    {
      pattern: /[⠀-⣿]/g,
      replacement: "",
    },
  ],
});

const result = await proof.run({
  prepare: async () => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    rmSync(SANDBOX_HOME, { recursive: true, force: true });
    mkdirSync(TMP_DIR, { recursive: true });
    mkdirSync(SANDBOX_HOME, { recursive: true });
  },

  launch: {
    command: "npx",
    args: ["create-next-app@latest"],
    // Sandbox HOME so npx sees an empty cache and the install-confirm prompt
    // fires every run. Keeps the user's real ~/.npm untouched.
    env: { HOME: SANDBOX_HOME },
  },

  steps: [
    // 1. npx asks for permission to download create-next-app.
    {
      id: "install-confirm",
      actions: [
        { expectText: "Ok to proceed?", timeoutMs: 60_000 },
        { expectSnapshot: "01-install-confirm" },
        { type: "y" },
        { press: "Enter" },
      ],
    },

    // 2. create-next-app starts and asks for the project name.
    {
      id: "name-bad",
      actions: [
        { expectText: "What is your project named?", timeoutMs: 90_000 },
        { expectSnapshot: "02-name-default" },
        { type: BAD_NAME },
        { press: "Enter" },
      ],
    },

    // 3. Spaces aren't URL-friendly — create-next-app rejects.
    {
      id: "validation-error",
      actions: [
        { expectText: "Invalid project name", timeoutMs: 10_000 },
        { expectSnapshot: "03-validation-error" },
      ],
    },

    // 4. Clear the bad input and retype with dashes. We assume the cursor sits
    // at end-of-input after the validation rejection — backspace count equals
    // the bad name's length.
    {
      id: "fix-name",
      actions: [
        ...Array.from({ length: BAD_NAME.length }, () => ({
          press: "Backspace" as const,
        })),
        { type: FIXED_NAME },
        { press: "Enter" },
      ],
    },

    // 5. The defaults-or-customize menu is an arrow-key list. Current
    // create-next-app has 2 items; we Down once to reach "No, customize
    // settings". (Older versions had 3 items and would need Down × 2 — easy
    // mistake to make.)
    {
      id: "defaults-menu",
      actions: [
        { expectText: "recommended Next.js defaults", timeoutMs: 30_000 },
        { expectSnapshot: "04-defaults-menu" },
        { press: "Down" },
        { press: "Enter" },
      ],
    },

    // 6. The customize screen asks each toggle as its own prompt. We can wait
    // for the bare word "TypeScript" because the virtual-screen model (xterm)
    // has overwritten the defaults menu by this point — earlier mentions of
    // "TypeScript" are no longer on screen.
    {
      id: "customize-screen",
      actions: [
        { expectText: "TypeScript", timeoutMs: 15_000 },
        { expectSnapshot: "05-customize-screen" },
      ],
    },
  ],

  verify: (ctx) => {
    ctx.finding({
      status: "pass",
      title: "Multi-screen drive",
      body: "5 snapshots verified, validation-error recovery exercised, arrow-key menu navigated",
    });
  },
});

process.exit(result.status === "pass" ? 0 : 1);
