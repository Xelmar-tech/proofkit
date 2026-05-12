import { test, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineProof } from "../src/index.ts";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "proofkit-proof-test-"));
afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

const runFixture = (name: string): [string, string[]] => [
  process.execPath,
  ["--experimental-strip-types", path.join(import.meta.dirname, "fixtures", name)],
];

test("defineProof drives echo-prompt and produces a complete evidence pack", async () => {
  const root = mkdtempSync(path.join(tmpRoot, "echo-"));
  const proof = defineProof({
    id: "echo",
    title: "Echo prompt",
    cwd: import.meta.dirname,
    handoffRoot: root,
    width: 80,
    height: 24,
  });

  const result = await proof.run({
    launch: {
      command: runFixture("echo-prompt.ts")[0],
      args: runFixture("echo-prompt.ts")[1],
    },
    steps: [
      {
        id: "prompt",
        actions: [{ expectText: "Enter your name:" }, { capture: "01-prompt" }],
      },
      {
        id: "type-and-submit",
        actions: [{ type: "Aaron" }, { press: "Enter" }],
      },
      {
        id: "greet",
        actions: [{ expectText: "Hello, Aaron!" }, { capture: "02-greet" }],
      },
    ],
    verify: (ctx) => {
      if (!ctx.capture("02-greet").includes("Hello, Aaron!")) {
        throw new Error("greet not in capture");
      }
    },
  });

  expect(result.status).toBe("pass");
  expect(existsSync(path.join(root, "evidence", "casts", "echo.cast"))).toBe(true);
  expect(existsSync(path.join(root, "evidence", "captures", "01-prompt.txt"))).toBe(true);
  expect(existsSync(path.join(root, "evidence", "captures", "02-greet.txt"))).toBe(true);
  expect(existsSync(path.join(root, "echo-REPORT.html"))).toBe(true);

  const resultJson = JSON.parse(
    readFileSync(path.join(root, "evidence", "logs", "echo-result.json"), "utf-8"),
  );
  expect(resultJson.status).toBe("pass");
});

test("defineProof reports `blocked` when expectText times out", async () => {
  const root = mkdtempSync(path.join(tmpRoot, "timeout-"));
  const proof = defineProof({
    id: "timeout",
    title: "Expect text timeout",
    cwd: import.meta.dirname,
    handoffRoot: root,
    width: 80,
    height: 24,
  });

  const result = await proof.run({
    launch: {
      command: runFixture("hello.ts")[0],
      args: runFixture("hello.ts")[1],
    },
    steps: [
      {
        id: "wait-for-nonsense",
        actions: [{ expectText: "this string will never appear", timeoutMs: 500 }],
      },
    ],
    verify: () => {},
  });

  expect(result.status).toBe("blocked");
  expect(result.stage).toBe("wait-for-nonsense");
  expect(existsSync(path.join(root, "evidence", "captures", "wait-for-nonsense-blocked.txt"))).toBe(
    true,
  );
});

test("defineProof surfaces verify failures as `fail`", async () => {
  const root = mkdtempSync(path.join(tmpRoot, "verify-fail-"));
  const proof = defineProof({
    id: "verify-fail",
    title: "Verify throws",
    cwd: import.meta.dirname,
    handoffRoot: root,
    width: 80,
    height: 24,
  });

  const result = await proof.run({
    launch: {
      command: runFixture("hello.ts")[0],
      args: runFixture("hello.ts")[1],
    },
    steps: [{ id: "wait", actions: [{ expectText: "hello" }] }],
    verify: () => {
      throw new Error("intentional verify failure");
    },
  });

  expect(result.status).toBe("fail");
  expect(result.message).toContain("intentional verify failure");
});
