import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import type { WorkKitState, PhaseName } from "../state/schema.js";
import { PHASE_NAMES, SUBSTAGES_BY_PHASE } from "../state/schema.js";
import { readState, stateExists } from "../state/store.js";

// ── View Types ──────────────────────────────────────────────────────

export interface WorkItemView {
  slug: string;
  branch: string;
  mode: string;
  classification?: string;
  status: string;
  currentPhase: string | null;
  currentSubStage: string | null;
  currentPhaseStartedAt?: string;
  currentSubStageStatus?: string;
  currentSubStageIndex?: number;
  currentPhaseTotal?: number;
  startedAt: string;
  progress: { completed: number; total: number; percent: number };
  phases: { name: string; status: string; startedAt?: string; completedAt?: string }[];
  loopbacks: { count: number; lastReason?: string; lastFrom?: string; lastTo?: string };
}

export interface CompletedItemView {
  slug: string;
  pr?: string;
  completedAt: string;
  phases: string;
}

export interface DashboardData {
  activeItems: WorkItemView[];
  completedItems: CompletedItemView[];
  lastUpdated: Date;
}

// ── Worktree Discovery ──────────────────────────────────────────────

export function discoverWorktrees(mainRepoRoot: string): string[] {
  let output: string;
  try {
    output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: mainRepoRoot,
      encoding: "utf-8",
      timeout: 5000,
    });
  } catch {
    return [];
  }

  const worktrees: string[] = [];
  const lines = output.split("\n");
  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      const wtPath = line.slice("worktree ".length).trim();
      if (stateExists(wtPath)) {
        worktrees.push(wtPath);
      }
    }
  }

  if (stateExists(mainRepoRoot) && !worktrees.includes(mainRepoRoot)) {
    worktrees.push(mainRepoRoot);
  }

  return worktrees;
}

// ── Collect Single Work Item ────────────────────────────────────────

export function collectWorkItem(worktreeRoot: string): WorkItemView | null {
  if (!stateExists(worktreeRoot)) return null;

  let state: WorkKitState;
  try {
    state = readState(worktreeRoot);
  } catch {
    return null;
  }

  // Compute progress
  let completed = 0;
  let total = 0;
  const phaseViews: { name: string; status: string; startedAt?: string; completedAt?: string }[] = [];

  const phaseList: PhaseName[] = state.mode === "auto-kit" && state.workflow
    ? getAutoKitPhases(state)
    : [...PHASE_NAMES];

  // Track current phase substage position
  let currentPhaseStartedAt: string | undefined;
  let currentSubStageStatus: string | undefined;
  let currentSubStageIndex: number | undefined;
  let currentPhaseTotal: number | undefined;

  for (const phaseName of phaseList) {
    const phase = state.phases[phaseName];
    if (!phase) {
      phaseViews.push({ name: phaseName, status: "pending" });
      // Count substages for total
      const subs = SUBSTAGES_BY_PHASE[phaseName] || [];
      total += subs.length;
      continue;
    }

    // If any sub-stage is "waiting", show the phase as waiting in the view
    const hasWaiting = Object.values(phase.subStages).some(ss => ss.status === "waiting");
    phaseViews.push({
      name: phaseName,
      status: hasWaiting ? "waiting" : phase.status,
      startedAt: phase.startedAt,
      completedAt: phase.completedAt,
    });

    const subStageKeys = Object.keys(phase.subStages);
    if (subStageKeys.length === 0) {
      // Use default substages — skip entirely skipped phases
      if (phase.status === "skipped") continue;
      const defaults = SUBSTAGES_BY_PHASE[phaseName] || [];
      total += defaults.length;
      if (phase.status === "completed") completed += defaults.length;
    } else {
      let phaseIdx = 0;
      const activeKeys = subStageKeys.filter(k => phase.subStages[k].status !== "skipped");
      for (const key of activeKeys) {
        const sub = phase.subStages[key];
        total++;
        phaseIdx++;
        if (sub.status === "completed") {
          completed++;
        }
      }
      // Track position within current phase
      if (phaseName === state.currentPhase) {
        currentPhaseStartedAt = phase.startedAt;
        currentPhaseTotal = activeKeys.length;
        if (state.currentSubStage) {
          const idx = activeKeys.indexOf(state.currentSubStage);
          currentSubStageIndex = idx >= 0 ? idx + 1 : undefined;
          const ss = phase.subStages[state.currentSubStage];
          currentSubStageStatus = ss?.status;
        }
      }
    }
  }

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Loopback info
  const loopbacks = state.loopbacks || [];
  const loopbackView = {
    count: loopbacks.length,
    lastReason: loopbacks.length > 0 ? loopbacks[loopbacks.length - 1].reason : undefined,
    lastFrom: loopbacks.length > 0
      ? `${loopbacks[loopbacks.length - 1].from.phase}/${loopbacks[loopbacks.length - 1].from.subStage}`
      : undefined,
    lastTo: loopbacks.length > 0
      ? `${loopbacks[loopbacks.length - 1].to.phase}/${loopbacks[loopbacks.length - 1].to.subStage}`
      : undefined,
  };

  return {
    slug: state.slug,
    branch: state.branch,
    mode: state.mode,
    classification: state.classification,
    status: state.status,
    currentPhase: state.currentPhase,
    currentSubStage: state.currentSubStage,
    currentPhaseStartedAt,
    currentSubStageStatus,
    currentSubStageIndex,
    currentPhaseTotal,
    startedAt: state.started,
    progress: { completed, total, percent },
    phases: phaseViews,
    loopbacks: loopbackView,
  };
}

