import type { PhaseName, WorkKitState } from "../state/schema.js";

/**
 * Defines which sub-stages run in parallel and which runs sequentially after.
 */
export interface ParallelGroup {
  parallel: string[];          // sub-stages that run concurrently
  thenSequential?: string;     // sub-stage that runs after all parallel complete
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
 * Check if a sub-stage triggers a parallel group.
 * Triggers on any parallel member that is the first non-skipped one in the group.
 * Returns null if the sub-stage is not a parallel trigger or the group doesn't apply.
 */
export function getParallelGroup(phase: PhaseName, subStage: string, state?: WorkKitState): ParallelGroup | null {
  const group = PARALLEL_GROUPS[phase];
  if (!group) return null;

  if (!group.parallel.includes(subStage)) return null;

  // Find the first non-skipped parallel member
  if (state) {
    const phaseState = state.phases[phase];
    const firstActive = group.parallel.find((ss) => {
      const ssState = phaseState?.subStages[ss];
      return ssState && ssState.status !== "skipped" && ssState.status !== "completed";
    });
    // Only trigger if this sub-stage is the first active parallel member
    if (firstActive !== subStage) return null;
  } else {
    // No state provided — fall back to first-member trigger
    if (group.parallel[0] !== subStage) return null;
  }

  return group;
}

/**
 * Check if a sub-stage is a parallel member (part of a group, not necessarily trigger).
 */
export function isParallelMember(phase: PhaseName, subStage: string): boolean {
  const group = PARALLEL_GROUPS[phase];
  if (!group) return false;
  return group.parallel.includes(subStage);
}
