import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { readState, findWorktreeRoot, stateDir, resolveMainRepoRoot } from "../state/store.js";

export interface CancelResult {
  action: "cancelled" | "error";
  slug?: string;
  branch?: string;
  worktreeRemoved: boolean;
  branchDeleted: boolean;
  message: string;
}

export function cancelCommand(worktreeRoot?: string): CancelResult {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    return {
      action: "error",
      worktreeRemoved: false,
      branchDeleted: false,
      message: "No work-kit state found. Nothing to cancel.",
    };
  }

  const state = readState(root);

  if (state.status === "completed") {
    return {
      action: "error",
      slug: state.slug,
      worktreeRemoved: false,
      branchDeleted: false,
      message: `${state.slug} is already completed. Nothing to cancel.`,
    };
  }

  const slug = state.slug;
  const branch = state.branch;
  const mainRoot = resolveMainRepoRoot(root);
  const isWorktree = path.resolve(root) !== path.resolve(mainRoot);

  let worktreeRemoved = false;
  let branchDeleted = false;

  // Remove .work-kit/ state directory
  const stDir = stateDir(root);
  if (fs.existsSync(stDir)) {
    fs.rmSync(stDir, { recursive: true, force: true });
  }

  // Remove the worktree (if we're in one)
  if (isWorktree) {
    try {
      execFileSync("git", ["worktree", "remove", root, "--force"], {
        cwd: mainRoot,
        encoding: "utf-8",
        timeout: 10000,
      });
      worktreeRemoved = true;
    } catch {
      // Worktree removal failed — may need manual cleanup
    }
  }

  // Delete the feature branch
  if (branch) {
    try {
      execFileSync("git", ["branch", "-D", branch], {
        cwd: mainRoot,
        encoding: "utf-8",
        timeout: 5000,
      });
      branchDeleted = true;
    } catch {
      // Branch may not exist or may be checked out elsewhere
    }
  }

  return {
    action: "cancelled",
    slug,
    branch,
    worktreeRemoved,
    branchDeleted,
    message: `Cancelled ${slug}.${worktreeRemoved ? " Worktree removed." : ""}${branchDeleted ? " Branch deleted." : ""}`,
  };
}
