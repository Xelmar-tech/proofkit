import { test, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineProof } from "../src/index.ts";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "proofkit-cast-test-"));
afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

test("cast file has valid v2 header and well-formed event lines", async () => {
  const proof = defineProof({
    id: "cast",
    title: "Cast format validation",
    cwd: import.meta.dirname,
    handoffRoot: tmpRoot,
    width: 80,
    height: 24,
  });

  await proof.run({
    launch: {
      command: "bun",
      args: ["run", path.join(import.meta.dirname, "fixtures", "hello.ts")],
    },
    steps: [{ id: "wait", actions: [{ expectText: "hello" }] }],
    verify: () => {},
  });

  const castPath = path.join(tmpRoot, "evidence", "casts", "cast.cast");
  const lines = readFileSync(castPath, "utf-8").trim().split("\n");

  expect(lines.length).toBeGreaterThan(1);

  const header = JSON.parse(lines[0]!);
  expect(header.version).toBe(2);
  expect(header.width).toBe(80);
  expect(header.height).toBe(24);
  expect(typeof header.timestamp).toBe("number");

  for (let i = 1; i < lines.length; i++) {
    const evt = JSON.parse(lines[i]!) as unknown;
    expect(Array.isArray(evt)).toBe(true);
    const arr = evt as unknown[];
    expect(arr.length).toBe(3);
    expect(typeof arr[0]).toBe("number");
    expect(arr[1]).toBe("o");
    expect(typeof arr[2]).toBe("string");
  }
});
