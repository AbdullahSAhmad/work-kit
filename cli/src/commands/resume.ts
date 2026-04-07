import * as fs from "node:fs";
import { readState, writeState, findWorktreeRoot, statePath, gitMainRepoRoot } from "../state/store.js";
import { unpause } from "../state/helpers.js";
import { CLI_BINARY } from "../config/constants.js";
import { discoverWorktrees } from "../observer/data.js";
import type { Action, ResumableSessionSummary } from "../state/schema.js";

export interface ResumeOptions {
  worktreeRoot?: string;
  slug?: string;
}

function collectResumableSessions(mainRepoRoot: string): ResumableSessionSummary[] {
  const sessions: ResumableSessionSummary[] = [];
  const now = Date.now();
  for (const wt of discoverWorktrees(mainRepoRoot)) {
    let state;
    try {
      state = readState(wt);
    } catch {
      continue;
    }
    if (state.status !== "paused" && state.status !== "in-progress") continue;

    let mtimeMs = now;
    try {
      mtimeMs = fs.statSync(statePath(wt)).mtimeMs;
    } catch {
      // ignore — keep current time as fallback
    }

    sessions.push({
      slug: state.slug,
      branch: state.branch,
      worktreeRoot: wt,
      status: state.status,
      pausedAt: state.pausedAt,
      currentPhase: state.currentPhase,
      currentStep: state.currentStep,
      lastUpdatedAgoMs: now - mtimeMs,
    });
  }
  // Sort: most recently updated first — fresh crashes are easy to spot at the top,
  // and a still-running session in another terminal will have the smallest age.
  sessions.sort((a, b) => a.lastUpdatedAgoMs - b.lastUpdatedAgoMs);
  return sessions;
}

function resumeAt(root: string): Action {
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
      worktreeRoot: root,
    };
  }
  if (state.status === "failed") {
    return { action: "error", message: `${state.slug} is in failed state; cannot resume.` };
  }

  unpause(state);
  writeState(root, state);

  return {
    action: "resumed",
    message: `Resumed ${state.slug}. cd into ${root} and run \`${CLI_BINARY} next\` to continue.`,
    phase: state.currentPhase,
    step: state.currentStep,
    worktreeRoot: root,
  };
}

export function resumeCommand(options: ResumeOptions = {}): Action {
  // 1. Explicit worktree path → resume there directly (legacy behavior)
  if (options.worktreeRoot) {
    return resumeAt(options.worktreeRoot);
  }

  // 2. Determine the main repo we're operating against. Works whether
  // we're called from the main repo or from inside one of its worktrees.
  const mainRepoRoot = gitMainRepoRoot(process.cwd());
  if (!mainRepoRoot) {
    // Non-git context: try the legacy cwd-walking lookup
    const root = findWorktreeRoot();
    if (!root) {
      return { action: "error", message: "No work-kit state found and not inside a git repo." };
    }
    return resumeAt(root);
  }

  const sessions = collectResumableSessions(mainRepoRoot);

  // 3. Slug selector → find matching session in this repo (paused OR in-progress)
  if (options.slug) {
    const match = sessions.find(s => s.slug === options.slug);
    if (!match) {
      return {
        action: "error",
        message: `No work-kit session with slug "${options.slug}" found in ${mainRepoRoot}.`,
      };
    }
    return resumeAt(match.worktreeRoot);
  }

  // 4. No slug → list resumable sessions for the user to pick from
  if (sessions.length === 0) {
    return {
      action: "error",
      message: `No resumable work-kit sessions in ${mainRepoRoot}.`,
      suggestion: `Start a new session with /full-kit or /auto-kit, or run \`${CLI_BINARY} observe\` to see active work.`,
    };
  }

  return {
    action: "select_session",
    message: `Found ${sessions.length} resumable session${sessions.length === 1 ? "" : "s"}. Re-run with --slug <slug> to continue one.`,
    sessions,
  };
}
