import { loadProjectConfig } from "../config/project-config.js";
import type { PhaseName, WorkKitState } from "../state/schema.js";

/**
 * Defines which steps run in parallel and which runs sequentially after.
 */
export interface ParallelGroup {
  parallel: string[]; // steps that run concurrently
  thenSequential?: string; // step that runs after all parallel complete
}

/**
 * Default parallel groups per phase. Most projects should not need to override
 * these — the defaults reflect the canonical work-kit pipeline.
 */
export const DEFAULT_PARALLEL_GROUPS: Record<string, ParallelGroup> = {
  // Both Test and Review fan out *inside* a single step, not at the framework
  // level. The Conductor (test/exercise, review/review) uses the Agent tool
  // to spawn lens sub-agents in a single message — mirrors the simplify
  // skill. No framework parallel group needed for either phase.
};

/**
 * Resolve parallel groups for a project, merging defaults with optional
 * project config overrides at `<mainRepoRoot>/.work-kit-config.json`.
 */
export function resolveParallelGroups(mainRepoRoot?: string): Record<string, ParallelGroup> {
  if (!mainRepoRoot) return DEFAULT_PARALLEL_GROUPS;
  const config = loadProjectConfig(mainRepoRoot);
  if (!config.parallel || Object.keys(config.parallel).length === 0) {
    return DEFAULT_PARALLEL_GROUPS;
  }
  return { ...DEFAULT_PARALLEL_GROUPS, ...config.parallel };
}

/**
 * Check if a step triggers a parallel group.
 * Triggers on the first non-skipped, non-completed parallel member.
 */
export function getParallelGroup(phase: PhaseName, step: string, state?: WorkKitState): ParallelGroup | null {
  const groups = resolveParallelGroups(state?.metadata?.mainRepoRoot);
  const group = groups[phase];
  if (!group) return null;

  if (!group.parallel.includes(step)) return null;

  if (state) {
    const phaseState = state.phases[phase];
    const firstActive = group.parallel.find((s) => {
      const sState = phaseState?.steps[s];
      return sState && sState.status !== "skipped" && sState.status !== "completed";
    });
    if (firstActive !== step) return null;
  } else {
    if (group.parallel[0] !== step) return null;
  }

  return group;
}
