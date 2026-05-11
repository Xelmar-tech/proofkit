// @capxul/proofkit — drive terminal apps, record sessions, produce evidence packs.
//
// Public API: exactly one function (`defineProof`) and the types its callers
// need to construct configurations and read back results.
export { defineProof } from "./proof.ts";

export type {
  ProofConfig,
  ProofSpec,
  Step,
  Action,
  PressKey,
  ProofContext,
  Finding,
  ProofResult,
  Redactor,
} from "./types.ts";
