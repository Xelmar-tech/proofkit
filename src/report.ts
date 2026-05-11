import type { ProofContext, Finding } from "./types.ts";

interface ReportInput {
  id: string;
  title: string;
  ctx: ProofContext;
  captures: Record<string, string>;
  snapshotDiffs: Array<{ id: string; expected: string; actual: string }>;
  castRel: string;
}

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function renderReport(input: ReportInput): string {
  const { title, ctx, captures, snapshotDiffs, castRel } = input;

  const statusClass =
    ctx.result.status === "pass"
      ? "pass"
      : ctx.result.status === "fail" || ctx.result.status === "blocked"
        ? "fail"
        : "info";

  const findingRows = ctx.findings
    .map((f: Finding) => {
      const cls =
        f.status === "pass" ? "pass" : f.status === "info" ? "info" : "fail";
      return `<tr><td class="${cls}">${escape(f.status)}</td><td>${escape(f.title)}</td><td>${escape(f.body)}</td></tr>`;
    })
    .join("\n");

  const captureBlocks = Object.entries(captures)
    .map(
      ([k, v]) =>
        `<details><summary>${escape(k)}</summary><pre>${escape(v)}</pre></details>`,
    )
    .join("\n");

  const diffBlocks = snapshotDiffs
    .map(
      (d) =>
        `<section class="diff"><h3>Snapshot mismatch: ${escape(d.id)}</h3>` +
        `<div class="diff-pair">` +
        `<div><h4>Expected (committed)</h4><pre>${escape(d.expected)}</pre></div>` +
        `<div><h4>Actual (current)</h4><pre>${escape(d.actual)}</pre></div>` +
        `</div></section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escape(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/asciinema-player@3/dist/bundle/asciinema-player.css">
<script src="https://cdn.jsdelivr.net/npm/asciinema-player@3/dist/bundle/asciinema-player.min.js"></script>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #fafaf7; color: #1c1c1c; line-height: 1.55; }
  main { max-width: 1080px; margin: 0 auto; padding: 32px 24px 80px; }
  h1 { margin: 0 0 8px; font-size: 24px; }
  h2 { margin: 32px 0 12px; font-size: 18px; border-bottom: 1px solid #e2ddcf; padding-bottom: 4px; }
  h3 { margin: 18px 0 8px; font-size: 15px; }
  h4 { margin: 12px 0 6px; font-size: 13px; color: #555; }
  .pass { color: #166534; font-weight: 700; }
  .fail { color: #991b1b; font-weight: 700; }
  .info { color: #92400e; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border-bottom: 1px solid #e2ddcf; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #f1ede2; }
  pre { background: #07091a; color: #e2e8f0; padding: 12px 14px; border-radius: 6px; overflow: auto; font-size: 12.5px; line-height: 1.5; font-family: ui-monospace, "JetBrains Mono", Menlo, monospace; white-space: pre-wrap; }
  details { margin: 6px 0; background: #f6f3eb; border: 1px solid #e2ddcf; border-radius: 6px; padding: 8px 12px; }
  summary { cursor: pointer; font-weight: 600; }
  .diff-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .diff { background: #fff5f5; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin: 16px 0; }
  #player { margin: 16px 0; }
</style>
</head>
<body>
<main>
  <h1>${escape(title)}</h1>
  <table style="max-width: 520px;">
    <tr><th>Status</th><td class="${statusClass}">${escape(ctx.result.status)}</td></tr>
    <tr><th>Message</th><td>${escape(ctx.result.message)}</td></tr>
    ${ctx.result.stage ? `<tr><th>Stage</th><td>${escape(ctx.result.stage)}</td></tr>` : ""}
  </table>

  <h2>Recording</h2>
  <div id="player"></div>
  <script>
    AsciinemaPlayer.create(${JSON.stringify(castRel)}, document.getElementById("player"), {
      autoPlay: false, speed: 1.5, idleTimeLimit: 2
    });
  </script>

  ${ctx.findings.length ? `<h2>Findings</h2><table><thead><tr><th>Status</th><th>Title</th><th>Detail</th></tr></thead><tbody>${findingRows}</tbody></table>` : ""}

  ${snapshotDiffs.length ? `<h2>Snapshot mismatches</h2>${diffBlocks}` : ""}

  <h2>Captured frames</h2>
  ${captureBlocks || "<p>No captures.</p>"}
</main>
</body>
</html>
`;
}
