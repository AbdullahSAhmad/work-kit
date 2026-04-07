import fs from "node:fs";
import { findWorktreeRoot, readState, writeState, statePath } from "../state/store.js";
import { unpause } from "../state/helpers.js";
import { CLI_BINARY, STALE_THRESHOLD_MS } from "../config/constants.js";
import { fileForType, readKnowledgeFile } from "../utils/knowledge.js";

export interface BootstrapKnowledge {
  lessons?: string;
  conventions?: string;
  risks?: string;
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
   * Project-level knowledge files (lessons/conventions/risks) read from
   * <mainRepoRoot>/.work-kit-knowledge/. Capped at 200 lines per file.
   * workflow.md is intentionally excluded — it's a write-only artifact for
   * human curators, not session context.
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
      nextAction:
        "No active work-kit session. Start one with /full-kit <description> or /auto-kit <description>.",
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

  // Load project-level knowledge files (best effort, never breaks bootstrap).
  // workflow.md is intentionally excluded — it's a write-only artifact for
  // human curators, not session context.
  let knowledge: BootstrapKnowledge | undefined;
  try {
    const mainRepoRoot = state.metadata?.mainRepoRoot;
    if (mainRepoRoot) {
      const lessons = readKnowledgeFile(mainRepoRoot, fileForType("lesson"));
      const conventions = readKnowledgeFile(mainRepoRoot, fileForType("convention"));
      const risks = readKnowledgeFile(mainRepoRoot, fileForType("risk"));
      if (lessons || conventions || risks) {
        knowledge = {
          ...(lessons && { lessons }),
          ...(conventions && { conventions }),
          ...(risks && { risks }),
        };
      }
    }
  } catch (err: any) {
    // Non-fatal: log to stderr but don't break bootstrap
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
