import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDriver } from "./driver.ts";
import { renderReport } from "./report.ts";
import { compareOrWrite } from "./snapshot.ts";
import type {
  ProofConfig,
  ProofSpec,
  ProofContext,
  Finding,
  Redactor,
  ProofResult,
} from "./types.ts";

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const redact = (s: string, r?: Redactor[]): string =>
  (r ?? []).reduce((a, x) => a.replace(x.pattern, x.replacement), s);

export function defineProof(config: ProofConfig) {
  const handoffDir = (sub: string): string => {
    const p = path.join(config.handoffRoot, "evidence", sub);
    mkdirSync(p, { recursive: true });
    return p;
  };
  const snapshotsDir = path.join(config.handoffRoot, "__snapshots__");

  return {
    async run(spec: ProofSpec): Promise<ProofResult> {
      const castPath = path.join(handoffDir("casts"), `${config.id}.cast`);
      const captures: Record<string, string> = {};
      const snapshotDiffs: Array<{
        id: string;
        expected: string;
        actual: string;
      }> = [];
      const updateMode = process.env["PROOFKIT_UPDATE_SNAPSHOTS"] === "1";

      // Filter env to strings (node-pty doesn't accept undefined values).
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries({
        ...process.env,
        ...spec.launch.env,
      })) {
        if (v !== undefined) env[k] = v;
      }

      const driver = createDriver({
        command: spec.launch.command,
        args: spec.launch.args ?? [],
        cwd: config.cwd,
        env,
        cols: config.width,
        rows: config.height,
        castPath,
      });

      const ctx: ProofContext = {
        vars: {},
        findings: [],
        result: { status: "unknown", message: "" },
        capture: (id) => captures[id] ?? "",
        finding: (f: Finding) => {
          ctx.findings.push(f);
        },
      };

      try {
        if (spec.prepare) await spec.prepare(ctx);

        outer: for (const step of spec.steps) {
          for (const action of step.actions) {
            if ("expectText" in action) {
              const ok = await driver.waitForText(
                action.expectText,
                action.timeoutMs ?? 15_000,
              );
              if (!ok) {
                ctx.result = {
                  status: "blocked",
                  message: `Expected text not visible: ${action.expectText}`,
                  stage: step.id,
                };
                writeFileSync(
                  path.join(handoffDir("captures"), `${step.id}-blocked.txt`),
                  redact(driver.captureFrame(), config.redactors),
                );
                break outer;
              }
            } else if ("capture" in action) {
              const frame = redact(driver.captureFrame(), config.redactors);
              captures[action.capture] = frame;
              writeFileSync(
                path.join(handoffDir("captures"), `${action.capture}.txt`),
                frame,
              );
            } else if ("expectSnapshot" in action) {
              const frame = redact(driver.captureFrame(), config.redactors);
              captures[action.expectSnapshot] = frame;
              writeFileSync(
                path.join(
                  handoffDir("captures"),
                  `${action.expectSnapshot}.txt`,
                ),
                frame,
              );
              const localUpdate = updateMode || action.update === true;
              const snapshotResult = compareOrWrite(
                action.expectSnapshot,
                frame,
                snapshotsDir,
                localUpdate,
              );
              if (snapshotResult.status === "wrote") {
                ctx.findings.push({
                  status: "info",
                  title: `snapshot ${updateMode ? "updated" : "created"}`,
                  body: `${action.expectSnapshot} -> ${snapshotResult.path}`,
                });
              } else if (snapshotResult.status === "mismatch") {
                snapshotDiffs.push({
                  id: action.expectSnapshot,
                  expected: snapshotResult.expected,
                  actual: snapshotResult.actual,
                });
                writeFileSync(
                  path.join(
                    handoffDir("diffs"),
                    `${action.expectSnapshot}.diff.txt`,
                  ),
                  `=== expected (${snapshotResult.path})\n${snapshotResult.expected}\n\n=== actual\n${snapshotResult.actual}\n`,
                );
                ctx.findings.push({
                  status: "fail",
                  title: "snapshot mismatch",
                  body: action.expectSnapshot,
                });
                ctx.result = {
                  status: "fail",
                  message: `Snapshot mismatch: ${action.expectSnapshot}`,
                  stage: step.id,
                };
                break outer;
              }
            } else if ("type" in action) {
              const text =
                typeof action.type === "function"
                  ? action.type(ctx)
                  : action.type;
              driver.typeText(text);
              await sleep(80);
            } else if ("press" in action) {
              const k = action.press;
              if (k === "Enter") driver.pressEnter();
              else if (k === "Escape") driver.pressEscape();
              else if (k === "Backspace") driver.pressBackspace();
              else driver.pressKey(k);
              await sleep(80);
            } else if ("waitMs" in action) {
              await sleep(action.waitMs);
            } else if ("resolve" in action) {
              ctx.vars[action.var] = await action.resolve(ctx);
            }
          }
        }

        if (ctx.result.status === "unknown") {
          try {
            spec.verify(ctx);
            ctx.result = {
              status: "pass",
              message: "all steps and verify succeeded",
            };
          } catch (e) {
            ctx.result = {
              status: "fail",
              message: `verify threw: ${e instanceof Error ? e.message : String(e)}`,
            };
          }
        }
      } finally {
        await driver.stop();
        writeFileSync(
          path.join(handoffDir("logs"), `${config.id}-result.json`),
          JSON.stringify(ctx.result, null, 2),
        );
        const html = renderReport({
          id: config.id,
          title: config.title,
          ctx,
          captures,
          snapshotDiffs,
          castRel: `evidence/casts/${config.id}.cast`,
        });
        writeFileSync(
          path.join(config.handoffRoot, `${config.id}-REPORT.html`),
          html,
        );
      }

      return ctx.result;
    },
  };
}
