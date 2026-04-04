import { WorkKitState, PhaseName } from "../state/schema.js";
import { getContextFor } from "../config/agent-map.js";
import { extractSection, extractTopSection } from "./extractor.js";
import { readStateMd } from "../state/store.js";
import { skillFilePath } from "../config/phases.js";

/**
 * Build a complete agent prompt for a given phase/sub-stage.
 * Accepts optional pre-read stateMd to avoid repeated file reads in parallel scenarios.
 */
export function buildAgentPrompt(
  worktreeRoot: string,
  state: WorkKitState,
  phase: PhaseName,
  subStage: string,
  stateMd?: string | null
): string {
  const ctx = getContextFor(phase, subStage);
  const md = stateMd ?? readStateMd(worktreeRoot);
  const skill = skillFilePath(phase, subStage);

  const parts: string[] = [];

  parts.push(`# Agent: ${phase}/${subStage}`);
  parts.push(`**Worktree:** ${worktreeRoot}`);
  parts.push(`**Slug:** ${state.slug}`);
  parts.push(`**Branch:** ${state.branch}`);
  parts.push(`**Mode:** ${state.mode}`);
  parts.push("");

  parts.push(`## Instructions`);
  parts.push(`Read and follow the skill file: \`${skill}\``);
  parts.push("");

  if (phase === "wrap-up" && md) {
    parts.push(`## Full State`);
    parts.push(md);
    parts.push("");
  } else if (md && ctx.sections.length > 0) {
    parts.push(`## Context from state.md`);
    parts.push("");

    for (const sectionName of ctx.sections) {
      const content = sectionName.startsWith("### ")
        ? extractSection(md, sectionName)
        : extractTopSection(md, sectionName);
      if (content) {
        parts.push(content);
        parts.push("");
      }
    }
  }

  if (ctx.needsGitDiff) {
    parts.push(`## Git Diff`);
    parts.push(`Run \`git diff main...HEAD\` to review the changes.`);
    parts.push("");
  }

  parts.push(`## Output`);
  parts.push(`Write your outputs to \`.work-kit/state.md\` under a section for this sub-stage.`);

  if (subStage === "wrap-up") {
    parts.push(`Follow the wrap-up skill file instructions for archiving and cleanup.`);
  } else {
    parts.push(`When done, report your outcome so the orchestrator can run: \`npx work-kit complete ${phase}/${subStage} --outcome <outcome>\``);
  }

  return parts.join("\n");
}
