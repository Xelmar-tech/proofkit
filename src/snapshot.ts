import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type SnapshotResult =
  | { status: "wrote"; path: string }
  | { status: "match" }
  | { status: "mismatch"; expected: string; actual: string; path: string };

// Trailing-whitespace normalization. Cursor blink characters and right-padding
// space cause noisy diffs without changing the visible content; we strip both
// before comparing.
const normalize = (s: string): string =>
  s
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");

export function compareOrWrite(
  id: string,
  current: string,
  snapshotsDir: string,
  updateMode: boolean,
): SnapshotResult {
  mkdirSync(snapshotsDir, { recursive: true });
  const snapshotPath = path.join(snapshotsDir, `${id}.txt`);
  const normalized = normalize(current);

  if (updateMode || !existsSync(snapshotPath)) {
    writeFileSync(snapshotPath, normalized);
    return { status: "wrote", path: snapshotPath };
  }

  const expected = normalize(readFileSync(snapshotPath, "utf-8"));
  if (expected === normalized) {
    return { status: "match" };
  }
  return {
    status: "mismatch",
    expected,
    actual: normalized,
    path: snapshotPath,
  };
}
