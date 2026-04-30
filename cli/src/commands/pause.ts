import type { Action } from "../state/schema.js";
import { findWorktreeRoot, readState, writeState } from "../state/store.js";

export function pauseCommand(reason?: string, worktreeRoot?: string): Action {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found." };
  }

  const state = readState(root);

  if (state.status === "completed") {
    return { action: "error", message: `${state.slug} is already completed; nothing to pause.` };
  }
  if (state.status === "paused") {
    return { action: "error", message: `${state.slug} is already paused (since ${state.pausedAt}).` };
  }
  if (state.status === "failed") {
    return { action: "error", message: `${state.slug} is in failed state; cannot pause.` };
  }

  state.status = "paused";
  state.pausedAt = new Date().toISOString();
  writeState(root, state);

  const where = state.currentPhase
    ? ` at ${state.currentPhase}${state.currentStep ? "/" + state.currentStep : ""}`
    : "";

  return {
    action: "paused",
    message: `Paused ${state.slug}${where}.${reason ? ` Reason: ${reason}` : ""} Run \`work-kit resume\` to continue.`,
  };
}
