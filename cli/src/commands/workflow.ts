import { readState, writeState, findWorktreeRoot } from "../state/store.js";
import { SUBSTAGES_BY_PHASE, PHASE_NAMES } from "../state/schema.js";
import { parseLocation } from "../state/helpers.js";
import type { Action } from "../state/schema.js";

interface WorkflowStatus {
  action: "workflow_status";
  workflow: { step: string; status: string }[];
}

export type WorkflowResult = Action | WorkflowStatus;

export function workflowCommand(opts: {
  add?: string;
  remove?: string;
  worktreeRoot?: string;
}): WorkflowResult {
  const root = opts.worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found." };
  }

  const state = readState(root);

  if (state.mode !== "auto-kit") {
    return { action: "error", message: "Workflow management is only available in auto-kit mode." };
  }

  if (!state.workflow) {
    return { action: "error", message: "No workflow defined in state." };
  }

  if (opts.add) {
    const { phase, subStage } = parseLocation(opts.add);

    if (!PHASE_NAMES.includes(phase) || !SUBSTAGES_BY_PHASE[phase].includes(subStage)) {
      return { action: "error", message: `Invalid step: ${opts.add}` };
    }

    const existing = state.workflow.find((s) => s.phase === phase && s.subStage === subStage);
    if (existing) {
      if (existing.included) {
        return { action: "error", message: `${opts.add} is already in the workflow.` };
      }
      existing.included = true;
    } else {
      const phaseIdx = PHASE_NAMES.indexOf(phase);
      const subStageIdx = SUBSTAGES_BY_PHASE[phase].indexOf(subStage);

      let insertIdx = state.workflow.length;
      for (let i = 0; i < state.workflow.length; i++) {
        const wi = state.workflow[i];
        const wiPhaseIdx = PHASE_NAMES.indexOf(wi.phase);
        const wiSubIdx = SUBSTAGES_BY_PHASE[wi.phase].indexOf(wi.subStage);

        if (wiPhaseIdx > phaseIdx || (wiPhaseIdx === phaseIdx && wiSubIdx > subStageIdx)) {
          insertIdx = i;
          break;
        }
      }

      state.workflow.splice(insertIdx, 0, { phase, subStage, included: true });
    }

    const currentSS = state.phases[phase].subStages[subStage];
    if (currentSS?.status === "completed") {
      return { action: "error", message: `Cannot add ${opts.add} — it's already completed.` };
    }
    if (!currentSS) {
      state.phases[phase].subStages[subStage] = { status: "pending" };
    } else if (currentSS.status === "skipped") {
      currentSS.status = "pending";
    }

    if (state.phases[phase].status === "skipped") {
      state.phases[phase].status = "pending";
    }

    writeState(root, state);
    return { action: "wait_for_user", message: `Added ${opts.add} to workflow.` };
  }

  if (opts.remove) {
    const { phase, subStage } = parseLocation(opts.remove);

    const step = state.workflow.find((s) => s.phase === phase && s.subStage === subStage);
    if (!step) {
      return { action: "error", message: `${opts.remove} is not in the workflow.` };
    }

    const ssState = state.phases[phase]?.subStages[subStage];
    if (ssState?.status === "completed") {
      return { action: "error", message: `Cannot remove ${opts.remove} — it's already completed.` };
    }
    if (ssState?.status === "in-progress") {
      return { action: "error", message: `Cannot remove ${opts.remove} — it's currently in progress.` };
    }

    step.included = false;

    if (ssState) {
      ssState.status = "skipped";
    }

    const allSkipped = Object.values(state.phases[phase].subStages).every(
      (s) => s.status === "skipped"
    );
    if (allSkipped) {
      state.phases[phase].status = "skipped";
    }

    writeState(root, state);
    return { action: "wait_for_user", message: `Removed ${opts.remove} from workflow.` };
  }

  // No add/remove — show current workflow
  const workflow = state.workflow
    .filter((s) => s.included)
    .map((s) => ({
      step: `${s.phase}/${s.subStage}`,
      status: state.phases[s.phase]?.subStages[s.subStage]?.status || "unknown",
    }));

  return { action: "workflow_status", workflow };
}
