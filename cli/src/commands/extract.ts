import { skillFilePath } from "../config/workflow.js";
import type { PhaseName, WorkKitState } from "../state/schema.js";
import { findWorktreeRoot, gitHeadSha, readState, readStateMd, resolveMainRepoRoot } from "../state/store.js";
import {
  appendAutoEntries,
  ensureKnowledgeDir,
  fileForType,
  isKnowledgeType,
  type KnowledgeEntry,
  type KnowledgeType,
  redact,
} from "../utils/knowledge.js";

export interface ExtractOptions {
  worktreeRoot?: string;
}

export interface ExtractResult {
  action: "extracted" | "error";
  written: number;
  duplicates: number;
  byFile: { findings: number; workflow: number };
  message?: string;
}

interface RawEntry {
  type: KnowledgeType;
  text: string;
  phase?: string;
  step?: string;
  source: string;
}

function emptyByFile(): { findings: number; workflow: number } {
  return { findings: 0, workflow: 0 };
}

// ── Single-pass state.md parser ─────────────────────────────────────

const OBSERVATION_RE = /^-\s*\[([a-z]+)(?::([a-z0-9-]+\/[a-z0-9-]+))?\]\s*(.+)$/i;

/**
 * A bullet under `## Decisions` is harvested when it follows the documented
 * shape `**<context>**: chose <X> over <Y> — <why>`. Free-form lines are
 * skipped (not errors). The leading `**context**:` becomes the entry's title.
 */
const DECISION_RE = /^-\s*\*\*([^*]+)\*\*\s*:\s*(.+)$/;

/**
 * Walk state.md once and emit raw entries from:
 *   - `## Observations` — typed bullets (`- [lesson|convention|risk|workflow|decision] text`)
 *   - `## Decisions`    — bullets matching `**<context>**: chose X over Y — <why>`
 *
 * `## Deviations` stays scratch — agents routinely dump test plans there.
 */
function parseStateMd(stateMd: string): RawEntry[] {
  const out: RawEntry[] = [];
  if (!stateMd) return out;

  type Section = "observations" | "decisions" | "other";
  let section: Section = "other";

  for (const rawLine of stateMd.split("\n")) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("## ")) {
      const heading = trimmed.slice(3).trim().toLowerCase();
      if (heading === "observations") section = "observations";
      else if (heading === "decisions") section = "decisions";
      else section = "other";
      continue;
    }

    if (section === "other") continue;
    if (!trimmed.startsWith("-") || trimmed.startsWith("<!--")) continue;

    if (section === "observations") {
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
      continue;
    }

    // section === "decisions"
    const m = trimmed.match(DECISION_RE);
    if (!m) continue;
    const context = m[1].trim();
    const rationale = m[2].trim();
    if (context.length === 0 || rationale.length === 0) continue;
    out.push({
      type: "decision",
      text: `**${context}**: ${rationale}`,
      source: "auto-state-md",
    });
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
      byFile: emptyByFile(),
      message: "No work-kit session found. Run from inside a worktree.",
    };
  }

  let state: WorkKitState;
  try {
    state = readState(root);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      action: "error",
      written: 0,
      duplicates: 0,
      byFile: emptyByFile(),
      message: `Could not read state: ${message}`,
    };
  }

  const mainRepoRoot = state.metadata?.mainRepoRoot ?? resolveMainRepoRoot(root);
  ensureKnowledgeDir(mainRepoRoot);

  const stateMd = readStateMd(root) ?? "";

  const raw: RawEntry[] = [...parseStateMd(stateMd), ...fromLoopbacks(state), ...fromSkippedAndFailed(state)];

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

  const byFile = {
    findings: result.perFile.get("findings.md")?.written ?? 0,
    workflow: result.perFile.get("workflow.md")?.written ?? 0,
  };

  return { action: "extracted", written: result.written, duplicates: result.duplicates, byFile };
}
