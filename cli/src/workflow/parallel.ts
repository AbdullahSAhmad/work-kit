import type { PhaseName, WorkKitState } from "../state/schema.js";

/**
 * Defines which steps run in parallel and which runs sequentially after.
 */
export interface ParallelGroup {
  parallel: string[];          // steps that run concurrently
  thenSequential?: string;     // step that runs after all parallel complete
}

/**
 * Parallel group definitions per phase.
 */
const PARALLEL_GROUPS: Record<string, ParallelGroup> = {
  test: {
    parallel: ["verify", "e2e"],
    thenSequential: "validate",
  },
  review: {
    parallel: ["self-review", "security", "performance", "compliance"],
    thenSequential: "handoff",
  },
};

/**
 * Check if a step triggers a parallel group.
 * Triggers on any parallel member that is the first non-skipped one in the group.
 * Returns null if the step is not a parallel trigger or the group doesn't apply.
 */
export function getParallelGroup(phase: PhaseName, step: string, state?: WorkKitState): ParallelGroup | null {
  const group = PARALLEL_GROUPS[phase];
  if (!group) return null;

  if (!group.parallel.includes(step)) return null;

  // Find the first non-skipped parallel member
  if (state) {
    const phaseState = state.phases[phase];
    const firstActive = group.parallel.find((s) => {
      const sState = phaseState?.steps[s];
      return sState && sState.status !== "skipped" && sState.status !== "completed";
    });
    // Only trigger if this step is the first active parallel member
    if (firstActive !== step) return null;
  } else {
    // No state provided — fall back to first-member trigger
    if (group.parallel[0] !== step) return null;
  }

  return group;
}

/**
 * Check if a step is a parallel member (part of a group, not necessarily trigger).
 */
export function isParallelMember(phase: PhaseName, step: string): boolean {
  const group = PARALLEL_GROUPS[phase];
  if (!group) return false;
  return group.parallel.includes(step);
}
