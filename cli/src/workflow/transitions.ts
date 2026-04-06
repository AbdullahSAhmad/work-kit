import { WorkKitState, PhaseName, STEPS_BY_PHASE } from "../state/schema.js";
import { PHASE_ORDER } from "../config/workflow.js";

export interface NextStep {
  type: "step" | "phase-boundary" | "complete" | "wait-for-user";
  phase?: PhaseName;
  step?: string;
  message?: string;
}

/**
 * Find the next pending step within a phase.
 */
export function nextStepInPhase(state: WorkKitState, phase: PhaseName): string | null {
  const phaseState = state.phases[phase];
  const steps = STEPS_BY_PHASE[phase];

  for (const step of steps) {
    const stepState = phaseState.steps[step];
    if (stepState && (stepState.status === "pending" || stepState.status === "in-progress" || stepState.status === "waiting")) {
      return step;
    }
  }
  return null;
}

/**
 * Check if all non-skipped steps in a phase are completed.
 */
export function isPhaseComplete(state: WorkKitState, phase: PhaseName): boolean {
  const phaseState = state.phases[phase];
  return Object.values(phaseState.steps).every(
    (s) => s.status === "completed" || s.status === "skipped"
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
    const next = nextPhase(state);
    if (!next) {
      return { type: "complete", message: "All phases complete" };
    }
    return { type: "phase-boundary", phase: next, message: `Starting ${next} phase` };
  }

  // Check if current phase is complete
  if (isPhaseComplete(state, currentPhase)) {
    const phaseIndex = PHASE_ORDER.indexOf(currentPhase);
    const remainingPhases = PHASE_ORDER.slice(phaseIndex + 1);

    for (const phase of remainingPhases) {
      const ps = state.phases[phase];
      if (ps.status !== "skipped") {
        if (state.gated) {
          return {
            type: "wait-for-user",
            phase,
            message: `${currentPhase} phase complete. Ready to start ${phase}. Proceed?`,
          };
        }
        return { type: "phase-boundary", phase, message: `${currentPhase} complete → starting ${phase}` };
      }
    }

    return { type: "complete", message: "All phases complete" };
  }

  // Find next step within current phase
  const next = nextStepInPhase(state, currentPhase);
  if (next) {
    return { type: "step", phase: currentPhase, step: next };
  }

  return { type: "complete", message: `${currentPhase} phase complete` };
}
