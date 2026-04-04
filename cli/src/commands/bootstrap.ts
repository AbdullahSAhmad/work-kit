import fs from "node:fs";
import { findWorktreeRoot, readState, statePath } from "../state/store.js";

export interface BootstrapResult {
  active: boolean;
  slug?: string;
  branch?: string;
  mode?: string;
  phase?: string | null;
  subStage?: string | null;
  status?: string;
  nextAction?: string;
  recovery?: string | null;
}

export function bootstrapCommand(startDir?: string): BootstrapResult {
  const root = findWorktreeRoot(startDir);

  if (!root) {
    return {
      active: false,
      nextAction:
        "No active work-kit session. Start one with /full-kit <description> or /auto-kit <description>.",
    };
  }

  const state = readState(root);

  // Check for staleness: if state file hasn't been modified in over 1 hour
  let recovery: string | null = null;
  try {
    const stateFile = statePath(root);
    const stat = fs.statSync(stateFile);
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (stat.mtimeMs < hourAgo) {
      const hoursAgo = Math.round((Date.now() - stat.mtimeMs) / (60 * 60 * 1000));
      recovery = `State appears stale (last update ~${hoursAgo}h ago). Run \`npx work-kit-cli status\` to diagnose. If the agent crashed mid-stage, run \`npx work-kit-cli next\` to resume.`;
    }
  } catch {
    // Ignore stat errors
  }

  let nextAction: string;
  if (state.status === "completed") {
    nextAction = "Work-kit session is complete. Run wrap-up or start a new session.";
  } else if (state.status === "failed") {
    nextAction = "Work-kit session failed. Run `npx work-kit-cli status` to see details.";
  } else if (recovery) {
    nextAction = recovery;
  } else {
    nextAction = `Continue ${state.currentPhase ?? "next phase"}${state.currentSubStage ? "/" + state.currentSubStage : ""}. Run \`npx work-kit-cli next\` to get the agent prompt.`;
  }

  return {
    active: true,
    slug: state.slug,
    branch: state.branch,
    mode: state.mode,
    phase: state.currentPhase,
    subStage: state.currentSubStage,
    status: state.status,
    nextAction,
    recovery,
  };
}
