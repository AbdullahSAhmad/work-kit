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
  startedAt: string;
  progress: { completed: number; total: number; percent: number };
  phases: { name: string; status: string }[];
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
  const phaseViews: { name: string; status: string }[] = [];

  const phaseList: PhaseName[] = state.mode === "auto-kit" && state.workflow
    ? getAutoKitPhases(state)
    : [...PHASE_NAMES];

  for (const phaseName of phaseList) {
    const phase = state.phases[phaseName];
    if (!phase) {
      phaseViews.push({ name: phaseName, status: "pending" });
      // Count substages for total
      const subs = SUBSTAGES_BY_PHASE[phaseName] || [];
      total += subs.length;
      continue;
    }

    phaseViews.push({ name: phaseName, status: phase.status });

    const subStageKeys = Object.keys(phase.subStages);
    if (subStageKeys.length === 0) {
      // Use default substages
      const defaults = SUBSTAGES_BY_PHASE[phaseName] || [];
      total += defaults.length;
      if (phase.status === "completed") completed += defaults.length;
      else if (phase.status === "skipped") completed += defaults.length;
    } else {
      for (const key of subStageKeys) {
        total++;
        const sub = phase.subStages[key];
        if (sub.status === "completed" || sub.status === "skipped") {
          completed++;
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
  const indexPath = path.join(mainRepoRoot, ".claude", "work-kit", "index.md");
  if (!fs.existsSync(indexPath)) return [];

  let content: string;
  try {
    content = fs.readFileSync(indexPath, "utf-8");
  } catch {
    return [];
  }

  const items: CompletedItemView[] = [];
  // Parse markdown table or list entries
  // Expected format: | slug | PR | date | phases |
  // or list format: - slug (#PR) - date - phases
  const lines = content.split("\n");
  for (const line of lines) {
    // Try table format: | slug | #PR | date | phases |
    const tableMatch = line.match(/^\|\s*(.+?)\s*\|\s*(#?\d+)?\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (tableMatch) {
      const slug = tableMatch[1].trim();
      if (slug === "Slug" || slug === "---" || slug.startsWith("-")) continue; // skip header
      items.push({
        slug,
        pr: tableMatch[2]?.trim() || undefined,
        completedAt: tableMatch[3].trim(),
        phases: tableMatch[4].trim(),
      });
      continue;
    }

    // Try list format: - **slug** (#38) completed 2d ago — plan→review
    const listMatch = line.match(/^[-*]\s+\*?\*?(.+?)\*?\*?\s+\(?(#\d+)?\)?\s*[-—]?\s*(.+?)?\s*[-—]\s*(.+)$/);
    if (listMatch) {
      items.push({
        slug: listMatch[1].trim(),
        pr: listMatch[2]?.trim() || undefined,
        completedAt: listMatch[3]?.trim() || "",
        phases: listMatch[4]?.trim() || "",
      });
    }
  }

  return items;
}

// ── Collect All Dashboard Data ──────────────────────────────────────

export function collectDashboardData(mainRepoRoot: string, cachedWorktrees?: string[]): DashboardData {
  const worktrees = cachedWorktrees ?? discoverWorktrees(mainRepoRoot);
  const activeItems: WorkItemView[] = [];

  for (const wt of worktrees) {
    const item = collectWorkItem(wt);
    if (item && item.status !== "completed") {
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

  const completedItems = collectCompletedItems(mainRepoRoot);

  return {
    activeItems,
    completedItems,
    lastUpdated: new Date(),
  };
}
