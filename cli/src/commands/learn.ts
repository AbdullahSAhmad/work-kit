import { findWorktreeRoot, readState, resolveMainRepoRoot, stateExists, gitHeadSha } from "../state/store.js";
import {
  appendAutoEntry,
  ensureKnowledgeDir,
  fileForType,
  isKnowledgeType,
  redact,
  type KnowledgeEntry,
  type KnowledgeType,
} from "../utils/knowledge.js";
import { skillFilePath } from "../config/workflow.js";
import type { PhaseName } from "../state/schema.js";

export interface LearnOptions {
  type: string;
  text: string;
  scope?: string;
  phase?: string;
  step?: string;
  source?: string;
  worktreeRoot?: string;
  /** When true, suppress the one-time commit warning. Used by extract. */
  quiet?: boolean;
}

export interface LearnResult {
  action: "learned" | "duplicate" | "error";
  type?: KnowledgeType;
  file?: string;
  redacted?: boolean;
  redactedKinds?: string[];
  message?: string;
}

export function learnCommand(opts: LearnOptions): LearnResult {
  if (!opts.type || !isKnowledgeType(opts.type)) {
    return {
      action: "error",
      message: `Invalid --type "${opts.type}". Must be one of: lesson, convention, risk, workflow.`,
    };
  }
  if (!opts.text || opts.text.trim().length === 0) {
    return { action: "error", message: "--text is required and cannot be empty." };
  }

  const type = opts.type as KnowledgeType;

  // Try to locate a session for auto-fill. Falls back to manual --phase/--step.
  const root = opts.worktreeRoot || findWorktreeRoot();
  let sessionSlug: string | undefined;
  let phase: string | undefined = opts.phase;
  let step: string | undefined = opts.step;
  let mainRepoRoot: string | undefined;
  let skillPath: string | undefined;

  if (root && stateExists(root)) {
    const state = readState(root);
    sessionSlug = state.slug;
    mainRepoRoot = state.metadata?.mainRepoRoot ?? resolveMainRepoRoot(root);
    if (!phase) phase = state.currentPhase ?? undefined;
    if (!step) step = state.currentStep ?? undefined;
    if (phase && step) {
      skillPath = skillFilePath(phase as PhaseName, step);
    }
  }

  if (!mainRepoRoot) {
    // No session — caller must be in a git repo we can resolve
    mainRepoRoot = resolveMainRepoRoot(process.cwd());
    if (!mainRepoRoot) {
      return {
        action: "error",
        message: "No work-kit session found and not inside a git repo. Run from a project directory or provide --worktree-root.",
      };
    }
  }

  const { text, redacted, matches } = redact(opts.text);

  ensureKnowledgeDir(mainRepoRoot);

  const entry: KnowledgeEntry = {
    ts: new Date().toISOString(),
    sessionSlug,
    phase,
    step,
    skillPath,
    gitSha: gitHeadSha(mainRepoRoot),
    source: opts.source ?? "explicit-cli",
    text,
    scope: opts.scope,
  };

  const file = fileForType(type);
  const wrote = appendAutoEntry(mainRepoRoot, file, entry);

  return {
    action: wrote ? "learned" : "duplicate",
    type,
    file,
    redacted,
    redactedKinds: matches,
  };
}
