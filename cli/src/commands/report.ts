import * as fs from "node:fs";
import * as path from "node:path";
import { findWorktreeRoot, resolveMainRepoRoot } from "../state/store.js";
import { TRACKER_DIR, ARCHIVE_DIR, INDEX_FILE } from "../config/constants.js";
import {
  PHASE_NAMES,
  MODE_FULL,
  MODE_AUTO,
  type PhaseName,
  type Classification,
  type WorkKitState,
} from "../state/schema.js";
import { readJsonFile } from "../utils/json.js";
import { durationMs, formatDurationMs } from "../utils/time.js";
import { bold, cyan, dim, green, yellow } from "../utils/colors.js";

const RECENT_LIMIT = 10;

export interface PhaseStats {
  runs: number;
  avgDurationMs: number;
  totalDurationMs: number;
}

export interface RecentEntry {
  slug: string;
  completedAt: string;
  classification?: Classification;
  mode: typeof MODE_FULL | typeof MODE_AUTO;
  durationMs?: number;
}

export interface ReportData {
  totalCompleted: number;
  byClassification: Partial<Record<Classification | "unclassified", number>>;
  byMode: Partial<Record<typeof MODE_FULL | typeof MODE_AUTO, number>>;
  avgDurationMs: number;
  totalLoopbacks: number;
  loopbackRate: number;
  perPhase: Record<PhaseName, PhaseStats>;
  recent: RecentEntry[];
  source: { mainRepoRoot: string; trackerDir: string };
}

function emptyPhaseStats(): PhaseStats {
  return { runs: 0, avgDurationMs: 0, totalDurationMs: 0 };
}

export function collectReport(mainRepoRoot: string): ReportData {
  const trackerDir = path.join(mainRepoRoot, TRACKER_DIR);
  const archiveDir = path.join(trackerDir, ARCHIVE_DIR);

  const data: ReportData = {
    totalCompleted: 0,
    byClassification: {},
    byMode: {},
    avgDurationMs: 0,
    totalLoopbacks: 0,
    loopbackRate: 0,
    perPhase: PHASE_NAMES.reduce((acc, p) => {
      acc[p] = emptyPhaseStats();
      return acc;
    }, {} as Record<PhaseName, PhaseStats>),
    recent: [],
    source: { mainRepoRoot, trackerDir },
  };

  let folders: string[];
  try {
    folders = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return data;
  }

  let totalRunDurationMs = 0;
  let runsWithDuration = 0;
  // Bounded min-heap-by-completedAt would be ideal; for ≤10 entries
  // a simple sorted insertion is cheaper than a full sort at the end.
  const keepRecent = (entry: RecentEntry) => {
    data.recent.push(entry);
    data.recent.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
    if (data.recent.length > RECENT_LIMIT) data.recent.length = RECENT_LIMIT;
  };

  for (const folder of folders) {
    const state = readJsonFile<WorkKitState>(path.join(archiveDir, folder, "tracker.json"));
    if (!state) continue;

    data.totalCompleted++;

    const cls = state.classification ?? "unclassified";
    data.byClassification[cls] = (data.byClassification[cls] ?? 0) + 1;
    data.byMode[state.mode] = (data.byMode[state.mode] ?? 0) + 1;
    data.totalLoopbacks += state.loopbacks?.length ?? 0;

    let runDuration = 0;
    let lastEnd: string | undefined;
    for (const phase of PHASE_NAMES) {
      const ps = state.phases[phase];
      if (!ps || ps.status !== "completed") continue;
      const d = durationMs(ps.startedAt, ps.completedAt);
      data.perPhase[phase].runs++;
      data.perPhase[phase].totalDurationMs += d;
      runDuration += d;
      if (ps.completedAt && (!lastEnd || ps.completedAt > lastEnd)) lastEnd = ps.completedAt;
    }

    if (runDuration > 0) {
      totalRunDurationMs += runDuration;
      runsWithDuration++;
    }

    keepRecent({
      slug: state.slug,
      completedAt: lastEnd ?? state.started,
      classification: state.classification,
      mode: state.mode,
      durationMs: runDuration > 0 ? runDuration : undefined,
    });
  }

  for (const phase of PHASE_NAMES) {
    const s = data.perPhase[phase];
    s.avgDurationMs = s.runs > 0 ? Math.round(s.totalDurationMs / s.runs) : 0;
  }
  data.avgDurationMs = runsWithDuration > 0 ? Math.round(totalRunDurationMs / runsWithDuration) : 0;
  data.loopbackRate = data.totalCompleted > 0 ? data.totalLoopbacks / data.totalCompleted : 0;

  return data;
}

export interface ReportOptions {
  json?: boolean;
  worktreeRoot?: string;
  repo?: string;
}

export function reportCommand(options: ReportOptions = {}): ReportData {
  const mainRepoRoot = options.repo
    ? path.resolve(options.repo)
    : resolveMainRepoRoot(options.worktreeRoot || findWorktreeRoot() || process.cwd());

  const data = collectReport(mainRepoRoot);

  if (options.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    return data;
  }

  const out: string[] = [];
  out.push("");
  out.push(bold("  WORK-KIT REPORT"));
  out.push(dim(`  ${data.source.trackerDir}`));
  out.push("");

  if (data.totalCompleted === 0) {
    out.push(dim("  No completed work-kits found."));
    out.push("");
    process.stderr.write(out.join("\n") + "\n");
    return data;
  }

  out.push(`  ${cyan("Completed")}    ${bold(String(data.totalCompleted))}`);
  out.push(`  ${cyan("Avg run")}      ${formatDurationMs(data.avgDurationMs)}`);
  out.push(`  ${cyan("Loopbacks")}    ${data.totalLoopbacks} ${dim(`(${(data.loopbackRate * 100).toFixed(0)}% rate)`)}`);
  out.push("");

  const byClassEntries = Object.entries(data.byClassification);
  if (byClassEntries.length > 0) {
    out.push(bold("  By Classification"));
    for (const [cls, count] of byClassEntries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))) {
      out.push(`    ${cls.padEnd(16)} ${count}`);
    }
    out.push("");
  }

  const byModeEntries = Object.entries(data.byMode);
  if (byModeEntries.length > 0) {
    out.push(bold("  By Mode"));
    for (const [mode, count] of byModeEntries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))) {
      out.push(`    ${mode.padEnd(16)} ${count}`);
    }
    out.push("");
  }

  out.push(bold("  Avg Phase Duration"));
  for (const phase of PHASE_NAMES) {
    const s = data.perPhase[phase];
    if (s.runs === 0) continue;
    out.push(`    ${phase.padEnd(10)} ${formatDurationMs(s.avgDurationMs).padStart(7)} ${dim(`(${s.runs} runs)`)}`);
  }
  out.push("");

  if (data.recent.length > 0) {
    out.push(bold("  Recent"));
    for (const r of data.recent) {
      const date = r.completedAt.split("T")[0];
      const cls = r.classification ? dim(` [${r.classification}]`) : "";
      const dur = r.durationMs ? dim(` ${formatDurationMs(r.durationMs)}`) : "";
      out.push(`    ${green("✓")} ${date}  ${r.slug}${cls}${dur}`);
    }
    out.push("");
  }

  const indexPath = path.join(data.source.trackerDir, INDEX_FILE);
  if (fs.existsSync(indexPath)) {
    out.push(dim(`  Full index: ${indexPath}`));
  } else {
    out.push(yellow(`  Note: ${INDEX_FILE} not found.`));
  }
  out.push("");

  process.stderr.write(out.join("\n") + "\n");
  return data;
}
