// Public type definitions for @capxul/proofkit.
// Anything not re-exported from src/index.ts is private and may change without
// a major version bump.

export interface ProofConfig {
  /** Stable identifier for this proof — used in file names. */
  id: string;
  /** Human-readable title — used in the HTML report. */
  title: string;
  /** Working directory for the spawned child process. */
  cwd: string;
  /**
   * Root directory where evidence/, __snapshots__/, and the REPORT.html land.
   * Created if it doesn't exist.
   */
  handoffRoot: string;
  /** Terminal width in columns. */
  width: number;
  /** Terminal height in rows. */
  height: number;
  /** Patterns to redact from captured frames before they're written or compared. */
  redactors?: Redactor[];
}

export interface ProofSpec {
  /** Async setup. Runs before the app is spawned. Use for fixture allocation. */
  prepare?: (ctx: ProofContext) => Promise<void>;
  /** How to launch the app under test. */
  launch: { command: string; args?: string[]; env?: NodeJS.ProcessEnv };
  /** Ordered sequence of steps. The runner stops at the first failed expect. */
  steps: Step[];
  /** Final synchronous assertions. Throwing fails the proof. */
  verify: (ctx: ProofContext) => void;
}

export interface Step {
  id: string;
  actions: Action[];
}

export type Action =
  | { expectText: string; timeoutMs?: number }
  | { capture: string }
  | { expectSnapshot: string; update?: boolean }
  | { type: string | ((ctx: ProofContext) => string) }
  | { press: PressKey }
  | { waitMs: number }
  | { resolve: (ctx: ProofContext) => Promise<unknown>; var: string };

export type PressKey =
  | "Enter"
  | "Escape"
  | "Backspace"
  | "Tab"
  | "Up"
  | "Down"
  | "Left"
  | "Right";

export interface ProofContext {
  /** Per-proof scratch space. resolve actions write here; type/verify read. */
  vars: Record<string, unknown>;
  /** Append-only log of structured findings — surfaced in REPORT.html. */
  findings: Finding[];
  /** Final result. The runner fills this in; verify can mutate it. */
  result: ProofResult;
  /** Look up a captured frame by id. */
  capture: (id: string) => string;
  /** Push a finding. */
  finding: (f: Finding) => void;
}

export interface Finding {
  status: "pass" | "info" | "fail";
  title: string;
  body: string;
}

export interface ProofResult {
  status: "pass" | "fail" | "blocked" | "unknown";
  message: string;
  stage?: string;
}

export interface Redactor {
  pattern: RegExp;
  replacement: string;
}
