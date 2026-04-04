import * as fs from "node:fs";
import * as path from "node:path";
import { WorkKitState } from "./schema.js";

const STATE_DIR = ".work-kit";
const STATE_FILE = "state.json";

// ── Worktree Discovery ───────────────────────────────────────────────

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
  return path.join(worktreeRoot, STATE_DIR, "state.md");
}

// ── Read / Write ─────────────────────────────────────────────────────

export function stateExists(worktreeRoot: string): boolean {
  return fs.existsSync(statePath(worktreeRoot));
}

export function readState(worktreeRoot: string): WorkKitState {
  const filePath = statePath(worktreeRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No state.json found at ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(raw) as WorkKitState;
  } catch {
    throw new Error(`Corrupted state.json at ${filePath}. File contains invalid JSON.`);
  }
}

export function writeState(worktreeRoot: string, state: WorkKitState): void {
  const dir = stateDir(worktreeRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(statePath(worktreeRoot), JSON.stringify(state, null, 2) + "\n", "utf-8");
}

// ── State.md ─────────────────────────────────────────────────────────

export function writeStateMd(worktreeRoot: string, content: string): void {
  const dir = stateDir(worktreeRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateMdPath(worktreeRoot), content, "utf-8");
}

export function readStateMd(worktreeRoot: string): string | null {
  const filePath = stateMdPath(worktreeRoot);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}
