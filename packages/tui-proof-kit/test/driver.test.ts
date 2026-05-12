import { test, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDriver } from "../src/driver.ts";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "proofkit-driver-test-"));
afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  return env;
}

const runFixture = (name: string): [string, string[]] => [
  process.execPath,
  ["--experimental-strip-types", path.join(import.meta.dirname, "fixtures", name)],
];

test("driver spawns child, captures output, surfaces exit code", async () => {
  const castPath = path.join(tmpRoot, "hello.cast");
  const d = createDriver({
    command: runFixture("hello.ts")[0],
    args: runFixture("hello.ts")[1],
    cwd: import.meta.dirname,
    env: cleanEnv(),
    cols: 80,
    rows: 24,
    castPath,
  });

  const sawHello = await d.waitForText("hello", 5_000);
  expect(sawHello).toBe(true);

  // Let the child finish exiting so onExit fires.
  for (let i = 0; i < 30 && d.exitCode() === null; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  expect(d.exitCode()).toBe(0);
  expect(existsSync(castPath)).toBe(true);

  await d.stop();
});

test("driver stop() is idempotent on an already-exited child", async () => {
  const d = createDriver({
    command: runFixture("hello.ts")[0],
    args: runFixture("hello.ts")[1],
    cwd: import.meta.dirname,
    env: cleanEnv(),
    cols: 80,
    rows: 24,
    castPath: path.join(tmpRoot, "idempotent.cast"),
  });

  await d.waitForText("hello", 5_000);
  for (let i = 0; i < 30 && d.exitCode() === null; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await d.stop();
  await d.stop(); // should not throw
});

test("driver captureFrame returns last N lines of stripped buffer", async () => {
  const d = createDriver({
    command: runFixture("hello.ts")[0],
    args: runFixture("hello.ts")[1],
    cwd: import.meta.dirname,
    env: cleanEnv(),
    cols: 80,
    rows: 4,
    castPath: path.join(tmpRoot, "frame.cast"),
  });

  await d.waitForText("hello", 5_000);
  const frame = d.captureFrame();
  expect(frame.includes("hello")).toBe(true);
  // Frame is bounded to rows lines — never more than 4 newlines.
  expect(frame.split("\n").length).toBeLessThanOrEqual(4);

  await d.stop();
});
