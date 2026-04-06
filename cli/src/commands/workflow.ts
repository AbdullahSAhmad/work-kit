import { readState, writeState, findWorktreeRoot } from "../state/store.js";
import { STEPS_BY_PHASE, PHASE_NAMES } from "../state/schema.js";
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
    const { phase, step } = parseLocation(opts.add);

    if (!PHASE_NAMES.includes(phase) || !STEPS_BY_PHASE[phase].includes(step)) {
      return { action: "error", message: `Invalid step: ${opts.add}` };
    }

    const existing = state.workflow.find((s) => s.phase === phase && s.step === step);
    if (existing) {
      if (existing.included) {
        return { action: "error", message: `${opts.add} is already in the workflow.` };
      }
      existing.included = true;
    } else {
      const phaseIdx = PHASE_NAMES.indexOf(phase);
      const stepIdx = STEPS_BY_PHASE[phase].indexOf(step);

      let insertIdx = state.workflow.length;
      for (let i = 0; i < state.workflow.length; i++) {
        const wi = state.workflow[i];
        const wiPhaseIdx = PHASE_NAMES.indexOf(wi.phase);
        const wiStepIdx = STEPS_BY_PHASE[wi.phase].indexOf(wi.step);

        if (wiPhaseIdx > phaseIdx || (wiPhaseIdx === phaseIdx && wiStepIdx > stepIdx)) {
          insertIdx = i;
          break;
        }
      }

      state.workflow.splice(insertIdx, 0, { phase, step, included: true });
    }

    const currentStep = state.phases[phase].steps[step];
    if (currentStep?.status === "completed") {
      return { action: "error", message: `Cannot add ${opts.add} — it's already completed.` };
    }
    if (!currentStep) {
      state.phases[phase].steps[step] = { status: "pending" };
    } else if (currentStep.status === "skipped") {
      currentStep.status = "pending";
    }

    if (state.phases[phase].status === "skipped") {
      state.phases[phase].status = "pending";
    }

    writeState(root, state);
    return { action: "wait_for_user", message: `Added ${opts.add} to workflow.` };
  }

  if (opts.remove) {
    const { phase, step } = parseLocation(opts.remove);

    const ws = state.workflow.find((s) => s.phase === phase && s.step === step);
    if (!ws) {
      return { action: "error", message: `${opts.remove} is not in the workflow.` };
    }

    const stepState = state.phases[phase]?.steps[step];
    if (stepState?.status === "completed") {
      return { action: "error", message: `Cannot remove ${opts.remove} — it's already completed.` };
    }
    if (stepState?.status === "in-progress") {
      return { action: "error", message: `Cannot remove ${opts.remove} — it's currently in progress.` };
    }

    ws.included = false;

    if (stepState) {
      stepState.status = "skipped";
    }

    const allSkipped = Object.values(state.phases[phase].steps).every(
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
      step: `${s.phase}/${s.step}`,
      status: state.phases[s.phase]?.steps[s.step]?.status || "unknown",
    }));

  return { action: "workflow_status", workflow };
}
