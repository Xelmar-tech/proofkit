# @capxul/tui-test-kit

Drive terminal apps, record sessions, produce evidence packs.

```bash
npm install @capxul/tui-test-kit
```

**Requirements:** Node.js >= 22. `node-pty` is a native C++ addon — you need a C++ compiler and `node-gyp` available (Xcode CLI tools on macOS, `build-essential` on Linux, Visual Studio Build Tools on Windows).

## Quick start

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

Full docs: [proofkit-docs.pages.dev](https://proofkit-docs.pages.dev)