function getAutoKitPhases(state: WorkKitState): PhaseName[] {
  if (!state.workflow) return [...PHASE_NAMES];
  const phases = new Set<PhaseName>();
  for (const step of state.workflow) {
    if (step.included) phases.add(step.phase);
  }
  // Maintain canonical order
  return PHASE_NAMES.filter(p => phases.has(p));
}

// ── Collect Completed Items ─────────────────────────────────────────

export function collectCompletedItems(mainRepoRoot: string): CompletedItemView[] {
  const indexPath = path.join(mainRepoRoot, ".work-kit-tracker", "index.md");
  if (!fs.existsSync(indexPath)) return [];

  let content: string;
  try {
    content = fs.readFileSync(indexPath, "utf-8");
  } catch {
    return [];
  }

  const items: CompletedItemView[] = [];
  // Format: | Date | Slug | PR | Status | Phases |
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (!match) continue;
    const col1 = match[1].trim();
    if (col1 === "Date" || col1.startsWith("-")) continue;
    items.push({
      slug: match[2].trim(),
      pr: match[3].trim() !== "n/a" ? match[3].trim() : undefined,
      completedAt: col1,
      phases: match[5].trim(),
    });
  }

  return items;
}

// ── Collect All Dashboard Data ──────────────────────────────────────

export function collectDashboardData(mainRepoRoot: string, cachedWorktrees?: string[]): DashboardData {
  const worktrees = cachedWorktrees ?? discoverWorktrees(mainRepoRoot);
  const activeItems: WorkItemView[] = [];
  const completedFromWorktrees: CompletedItemView[] = [];

  for (const wt of worktrees) {
    const item = collectWorkItem(wt);
    if (!item) continue;
    if (item.status === "completed") {
      const phaseNames = item.phases
        .filter(p => p.status === "completed")
        .map(p => p.name)
        .join("→");
      completedFromWorktrees.push({
        slug: item.slug,
        completedAt: item.startedAt,
        phases: phaseNames,
      });
    } else {
      activeItems.push(item);
    }
  }

  // Sort: in-progress first, then paused, then by start time
  activeItems.sort((a, b) => {
    const statusOrder: Record<string, number> = { "in-progress": 0, "paused": 1, "failed": 2 };
    const aOrder = statusOrder[a.status] ?? 3;
    const bOrder = statusOrder[b.status] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  // Merge completed items from worktrees and index file, dedup by slug
  // Also exclude any slug that is currently active (re-initialized features)
  const activeSlugs = new Set(activeItems.map(i => i.slug));
  const indexItems = collectCompletedItems(mainRepoRoot);
  const seen = new Set(completedFromWorktrees.map(i => i.slug));
  const completedItems = [
    ...completedFromWorktrees.filter(i => !activeSlugs.has(i.slug)),
    ...indexItems.filter(i => !seen.has(i.slug) && !activeSlugs.has(i.slug)),
  ];

  return {
    activeItems,
    completedItems,
    lastUpdated: new Date(),
  };
}
