/**
 * Outcome derivation. Pure function of a validated receipt.
 *
 * Routing-relevant steps map their evidence fields onto a StepOutcome
 * the loopback table understands. Evidence-only steps always derive
 * `done` (or `needs_debug` if the receipt carries an error).
 */

import type { StepOutcome } from "../state/schema.js";
import type { Receipt } from "./schemas.js";

/**
 * Derive the StepOutcome from a validated receipt.
 *
 * `error` field on any receipt forces `needs_debug`, regardless of step.
 * Otherwise the step-specific rule applies. The discriminated union on
 * `receipt.step` narrows each branch — no casts needed.
 */
export function deriveOutcome(receipt: Receipt): StepOutcome {
  if (receipt.error) return "needs_debug";

  switch (receipt.step) {
    case "plan/audit":
      return receipt.gaps.length > 0 ? "revise" : "done";

    case "build/implement":
      return receipt.tests_passing ? "done" : "needs_debug";

    case "test/validate":
      // No loopback route exists for test/validate today — `revise` surfaces
      // the failed verdict to the user without auto-routing back to Build.
      return receipt.verdict === "pass" ? "done" : "revise";

    case "review/resolve":
      return receipt.ship_decision === "approved" ? "approved" : "changes_requested";

    case "deploy/ship":
      if (!receipt.merged) return "fix_needed";
      if (receipt.monitor_status === "red") return "fix_needed";
      return "done";

    default:
      return "done";
  }
}
