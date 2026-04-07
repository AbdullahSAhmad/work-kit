import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { WorkKitState } from "./schema.js";

export const STATE_DIR = ".work-kit";
export const STATE_FILE = "tracker.json";
export const STATE_MD_FILE = "state.md";
export const AWAITING_INPUT_MARKER_FILE = "awaiting-input";
export const IDLE_MARKER_FILE = "idle";

/**
 * Remove any "blocked on user" marker files (awaiting-input, idle).
 *
 * Hook-installed cleanup normally handles these (PostToolUse/Stop),
 * but edge cases (denied permission, killed session, sentinel drift)
 * can leave stale markers. Any forward state transition should clear
 * them as a belt-and-suspenders safety net.
 */
export function clearBlockingMarkers(worktreeRoot: string): void {
  const dir = path.join(worktreeRoot, STATE_DIR);
  fs.rmSync(path.join(dir, AWAITING_INPUT_MARKER_FILE), { force: true });
  fs.rmSync(path.join(dir, IDLE_MARKER_FILE), { force: true });
}

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

// Returns the main repo root for a given path inside a git repo, or null
// if the path is not in a git repo. Unlike `git rev-parse --show-toplevel`,
// this returns the *main* repo even when called from inside a worktree —
// `git worktree list --porcelain` always lists the main repo first.
export function gitMainRepoRoot(cwd: string): string | null {
  try {
    const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const firstLine = output.split("\n").find(l => l.startsWith("worktree "));
    if (firstLine) return firstLine.slice("worktree ".length).trim();
    return null;
  } catch {
    return null;
  }
}

export function resolveMainRepoRoot(worktreeRoot: string): string {
  return gitMainRepoRoot(worktreeRoot) ?? worktreeRoot;
}

// Per-process cache. The HEAD SHA can drift mid-session in theory, but
// every callsite either tags a stable artifact at session end (wrap-up)
// or stamps an event during normal phase work — close enough for telemetry.
const headShaCache = new Map<string, string>();

/** Resolve the current HEAD commit SHA for `cwd`. Returns undefined outside a git repo. */
export function gitHeadSha(cwd: string): string | undefined {
  const cached = headShaCache.get(cwd);
  if (cached !== undefined) return cached;
  try {
    const out = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) {
      headShaCache.set(cwd, out);
      return out;
    }
  } catch {
    // ignore
  }
  return undefined;
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
