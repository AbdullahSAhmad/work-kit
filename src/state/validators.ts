import { WorkKitState, PhaseName } from "./schema.js";
import { PHASE_PREREQUISITES } from "../config/phases.js";

export interface ValidationResult {
  valid: boolean;
  message: string;
  missingPrerequisite?: PhaseName;
}

export function validatePhasePrerequisites(state: WorkKitState, phase: PhaseName): ValidationResult {
  const prereq = PHASE_PREREQUISITES[phase];

  if (!prereq) {
    return { valid: true, message: `${phase} has no prerequisites` };
  }

  // Special case: wrap-up can proceed after review OR deploy
  if (phase === "wrap-up") {
    const reviewDone = state.phases.review.status === "completed";
    const deployStatus = state.phases.deploy.status;

    if (!reviewDone) {
      return {
        valid: false,
        message: `wrap-up requires review to be complete. Current: ${state.phases.review.status}`,
        missingPrerequisite: "review",
      };
    }

    if (deployStatus === "in-progress") {
      return {
        valid: false,
        message: `wrap-up requires deploy to finish first. Current: ${deployStatus}`,
        missingPrerequisite: "deploy",
      };
    }

    // deploy completed, skipped, or pending (never started) — all ok if review is done
    return { valid: true, message: "Prerequisites met for wrap-up" };
  }

  // Special case: deploy requires review complete AND handoff approved
  if (phase === "deploy") {
    const reviewState = state.phases.review;
    if (reviewState.status !== "completed") {
      return {
        valid: false,
        message: `deploy requires review to be complete. Current: ${reviewState.status}`,
        missingPrerequisite: "review",
      };
    }
    const handoff = reviewState.subStages["handoff"];
    if (!handoff) {
      return {
        valid: false,
        message: `deploy requires review/handoff to exist and be approved. Handoff sub-stage not found.`,
        missingPrerequisite: "review",
      };
    }
    if (handoff.outcome !== "approved") {
      return {
        valid: false,
        message: `deploy requires review/handoff outcome to be "approved". Current: ${handoff.outcome || "none"}`,
        missingPrerequisite: "review",
      };
    }
    return { valid: true, message: "Prerequisites met for deploy" };
  }

  // General case
  const prereqState = state.phases[prereq];
  if (prereqState.status !== "completed") {
    return {
      valid: false,
      message: `${phase} requires ${prereq} to be complete. Current: ${prereqState.status}`,
      missingPrerequisite: prereq,
    };
  }

  return { valid: true, message: `Prerequisites met for ${phase}` };
}
