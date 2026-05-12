# tui-proof-kit

## 0.2.0

### Minor Changes

- 841713b: Adopt `@xterm/headless` as the driver's virtual screen model.

  The append-only string buffer is replaced with a real terminal emulator (the
  same engine that powers VS Code's integrated terminal). This fixes both
  known v0.1 limitations in one change:
  - **Stale-text matching** — `expectText("X")` now searches the current
    virtual screen, not a transcript of every byte ever written. The
    "Would you like to use TypeScript?" workaround in the `create-next-app`
    showcase is no longer needed.
  - **Snapshot bloat from in-place redraws** — `\r`-driven prompt redraws,
    alt-screen toggles, and cursor positioning are now handled correctly.
    Captures reflect what a human would see on screen.

  The cast file format is unchanged — recordings still capture the raw byte
  stream verbatim.

  **Migration:** consumers with committed snapshots need to re-seed them
  once with `PROOFKIT_UPDATE_SNAPSHOTS=1`. The regenerated snapshots will be
  visibly cleaner.

  **Also in this release:** REPORT.html now inlines the cast content into
  the page so `asciinema-player` works under Chrome's `file://` security
  policy (no more failed-fetch glyph).

  **New dependency:** `@xterm/headless@^6.0.0` (~200 KB unpacked).

  Per `DECISION-buffer-model.html` v2.

- Initial public release: monorepo migration, Fumadocs site, CI/CD workflows, and proofkit skill for coding agents.
