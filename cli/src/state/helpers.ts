import { PHASE_NAMES, SUBSTAGES_BY_PHASE } from "./schema.js";
import type { Location, PhaseName, WorkKitState } from "./schema.js";
import { PHASE_ORDER } from "../config/phases.js";

/**
 * Parse "phase/sub-stage" string into a Location object.
 * Validates that the phase is a known phase name and the sub-stage exists.
 */
export function parseLocation(input: string): Location {
  const parts = input.split("/");
  if (parts.length !== 2) {
    throw new Error(`Invalid location "${input}". Expected format: phase/sub-stage (e.g., plan/clarify)`);
  }
  const [phase, subStage] = parts;
  if (!PHASE_NAMES.includes(phase as PhaseName)) {
    throw new Error(`Unknown phase "${phase}". Valid phases: ${PHASE_NAMES.join(", ")}`);
  }
  const validSubStages = SUBSTAGES_BY_PHASE[phase as PhaseName];
  if (!validSubStages.includes(subStage)) {
    throw new Error(`Unknown sub-stage "${subStage}" in phase "${phase}". Valid: ${validSubStages.join(", ")}`);
  }
  return { phase: phase as PhaseName, subStage };
}

/**
 * Reset state from a target location forward: marks the target sub-stage
 * and all subsequent sub-stages/phases as pending.
 */
export function resetToLocation(state: WorkKitState, location: Location): void {
  const targetPhaseState = state.phases[location.phase];
  if (!targetPhaseState) {
    throw new Error(`Phase "${location.phase}" not found in state`);
  }
  if (!targetPhaseState.subStages[location.subStage]) {
    throw new Error(`Sub-stage "${location.subStage}" not found in phase "${location.phase}"`);
  }

  let reset = false;
  for (const [ss, ssState] of Object.entries(targetPhaseState.subStages)) {
    if (ss === location.subStage) reset = true;
    if (reset && ssState.status === "completed") {
      ssState.status = "pending";
      delete ssState.completedAt;
      delete ssState.outcome;
    }
  }
  targetPhaseState.status = "in-progress";

  const targetPhaseIdx = PHASE_ORDER.indexOf(location.phase);
  for (let i = targetPhaseIdx + 1; i < PHASE_ORDER.length; i++) {
    const laterPhase = PHASE_ORDER[i];
    const laterPhaseState = state.phases[laterPhase];
    if (laterPhaseState.status === "completed") {
      laterPhaseState.status = "pending";
      delete laterPhaseState.completedAt;
      for (const ssState of Object.values(laterPhaseState.subStages)) {
        if (ssState.status === "completed") {
          ssState.status = "pending";
          delete ssState.completedAt;
          delete ssState.outcome;
        }
      }
    }
  }
}
