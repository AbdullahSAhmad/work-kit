import { getContextFor } from "../config/agent-map.js";
import { CLI_BINARY } from "../config/constants.js";
import { skillFilePath } from "../config/workflow.js";
import { receiptPathIfApplicable } from "../receipts/store.js";
import { PhaseName, WorkKitState } from "../state/schema.js";
import { readStateMd } from "../state/store.js";
import { extractSection, extractTopSection } from "./extractor.js";
import { redactIgnoredBlocks } from "./redactor.js";

/**
 * Build a complete agent prompt for a given phase/step.
 * Accepts optional pre-read stateMd to avoid repeated file reads in parallel scenarios.
 */
export function buildAgentPrompt(
  worktreeRoot: string,
  state: WorkKitState,
  phase: PhaseName,
  step: string,
  stateMd?: string | null,
): string {
  const ctx = getContextFor(phase, step);
  const md = stateMd ?? readStateMd(worktreeRoot);
  const skill = skillFilePath(phase, step);

  const parts: string[] = [];

  parts.push(`# Agent: ${phase}/${step}`);
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
  parts.push(`Write your prose working notes to \`.work-kit/state.md\` under a section for this step.`);

  const rp = receiptPathIfApplicable(phase, step);
  if (rp) {
    parts.push("");
    parts.push(
      `**Required receipt:** Before the step is considered done, write a structured JSON receipt to \`${rp}\`. The skill file's "## Receipt" section declares the schema. The CLI validates the receipt and derives the step outcome from it — do not pass an \`--outcome\` flag.`,
    );
    parts.push("");
    parts.push(`When the receipt is on disk, the orchestrator will run: \`${CLI_BINARY} complete ${phase}/${step}\``);
  } else if (step === "wrap-up") {
    parts.push(`Follow the wrap-up skill file instructions for archiving and cleanup.`);
  } else {
    parts.push(
      `When done, report your outcome so the orchestrator can run: \`${CLI_BINARY} complete ${phase}/${step} --outcome <outcome>\``,
    );
  }

  return redactIgnoredBlocks(parts.join("\n"));
}
