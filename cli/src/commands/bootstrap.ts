import fs from "node:fs";
import { CLI_BINARY, STALE_THRESHOLD_MS } from "../config/constants.js";
import { unpause } from "../state/helpers.js";
import { findWorktreeRoot, readState, statePath, writeState } from "../state/store.js";
import { readKnowledgeFile } from "../utils/knowledge.js";

export interface BootstrapKnowledge {
  findings?: string;
}

export interface BootstrapResult {
  active: boolean;
  slug?: string;
  branch?: string;
  mode?: string;
  phase?: string | null;
  step?: string | null;
  status?: string;
  pausedAt?: string;
  resumed?: boolean;
  resumeReason?: string;
  nextAction?: string;
  recovery?: string | null;
  /**
   * Project-level knowledge read from <mainRepoRoot>/.work-kit-knowledge/findings.md.
   * Capped at 200 lines. workflow.md is intentionally excluded — it's a
   * write-only artifact for human curators, not session context.
   */
  knowledge?: BootstrapKnowledge;
}

export interface BootstrapOptions {
  autoResume?: boolean;
}

export function bootstrapCommand(startDir?: string, options: BootstrapOptions = {}): BootstrapResult {
  const root = findWorktreeRoot(startDir);

  if (!root) {
    return {
      active: false,
      nextAction: "No active work-kit session. Start one with /full-kit <description> or /auto-kit <description>.",
    };
  }

  const state = readState(root);

  let recovery: string | null = null;
  let isStale = false;
  try {
    const stat = fs.statSync(statePath(root));
    if (Date.now() - stat.mtimeMs > STALE_THRESHOLD_MS) {
      isStale = true;
      const hoursAgo = Math.round((Date.now() - stat.mtimeMs) / (60 * 60 * 1000));
      recovery = `State appears stale (last update ~${hoursAgo}h ago). Run \`${CLI_BINARY} status\` to diagnose. If the agent crashed mid-step, run \`${CLI_BINARY} next\` to resume.`;
    }
  } catch {
    // ignore stat errors
  }

  let resumed = false;
  let resumeReason: string | undefined;
  if (options.autoResume) {
    if (unpause(state)) {
      writeState(root, state);
      resumed = true;
      resumeReason = "Was paused — auto-resumed.";
    } else if (state.status === "in-progress" && isStale) {
      resumed = true;
      resumeReason = "Stale in-progress — proceeding from current step.";
      recovery = null;
    }
  }

  let nextAction: string;
  if (state.status === "completed") {
    nextAction = "Work-kit session is complete. Run wrap-up or start a new session.";
  } else if (state.status === "failed") {
    nextAction = `Work-kit session failed. Run \`${CLI_BINARY} status\` to see details.`;
  } else if (state.status === "paused" && !resumed) {
    nextAction = `Work-kit is paused${state.pausedAt ? ` (since ${state.pausedAt})` : ""}. Run \`${CLI_BINARY} resume\` to continue.`;
  } else if (recovery) {
    nextAction = recovery;
  } else {
    nextAction = `Continue ${state.currentPhase ?? "next phase"}${state.currentStep ? "/" + state.currentStep : ""}. Run \`${CLI_BINARY} next\` to get the agent prompt.`;
  }

  let knowledge: BootstrapKnowledge | undefined;
  try {
    const mainRepoRoot = state.metadata?.mainRepoRoot;
    if (mainRepoRoot) {
      // findings.md is injected; workflow.md is write-only for human curators.
      const findings = readKnowledgeFile(mainRepoRoot, "findings.md");
      if (findings) knowledge = { findings };
    }
  } catch (err: any) {
    process.stderr.write(`work-kit: failed to load knowledge files: ${err.message}\n`);
  }

  return {
    active: true,
    slug: state.slug,
    branch: state.branch,
    mode: state.mode,
    phase: state.currentPhase,
    step: state.currentStep,
    status: state.status,
    ...(state.pausedAt && { pausedAt: state.pausedAt }),
    ...(resumed && { resumed: true, resumeReason }),
    nextAction,
    recovery,
    ...(knowledge && { knowledge }),
  };
}
