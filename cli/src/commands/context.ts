import { readState, readStateMd, findWorktreeRoot } from "../state/store.js";
import { getContextFor } from "../config/agent-map.js";
import { extractSection, extractTopSection } from "../context/extractor.js";
import type { PhaseName } from "../state/schema.js";

interface ContextResult {
  phase: PhaseName;
  sections: Record<string, string | null>;
  needsGitDiff: boolean;
}

export function contextCommand(phase: PhaseName, worktreeRoot?: string): ContextResult {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    throw new Error("No work-kit state found. Run `work-kit init` first.");
  }

  const state = readState(root);
  const stateMd = readStateMd(root);

  if (!stateMd) {
    throw new Error("No state.md found.");
  }

  const ctx = getContextFor(phase);
  const sections: Record<string, string | null> = {};

  for (const sectionName of ctx.sections) {
    if (sectionName.startsWith("### ")) {
      sections[sectionName] = extractSection(stateMd, sectionName);
    } else {
      sections[sectionName] = extractTopSection(stateMd, sectionName);
    }
  }

  return {
    phase,
    sections,
    needsGitDiff: !!ctx.needsGitDiff,
  };
}
