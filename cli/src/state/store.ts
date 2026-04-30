import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { readFileOrNull } from "../utils/fs.js";
import { isClassification, isModelPolicy, MODE_AUTO, MODE_FULL, PHASE_NAMES, WorkKitState } from "./schema.js";

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
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new Error(`No tracker.json found at ${filePath}`);
    }
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Corrupted tracker.json at ${filePath}. File contains invalid JSON.`);
  }
  const migrated = migrateState(parsed, worktreeRoot);
  return validateStateShape(migrated, filePath);
}

/**
 * Hand-rolled shape check for a tracker.json that has already been migrated to
 * the current version. Catches truncated writes, hand-edits, and stray fields
 * before the rest of the CLI assumes the shape is sound. Throws on any error
 * with all problems listed at once so the user can fix in a single pass.
 */
function validateStateShape(raw: unknown, filePath: string): WorkKitState {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid tracker.json at ${filePath}: not a JSON object.`);
  }
  const r = raw as Record<string, unknown>;
  const errs: string[] = [];

  if (r.version !== 4) errs.push(`version must be 4, got ${JSON.stringify(r.version)}`);
  if (typeof r.slug !== "string" || !r.slug) errs.push(`slug must be a non-empty string`);
  if (typeof r.branch !== "string" || !r.branch) errs.push(`branch must be a non-empty string`);
  if (typeof r.started !== "string") errs.push(`started must be an ISO timestamp string`);
  if (r.mode !== MODE_FULL && r.mode !== MODE_AUTO)
    errs.push(`mode must be "${MODE_FULL}" or "${MODE_AUTO}", got ${JSON.stringify(r.mode)}`);

  const validStatuses = ["in-progress", "paused", "completed", "failed"];
  if (typeof r.status !== "string" || !validStatuses.includes(r.status)) {
    errs.push(`status must be one of ${validStatuses.join(", ")}, got ${JSON.stringify(r.status)}`);
  }

  if (r.currentPhase !== null && !(PHASE_NAMES as readonly string[]).includes(r.currentPhase as string)) {
    errs.push(`currentPhase must be null or a known phase, got ${JSON.stringify(r.currentPhase)}`);
  }
  if (r.currentStep !== null && typeof r.currentStep !== "string") {
    errs.push(`currentStep must be null or a string`);
  }

  if (!r.phases || typeof r.phases !== "object") {
    errs.push(`phases must be an object`);
  } else {
    for (const phase of PHASE_NAMES) {
      if (!(phase in (r.phases as object))) errs.push(`phases.${phase} is missing`);
    }
  }

  if (!Array.isArray(r.loopbacks)) errs.push(`loopbacks must be an array`);
  if (!r.metadata || typeof r.metadata !== "object") {
    errs.push(`metadata must be an object`);
  } else {
    const m = r.metadata as Record<string, unknown>;
    if (typeof m.worktreeRoot !== "string") errs.push(`metadata.worktreeRoot must be a string`);
    if (typeof m.mainRepoRoot !== "string") errs.push(`metadata.mainRepoRoot must be a string`);
  }

  if (r.classification !== undefined && (typeof r.classification !== "string" || !isClassification(r.classification))) {
    errs.push(`classification, if set, must be a valid Classification`);
  }
  if (r.modelPolicy !== undefined && (typeof r.modelPolicy !== "string" || !isModelPolicy(r.modelPolicy))) {
    errs.push(`modelPolicy, if set, must be a valid ModelPolicy`);
  }

  if (errs.length > 0) {
    throw new Error(`Invalid tracker.json at ${filePath}:\n  - ${errs.join("\n  - ")}`);
  }

  return raw as WorkKitState;
}

export function writeState(worktreeRoot: string, state: WorkKitState): void {
  fs.mkdirSync(stateDir(worktreeRoot), { recursive: true });
  const target = statePath(worktreeRoot);
  const tmp = target + "." + randomUUID().slice(0, 8) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, target);
}

// ── State.md ────────────────────────────────────────────────────────

export function writeStateMd(worktreeRoot: string, content: string): void {
  fs.mkdirSync(stateDir(worktreeRoot), { recursive: true });
  const target = stateMdPath(worktreeRoot);
  const tmp = target + "." + randomUUID().slice(0, 8) + ".tmp";
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, target);
}

export function readStateMd(worktreeRoot: string): string | null {
  return readFileOrNull(stateMdPath(worktreeRoot));
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
    const firstLine = output.split("\n").find((l) => l.startsWith("worktree "));
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
