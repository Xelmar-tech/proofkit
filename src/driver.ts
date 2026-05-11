import { spawn, type IPty } from "node-pty";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { chmodSync, statSync } from "node:fs";
import path from "node:path";
import { CastWriter } from "./cast.ts";
import { stripAnsi } from "./ansi.ts";
import { KEY_SEQUENCES } from "./keystrokes.ts";
import type { PressKey } from "./types.ts";

// Bun's package extractor strips the executable bit from node-pty's
// spawn-helper. Without it, every spawn fails with `posix_spawnp failed.`
// at the kernel level. We restore the bit defensively at module load.
(() => {
  try {
    const req = createRequire(import.meta.url);
    const nodePtyPkg = req.resolve("node-pty/package.json");
    const platform = `${process.platform}-${process.arch}`;
    const helperPath = path.join(
      path.dirname(nodePtyPkg),
      "prebuilds",
      platform,
      "spawn-helper",
    );
    const st = statSync(helperPath);
    if ((st.mode & 0o111) === 0) chmodSync(helperPath, 0o755);
  } catch {
    // Helper not present on this platform (e.g. Windows uses conpty), or
    // node-pty layout changed — let it fail loudly at spawn time instead.
  }
})();

export interface TerminalDriver {
  typeText(text: string): void;
  pressEnter(): void;
  pressEscape(): void;
  pressBackspace(): void;
  pressKey(key: PressKey): void;
  /** Block until `text` appears in the ANSI-stripped buffer, or timeout. */
  waitForText(text: string, timeoutMs?: number): Promise<boolean>;
  /** Return the last `rows` lines of the ANSI-stripped buffer. */
  captureFrame(): string;
  /** Child exit code, or null if the child is still running. */
  exitCode(): number | null;
  /** Best-effort shutdown of the child process. Idempotent. */
  stop(): Promise<void>;
}

export interface DriverOptions {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
  /** Path to the cast file we'll write to. */
  castPath: string;
}

export function createDriver(opts: DriverOptions): TerminalDriver {
  const startedAt = performance.now();
  const cast = new CastWriter(opts.castPath, {
    cols: opts.cols,
    rows: opts.rows,
  });
  let buffer = "";
  let exited: number | null = null;

  const pty: IPty = spawn(opts.command, opts.args, {
    name: "xterm-256color",
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd,
    env: opts.env,
  });

  cast.writeHeader();

  pty.onData((data: string) => {
    buffer += data;
    cast.writeEvent((performance.now() - startedAt) / 1000, data);
  });

  pty.onExit(({ exitCode }: { exitCode: number }) => {
    exited = exitCode;
  });

  return {
    typeText: (s) => pty.write(s),
    pressEnter: () => pty.write("\r"),
    pressEscape: () => pty.write("\x1b"),
    pressBackspace: () => pty.write("\x7f"),
    pressKey: (k) => pty.write(KEY_SEQUENCES[k]),

    waitForText: async (text, timeoutMs = 15_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (stripAnsi(buffer).includes(text)) return true;
        if (exited !== null) return stripAnsi(buffer).includes(text);
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    },

    captureFrame: () => {
      const lines = stripAnsi(buffer).split("\n");
      return lines.slice(-opts.rows).join("\n");
    },

    exitCode: () => exited,

    stop: async () => {
      if (exited === null) {
        try {
          pty.kill();
        } catch {
          // already dead — fine
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    },
  };
}
