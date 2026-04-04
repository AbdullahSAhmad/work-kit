import { WorkKitState, PhaseName, SUBSTAGES_BY_PHASE } from "../state/schema.js";
import { PHASE_ORDER } from "../config/phases.js";

export interface NextStep {
  type: "sub-stage" | "phase-boundary" | "complete" | "wait-for-user";
  phase?: PhaseName;
  subStage?: string;
  message?: string;
}

/**
 * Find the next pending sub-stage within a phase.
 */
export function nextSubStageInPhase(state: WorkKitState, phase: PhaseName): string | null {
  const phaseState = state.phases[phase];
  const subStages = SUBSTAGES_BY_PHASE[phase];

  for (const ss of subStages) {
    const ssState = phaseState.subStages[ss];
    if (ssState && (ssState.status === "pending" || ssState.status === "in-progress")) {
      return ss;
    }
  }
  return null;
}

/**
 * Check if all non-skipped sub-stages in a phase are completed.
 */
export function isPhaseComplete(state: WorkKitState, phase: PhaseName): boolean {
  const phaseState = state.phases[phase];
  return Object.values(phaseState.subStages).every(
    (ss) => ss.status === "completed" || ss.status === "skipped"
  );
}

/**
 * Find the next phase that needs work.
 */
export function nextPhase(state: WorkKitState): PhaseName | null {
  for (const phase of PHASE_ORDER) {
    const ps = state.phases[phase];
    if (ps.status === "pending" || ps.status === "in-progress") {
      return phase;
    }
  }
  return null;
}

/**
 * Determine the next step in the workflow.
 */
export function determineNextStep(state: WorkKitState): NextStep {
  if (state.status === "completed") {
    return { type: "complete", message: "Work-kit is complete" };
  }

  const currentPhase = state.currentPhase;

  if (!currentPhase) {
    // Find the next phase
    const next = nextPhase(state);
    if (!next) {
      return { type: "complete", message: "All phases complete" };
    }
    return { type: "phase-boundary", phase: next, message: `Starting ${next} phase` };
  }

  // Check if current phase is complete
  if (isPhaseComplete(state, currentPhase)) {
    // Find next phase
    const phaseIndex = PHASE_ORDER.indexOf(currentPhase);
    const remainingPhases = PHASE_ORDER.slice(phaseIndex + 1);

    for (const phase of remainingPhases) {
      const ps = state.phases[phase];
      if (ps.status !== "skipped") {
        if (state.gated) {
          // Gated mode — wait for user confirmation before crossing
          return {
            type: "wait-for-user",
            phase,
            message: `${currentPhase} phase complete. Ready to start ${phase}. Proceed?`,
          };
        }
        // Default — auto-proceed to next phase
        return { type: "phase-boundary", phase, message: `${currentPhase} complete → starting ${phase}` };
      }
    }

    return { type: "complete", message: "All phases complete" };
  }

  // Find next sub-stage within current phase
  const nextSS = nextSubStageInPhase(state, currentPhase);
  if (nextSS) {
    return { type: "sub-stage", phase: currentPhase, subStage: nextSS };
  }

  return { type: "complete", message: `${currentPhase} phase complete` };
}
