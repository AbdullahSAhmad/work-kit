import { PHASE_PREREQUISITES } from "../config/workflow.js";
import { PhaseName, WorkKitState } from "./schema.js";

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
    const resolve = reviewState.steps["resolve"];
    if (!resolve) {
      return {
        valid: false,
        message: `deploy requires review/resolve to exist and be approved. Resolve step not found.`,
        missingPrerequisite: "review",
      };
    }
    if (resolve.outcome !== "approved") {
      return {
        valid: false,
        message: `deploy requires review/resolve outcome to be "approved". Current: ${resolve.outcome || "none"}`,
        missingPrerequisite: "review",
      };
    }
    return { valid: true, message: "Prerequisites met for deploy" };
  }

  // General case: completed OR fully skipped both satisfy the prerequisite.
  const prereqState = state.phases[prereq];
  if (prereqState.status !== "completed" && prereqState.status !== "skipped") {
    return {
      valid: false,
      message: `${phase} requires ${prereq} to be complete. Current: ${prereqState.status}`,
      missingPrerequisite: prereq,
    };
  }

  return { valid: true, message: `Prerequisites met for ${phase}` };
}
