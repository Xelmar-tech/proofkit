import { test, expect, afterAll } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineProof } from "../src/index.ts";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "proofkit-snapshot-test-"));
afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

const fixturePath = path.join(import.meta.dirname, "fixtures", "hello.ts");

async function runOnce(handoffRoot: string) {
  const proof = defineProof({
    id: "snap",
    title: "Snapshot test",
    cwd: import.meta.dirname,
    handoffRoot,
    width: 80,
    height: 24,
  });

  return proof.run({
    launch: { command: "bun", args: ["run", fixturePath] },
    steps: [
      {
        id: "wait-hello",
        actions: [
          { expectText: "hello" },
          { expectSnapshot: "01-hello" },
        ],
      },
    ],
    verify: () => {},
  });
}

test("snapshot: first run writes file, second run matches", async () => {
  const root = mkdtempSync(path.join(tmpRoot, "case1-"));

  const r1 = await runOnce(root);
  expect(r1.status).toBe("pass");
  expect(existsSync(path.join(root, "__snapshots__", "01-hello.txt"))).toBe(
    true,
  );

  const r2 = await runOnce(root);
  expect(r2.status).toBe("pass");
});

test("snapshot: mutated snapshot file produces mismatch + diff", async () => {
  const root = mkdtempSync(path.join(tmpRoot, "case2-"));

  const r1 = await runOnce(root);
  expect(r1.status).toBe("pass");

  writeFileSync(
    path.join(root, "__snapshots__", "01-hello.txt"),
    "totally different content",
  );

  const r2 = await runOnce(root);
  expect(r2.status).toBe("fail");
  expect(r2.stage).toBe("wait-hello");
  expect(
    existsSync(path.join(root, "evidence", "diffs", "01-hello.diff.txt")),
  ).toBe(true);
});

test("snapshot: PROOFKIT_UPDATE_SNAPSHOTS rewrites stale snapshot", async () => {
  const root = mkdtempSync(path.join(tmpRoot, "case3-"));

  // Seed with first run.
  await runOnce(root);
  const snapPath = path.join(root, "__snapshots__", "01-hello.txt");
  writeFileSync(snapPath, "stale content");

  process.env["PROOFKIT_UPDATE_SNAPSHOTS"] = "1";
  try {
    const r = await runOnce(root);
    expect(r.status).toBe("pass");
    const updated = readFileSync(snapPath, "utf-8");
    expect(updated).not.toBe("stale content");
    expect(updated).toContain("hello");
  } finally {
    delete process.env["PROOFKIT_UPDATE_SNAPSHOTS"];
  }
});
