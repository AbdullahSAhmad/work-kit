/**
 * Structured receipts each step writes when it finishes.
 *
 * Receipts replace agent-chosen `--outcome` flags with evidence the CLI
 * derives outcomes from. The agent's job becomes filling out the form;
 * routing decisions live in derive.ts as pure functions of receipt fields.
 *
 * Free-form prose still lives in state.md — receipts only carry the data
 * the state machine needs to route the workflow.
 */

import type { Classification } from "../state/schema.js";

export const RECEIPT_VERSION = 1;

export interface ReceiptError {
  kind: string;
  message: string;
  details?: unknown;
}

interface BaseReceipt {
  version: typeof RECEIPT_VERSION;
  step: string;
  timestamp: string;
  notes?: string;
  /** Presence forces the derived outcome to needs_debug regardless of step. */
  error?: ReceiptError;
}

// ── Routing-relevant receipts ───────────────────────────────────────

export interface TriageClassifyReceipt extends BaseReceipt {
  step: "triage/classify";
  classification: Classification;
  signals: {
    ui?: boolean;
    db?: boolean;
    public_api?: boolean;
    risk_level?: "low" | "medium" | "high";
  };
  rationale?: string;
}

export interface PlanAuditReceipt extends BaseReceipt {
  step: "plan/audit";
  gaps: { id: string; where: string; description: string }[];
  deviations?: { description: string }[];
}

export interface BuildImplementReceipt extends BaseReceipt {
  step: "build/implement";
  tests_passing: boolean;
  test_command: string;
  test_output_summary?: string;
  criteria_implemented?: string[];
  deviations?: { description: string }[];
}

export interface TestValidateReceipt extends BaseReceipt {
  step: "test/validate";
  criteria: { id: string; status: "pass" | "fail" | "untested"; evidence?: string }[];
  verdict: "pass" | "fail" | "partial";
  confidence?: "low" | "medium" | "high";
}

export interface ReviewResolveReceipt extends BaseReceipt {
  step: "review/resolve";
  ship_decision: "approved" | "changes_requested";
  blocking_issues_resolved?: number;
  blocking_issues_remaining?: number;
  fixes_applied?: string[];
}

export interface DeployShipReceipt extends BaseReceipt {
  step: "deploy/ship";
  merged: boolean;
  pr_url?: string;
  monitor_status: "green" | "yellow" | "red" | "skipped";
  issues_observed?: { description: string }[];
}

// ── Evidence-only receipts (always derive `done`) ───────────────────

export interface PlanUnderstandReceipt extends BaseReceipt {
  step: "plan/understand";
  criteria: { id: string; description: string }[];
}

export interface PlanDesignReceipt extends BaseReceipt {
  step: "plan/design";
  blueprint_section: string;
}

export interface BuildSetupReceipt extends BaseReceipt {
  step: "build/setup";
  branch?: string;
  deps_installed?: boolean;
  migrations_applied?: string[];
}

export interface BuildCommitReceipt extends BaseReceipt {
  step: "build/commit";
  commits: string[];
  diff_summary?: string;
}

export interface TestExerciseReceipt extends BaseReceipt {
  step: "test/exercise";
  lenses_run: ("verify" | "e2e" | "browser")[];
  lenses_skipped?: { lens: string; reason: string }[];
  per_lens?: Record<string, { passed: boolean; notes?: string }>;
}

export interface ReviewScopeReceipt extends BaseReceipt {
  step: "review/scope";
  diff_classification: {
    ui?: boolean;
    backend?: boolean;
    security_surface?: boolean;
    compliance_surface?: boolean;
  };
  lenses_to_run: ("quality" | "efficiency" | "security" | "compliance")[];
  files_in_scope?: number;
}

export interface ReviewReviewReceipt extends BaseReceipt {
  step: "review/review";
  lenses_run: string[];
  findings_by_lens?: Record<string, { blocking: number; non_blocking: number }>;
}

export interface WrapupFinalizeReceipt extends BaseReceipt {
  step: "wrap-up/finalize";
  summary_path?: string;
  extracted?: {
    findings: number;
    workflow: number;
  };
}

export type Receipt =
  | TriageClassifyReceipt
  | PlanUnderstandReceipt
  | PlanDesignReceipt
  | PlanAuditReceipt
  | BuildSetupReceipt
  | BuildImplementReceipt
  | BuildCommitReceipt
  | TestExerciseReceipt
  | TestValidateReceipt
  | ReviewScopeReceipt
  | ReviewReviewReceipt
  | ReviewResolveReceipt
  | DeployShipReceipt
  | WrapupFinalizeReceipt;

/** Step keys that have a receipt schema. Used by the validator and run loop. */
export const RECEIPT_STEP_KEYS = [
  "triage/classify",
  "plan/understand",
  "plan/design",
  "plan/audit",
  "build/setup",
  "build/implement",
  "build/commit",
  "test/exercise",
  "test/validate",
  "review/scope",
  "review/review",
  "review/resolve",
  "deploy/ship",
  "wrap-up/finalize",
] as const satisfies readonly Receipt["step"][];

export type ReceiptStepKey = (typeof RECEIPT_STEP_KEYS)[number];

const RECEIPT_STEP_KEY_SET: ReadonlySet<string> = new Set(RECEIPT_STEP_KEYS);

export function isReceiptStepKey(value: string): value is ReceiptStepKey {
  return RECEIPT_STEP_KEY_SET.has(value);
}
