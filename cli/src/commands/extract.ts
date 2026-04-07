import { findWorktreeRoot, readState, readStateMd, resolveMainRepoRoot, gitHeadSha } from "../state/store.js";
import {
  appendAutoEntries,
  ensureKnowledgeDir,
  fileForType,
  isKnowledgeType,
  KNOWLEDGE_TYPES,
  redact,
  type KnowledgeEntry,
  type KnowledgeType,
} from "../utils/knowledge.js";
import { skillFilePath } from "../config/workflow.js";
import type { PhaseName, WorkKitState } from "../state/schema.js";

export interface ExtractOptions {
  worktreeRoot?: string;
}

export interface ExtractResult {
  action: "extracted" | "error";
  written: number;
  duplicates: number;
  byType: Record<KnowledgeType, number>;
  message?: string;
}

interface RawEntry {
  type: KnowledgeType;
  text: string;
  phase?: string;
  step?: string;
  source: string;
}

function emptyByType(): Record<KnowledgeType, number> {
  const out = {} as Record<KnowledgeType, number>;
  for (const t of KNOWLEDGE_TYPES) out[t] = 0;
  return out;
}

// ── Single-pass state.md parser ─────────────────────────────────────

const OBSERVATION_RE = /^-\s*\[([a-z]+)(?::([a-z0-9-]+\/[a-z0-9-]+))?\]\s*(.+)$/i;

/**
 * Walk state.md once and emit raw entries from the three sections we know:
 * Observations (typed bullets), Decisions (any bullet → convention),
 * Deviations (any bullet → workflow with [deviation] prefix).
 */
function parseStateMd(stateMd: string): RawEntry[] {
  const out: RawEntry[] = [];
  if (!stateMd) return out;

  // Only `## Observations` is auto-harvested. `## Decisions` and `## Deviations`
  // are agent scratch space during normal phase work — they routinely contain
  // test plans, acceptance-criteria checklists, and self-review dumps. Auto-
  // routing them floods workflow.md with noise. Agents opt into harvesting by
  // writing typed bullets (`- [lesson|convention|risk|workflow] text`) under
  // `## Observations`.
  let inObservations = false;

  for (const rawLine of stateMd.split("\n")) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("## ")) {
      inObservations = trimmed.slice(3).trim().toLowerCase() === "observations";
      continue;
    }

    if (!inObservations) continue;
    if (!trimmed.startsWith("-") || trimmed.startsWith("<!--")) continue;

    const m = trimmed.match(OBSERVATION_RE);
    if (!m) continue;
    const tag = m[1].toLowerCase();
    if (!isKnowledgeType(tag)) continue;
    const phaseStep = m[2];
    const text = m[3].trim();
    if (text.length === 0) continue;
    const entry: RawEntry = { type: tag, text, source: "auto-state-md" };
    if (phaseStep) {
      const [p, s] = phaseStep.split("/");
      entry.phase = p;
      entry.step = s;
    }
    out.push(entry);
  }

  return out;
}

// ── Tracker.json extraction ─────────────────────────────────────────

function fromLoopbacks(state: WorkKitState): RawEntry[] {
  return (state.loopbacks ?? []).map((lb) => ({
    type: "workflow" as const,
    text: `[loopback] ${lb.from.phase}/${lb.from.step} → ${lb.to.phase}/${lb.to.step}: ${lb.reason}`,
    phase: lb.from.phase,
    step: lb.from.step,
    source: "auto-tracker",
  }));
}

function fromSkippedAndFailed(state: WorkKitState): RawEntry[] {
  const out: RawEntry[] = [];
  for (const [phaseName, phaseState] of Object.entries(state.phases)) {
    for (const [stepName, stepState] of Object.entries(phaseState.steps)) {
      if (stepState.status === "skipped") {
        out.push({
          type: "workflow",
          text: `[skipped] ${phaseName}/${stepName} was skipped during this session.`,
          phase: phaseName,
          step: stepName,
          source: "auto-tracker",
        });
      }
      if (stepState.outcome === "broken" || stepState.outcome === "fix_needed") {
        out.push({
          type: "workflow",
          text: `[failure] ${phaseName}/${stepName} reported outcome=${stepState.outcome}.`,
          phase: phaseName,
          step: stepName,
          source: "auto-tracker",
        });
      }
    }
  }
  return out;
}

// ── Main ────────────────────────────────────────────────────────────

export function extractCommand(opts: ExtractOptions = {}): ExtractResult {
  const root = opts.worktreeRoot || findWorktreeRoot();
  if (!root) {
    return {
      action: "error",
      written: 0,
      duplicates: 0,
      byType: emptyByType(),
      message: "No work-kit session found. Run from inside a worktree.",
    };
  }

  let state: WorkKitState;
  try {
    state = readState(root);
  } catch (e: any) {
    return {
      action: "error",
      written: 0,
      duplicates: 0,
      byType: emptyByType(),
      message: `Could not read state: ${e.message}`,
    };
  }

  const mainRepoRoot = state.metadata?.mainRepoRoot ?? resolveMainRepoRoot(root);
  ensureKnowledgeDir(mainRepoRoot);

  const stateMd = readStateMd(root) ?? "";

  const raw: RawEntry[] = [
    ...parseStateMd(stateMd),
    ...fromLoopbacks(state),
    ...fromSkippedAndFailed(state),
  ];

  const ts = new Date().toISOString();
  const sha = gitHeadSha(mainRepoRoot);

  // Group entries by destination file for a single read-modify-write per file.
  const grouped = new Map<string, KnowledgeEntry[]>();
  for (const r of raw) {
    const phase = r.phase ?? state.currentPhase ?? undefined;
    const step = r.step ?? state.currentStep ?? undefined;
    const skillPath = phase && step ? skillFilePath(phase as PhaseName, step) : undefined;
    const { text } = redact(r.text);

    const entry: KnowledgeEntry = {
      ts,
      sessionSlug: state.slug,
      phase,
      step,
      skillPath,
      gitSha: sha,
      source: r.source,
      text,
    };

    const file = fileForType(r.type);
    const bucket = grouped.get(file);
    if (bucket) bucket.push(entry);
    else grouped.set(file, [entry]);
  }

  const result = appendAutoEntries(mainRepoRoot, grouped);

  // Map per-file write counts back to per-type counts. Each KnowledgeType
  // routes to exactly one file, so the lookup is unambiguous.
  const byType = emptyByType();
  for (const t of KNOWLEDGE_TYPES) {
    byType[t] = result.perFile.get(fileForType(t))?.written ?? 0;
  }

  return { action: "extracted", written: result.written, duplicates: result.duplicates, byType };
}
