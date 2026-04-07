import { PHASE_NAMES } from "../state/schema.js";
import { readState, findWorktreeRoot } from "../state/store.js";

interface StatusOutput {
  slug: string;
  branch: string;
  mode: string;
  classification?: string;
  modelPolicy: string;
  status: string;
  currentPhase: string | null;
  currentStep: string | null;
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
    for (const s of Object.values(ps.steps)) {
      if (s.status === "skipped") continue;
      total++;
      if (s.status === "completed") completed++;
      else if (s.status === "in-progress" || s.status === "waiting") active++;
    }
    phases[phase] = { status: ps.status, completed, total, active };
  }

  return {
    slug: state.slug,
    branch: state.branch,
    mode: state.mode,
    ...(state.classification && { classification: state.classification }),
    modelPolicy: state.modelPolicy ?? "auto",
    status: state.status,
    currentPhase: state.currentPhase,
    currentStep: state.currentStep,
    started: state.started,
    phases,
    loopbackCount: state.loopbacks.length,
  };
}
