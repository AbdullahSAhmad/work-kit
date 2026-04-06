import { readState, writeState, findWorktreeRoot } from "../state/store.js";
import { unpause } from "../state/helpers.js";
import { CLI_BINARY } from "../config/constants.js";
import type { Action } from "../state/schema.js";

export function resumeCommand(worktreeRoot?: string): Action {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found." };
  }

  const state = readState(root);

  if (state.status === "completed") {
    return { action: "error", message: `${state.slug} is already completed.` };
  }
  if (state.status === "in-progress") {
    return {
      action: "resumed",
      message: `${state.slug} is already in progress. Run \`${CLI_BINARY} next\` to continue.`,
      phase: state.currentPhase,
      step: state.currentStep,
    };
  }
  if (state.status === "failed") {
    return { action: "error", message: `${state.slug} is in failed state; cannot resume.` };
  }

  unpause(state);
  writeState(root, state);

  return {
    action: "resumed",
    message: `Resumed ${state.slug}. Run \`${CLI_BINARY} next\` to continue.`,
    phase: state.currentPhase,
    step: state.currentStep,
  };
}
