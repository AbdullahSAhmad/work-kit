import { PHASE_NAMES } from "../state/schema.js";
import { readState, findWorktreeRoot } from "../state/store.js";

interface StatusOutput {
  slug: string;
  branch: string;
  mode: string;
  classification?: string;
  status: string;
  currentPhase: string | null;
  currentSubStage: string | null;
  started: string;
  phases: Record<string, { status: string; completed: number; total: number; active: number }>;
  loopbackCount: number;
}

export function statusCommand(worktreeRoot?: string): StatusOutput {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    throw new Error("No work-kit state found. Run `work-kit init` first.");
  }

  const state = readState(root);

  const phases: StatusOutput["phases"] = {};
  for (const phase of PHASE_NAMES) {
    const ps = state.phases[phase];
    let completed = 0, total = 0, active = 0;
    for (const ss of Object.values(ps.subStages)) {
      if (ss.status === "skipped") continue;
      total++;
      if (ss.status === "completed") completed++;
      else if (ss.status === "in-progress") active++;
    }
    phases[phase] = { status: ps.status, completed, total, active };
  }

  return {
    slug: state.slug,
    branch: state.branch,
    mode: state.mode,
    ...(state.classification && { classification: state.classification }),
    status: state.status,
    currentPhase: state.currentPhase,
    currentSubStage: state.currentSubStage,
    started: state.started,
    phases,
    loopbackCount: state.loopbacks.length,
  };
}
