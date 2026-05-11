import { spawn, type IPty } from "node-pty";
// @xterm/headless's package.json points `module` at a path that doesn't
// exist (lib/xterm.mjs); Node falls back to the CJS build, which doesn't
// expose named exports via ESM `import`. Default-import + destructure
// works for both CJS and the future-ESM build.
import xtermHeadless from "@xterm/headless";
const { Terminal } = xtermHeadless as unknown as {
  Terminal: typeof import("@xterm/headless").Terminal;
};
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { chmodSync, statSync } from "node:fs";
import path from "node:path";
import { CastWriter } from "./cast.ts";
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
  /** Block until `text` appears on the current virtual screen, or timeout. */
  waitForText(text: string, timeoutMs?: number): Promise<boolean>;
  /** Return the current virtual screen as plain text (one line per row). */
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
  // xterm.js parses every byte the child writes and maintains a virtual
  // screen — CR/erase ops overwrite in place, alt-screen toggles correctly,
  // scrollback rotates. We never touch the underlying byte stream for
  // assertion or capture; we always read from the screen.
  const terminal = new Terminal({
    cols: opts.cols,
    rows: opts.rows,
    scrollback: 1000,
    allowProposedApi: true,
  });
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
    terminal.write(data);
    cast.writeEvent((performance.now() - startedAt) / 1000, data);
  });

  pty.onExit(({ exitCode }: { exitCode: number }) => {
    exited = exitCode;
  });

  // Read the current visible viewport as plain text. We deliberately exclude
  // scrollback — captureFrame and waitForText are about "what's on screen
  // right now," not the full history. The cast file still records everything.
  const readScreen = (): string => {
    const buf = terminal.buffer.active;
    const top = buf.viewportY;
    const lines: string[] = [];
    for (let y = 0; y < opts.rows; y++) {
      const line = buf.getLine(top + y);
      lines.push(line ? line.translateToString(true) : "");
    }
    return lines.join("\n").replace(/\s+$/, "");
  };

  return {
    typeText: (s) => pty.write(s),
    pressEnter: () => pty.write("\r"),
    pressEscape: () => pty.write("\x1b"),
    pressBackspace: () => pty.write("\x7f"),
    pressKey: (k) => pty.write(KEY_SEQUENCES[k]),

    waitForText: async (text, timeoutMs = 15_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (readScreen().includes(text)) return true;
        if (exited !== null) return readScreen().includes(text);
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    },

    captureFrame: () => readScreen(),

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
      try {
        terminal.dispose();
      } catch {
        // already disposed — fine
      }
    },
  };
}
