import { PHASE_NAMES, STEPS_BY_PHASE } from "./schema.js";
import type { Location, PhaseName, WorkKitState } from "./schema.js";

/**
 * Mutate a state object to flip a paused session into in-progress.
 * Caller is responsible for persisting via writeState. Returns true
 * when state changed, false when no transition was applicable.
 */
export function unpause(state: WorkKitState): boolean {
  if (state.status !== "paused") return false;
  state.status = "in-progress";
  delete state.pausedAt;
  return true;
}
import { PHASE_ORDER } from "../config/workflow.js";

/**
 * Parse "phase/step" string into a Location object.
 * Validates that the phase is a known phase name and the step exists.
 */
export function parseLocation(input: string): Location {
  const parts = input.split("/");
  if (parts.length !== 2) {
    throw new Error(`Invalid location "${input}". Expected format: phase/step (e.g., plan/understand)`);
  }
  const [phase, step] = parts;
  if (!PHASE_NAMES.includes(phase as PhaseName)) {
    throw new Error(`Unknown phase "${phase}". Valid phases: ${PHASE_NAMES.join(", ")}`);
  }
  const validSteps = STEPS_BY_PHASE[phase as PhaseName];
  if (!validSteps.includes(step)) {
    throw new Error(`Unknown step "${step}" in phase "${phase}". Valid: ${validSteps.join(", ")}`);
  }
  return { phase: phase as PhaseName, step };
}

/**
 * Reset state from a target location forward: marks the target step
 * and all subsequent steps/phases as pending.
 */
export function resetToLocation(state: WorkKitState, location: Location): void {
  const targetPhaseState = state.phases[location.phase];
  if (!targetPhaseState) {
    throw new Error(`Phase "${location.phase}" not found in state`);
  }
  if (!targetPhaseState.steps[location.step]) {
    throw new Error(`Step "${location.step}" not found in phase "${location.phase}"`);
  }

  let reset = false;
  for (const [s, sState] of Object.entries(targetPhaseState.steps)) {
    if (s === location.step) reset = true;
    if (reset && (sState.status === "completed" || sState.status === "waiting")) {
      sState.status = "pending";
      delete sState.completedAt;
      delete sState.outcome;
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
      for (const sState of Object.values(laterPhaseState.steps)) {
        if (sState.status === "completed") {
          sState.status = "pending";
          delete sState.completedAt;
          delete sState.outcome;
        }
      }
    }
  }
}
