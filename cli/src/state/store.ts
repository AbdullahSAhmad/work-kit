import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { WorkKitState } from "./schema.js";

export const STATE_DIR = ".work-kit";
export const STATE_FILE = "tracker.json";
export const STATE_MD_FILE = "state.md";

// ── Worktree Discovery ──────────────────────────────────────────────

export function findWorktreeRoot(startDir?: string): string | null {
  let dir = startDir || process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, STATE_DIR, STATE_FILE))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function stateDir(worktreeRoot: string): string {
  return path.join(worktreeRoot, STATE_DIR);
}

export function statePath(worktreeRoot: string): string {
  return path.join(worktreeRoot, STATE_DIR, STATE_FILE);
}

export function stateMdPath(worktreeRoot: string): string {
  return path.join(worktreeRoot, STATE_DIR, STATE_MD_FILE);
}

// ── Read / Write ────────────────────────────────────────────────────

export function stateExists(worktreeRoot: string): boolean {
  return fs.existsSync(statePath(worktreeRoot));
}

export function readState(worktreeRoot: string): WorkKitState {
  const filePath = statePath(worktreeRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No tracker.json found at ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Corrupted tracker.json at ${filePath}. File contains invalid JSON.`);
  }
  return migrateState(parsed, worktreeRoot);
}

export function writeState(worktreeRoot: string, state: WorkKitState): void {
  const dir = stateDir(worktreeRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const target = statePath(worktreeRoot);
  const tmp = target + "." + randomUUID().slice(0, 8) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, target);
}

// ── State.md ────────────────────────────────────────────────────────

export function writeStateMd(worktreeRoot: string, content: string): void {
  const dir = stateDir(worktreeRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const target = stateMdPath(worktreeRoot);
  const tmp = target + "." + randomUUID().slice(0, 8) + ".tmp";
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, target);
}

export function readStateMd(worktreeRoot: string): string | null {
  const filePath = stateMdPath(worktreeRoot);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

// ── Git Helpers ─────────────────────────────────────────────────

export function resolveMainRepoRoot(worktreeRoot: string): string {
  try {
    const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: worktreeRoot,
      encoding: "utf-8",
      timeout: 5000,
    });
    const firstLine = output.split("\n").find(l => l.startsWith("worktree "));
    if (firstLine) return firstLine.slice("worktree ".length).trim();
  } catch {
    // fallback
  }
  return worktreeRoot;
}

// ── Migration ───────────────────────────────────────────────────────

function migrateState(raw: any, worktreeRoot: string): WorkKitState {
  if (raw.version === 2) return raw as WorkKitState;

  // v1 → v2: rename subStage fields to step
  if (raw.version === 1 || !raw.version) {
    if ("currentSubStage" in raw) {
      raw.currentStep = raw.currentSubStage;
      delete raw.currentSubStage;
    }

    for (const phase of Object.values(raw.phases) as any[]) {
      if (phase.subStages) {
        phase.steps = phase.subStages;
        delete phase.subStages;
      }
    }

    if (raw.workflow) {
      for (const ws of raw.workflow) {
        if ("subStage" in ws) {
          ws.step = ws.subStage;
          delete ws.subStage;
        }
      }
    }

    if (raw.loopbacks) {
      for (const lb of raw.loopbacks) {
        if (lb.from?.subStage !== undefined) {
          lb.from.step = lb.from.subStage;
          delete lb.from.subStage;
        }
        if (lb.to?.subStage !== undefined) {
          lb.to.step = lb.to.subStage;
          delete lb.to.subStage;
        }
      }
    }

    raw.version = 2;
    writeState(worktreeRoot, raw as WorkKitState);
  }

  return raw as WorkKitState;
}
