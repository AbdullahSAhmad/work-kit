import * as fs from "node:fs";
import * as path from "node:path";
import { WorkKitState, PhaseState, PhaseName, PHASE_NAMES, SUBSTAGES_BY_PHASE, WorkflowStep, Classification } from "../state/schema.js";
import { writeState, writeStateMd, stateExists } from "../state/store.js";
import { buildFullWorkflow, buildDefaultWorkflow, skillFilePath } from "../config/phases.js";
import type { Action } from "../state/schema.js";

function toSlug(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40)
    .replace(/-+$/, "");
}

function buildPhases(workflow?: WorkflowStep[]): Record<PhaseName, PhaseState> {
  const phases = {} as Record<PhaseName, PhaseState>;

  for (const phase of PHASE_NAMES) {
    const subStages: Record<string, { status: "pending" | "skipped" }> = {};
    const allSubStages = SUBSTAGES_BY_PHASE[phase];

    for (const ss of allSubStages) {
      if (workflow) {
        const step = workflow.find((s) => s.phase === phase && s.subStage === ss);
        subStages[ss] = { status: step?.included ? "pending" : "skipped" };
      } else {
        subStages[ss] = { status: "pending" };
      }
    }

    // Check if entire phase is skipped (all sub-stages skipped)
    const allSkipped = Object.values(subStages).every((s) => s.status === "skipped");
    phases[phase] = {
      status: allSkipped ? "skipped" : "pending",
      subStages,
    };
  }

  return phases;
}

function generateStateMd(slug: string, branch: string, mode: string, description: string, classification?: string, workflow?: WorkflowStep[]): string {
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const date = new Date().toISOString().split("T")[0];

  let md = `# ${title}

**Slug:** ${slug}
**Branch:** ${branch}
**Started:** ${date}
**Mode:** ${mode}
`;

  if (classification) {
    md += `**Classification:** ${classification}\n`;
  }

  md += `**Phase:** plan
**Sub-stage:** clarify
**Status:** in-progress

## Description
${description}
`;

  if (workflow) {
    md += `\n## Workflow\n`;
    for (const step of workflow) {
      if (step.included) {
        const label = `${step.phase.charAt(0).toUpperCase() + step.phase.slice(1)}: ${step.subStage.charAt(0).toUpperCase() + step.subStage.slice(1)}`;
        md += `- [ ] ${label}\n`;
      }
    }
  }

  md += `
## Criteria
<!-- Added during Plan/Clarify, checked off during test/review -->

## Decisions
<!-- Append here whenever you choose between real alternatives -->
<!-- Format: **<context>**: chose <X> over <Y> — <why> -->

## Deviations
<!-- Append here whenever implementation diverges from the Blueprint -->
<!-- Format: **<Blueprint step>**: <what changed> — <why> -->
`;

  return md;
}

export function initCommand(options: {
  mode: "full" | "auto";
  description: string;
  classification?: Classification;
  worktreeRoot?: string;
}): Action {
  const { mode, description, classification } = options;
  const worktreeRoot = options.worktreeRoot || process.cwd();

  // Guard: don't overwrite existing state
  if (stateExists(worktreeRoot)) {
    return {
      action: "error",
      message: "State already exists in this directory. Use `work-kit status` to check current state.",
      suggestion: "To start fresh, delete .work-kit/state.json first.",
    };
  }

  // Auto mode requires classification
  if (mode === "auto" && !classification) {
    return {
      action: "error",
      message: "Auto mode requires --classification (bug-fix, small-change, refactor, feature, large-feature).",
    };
  }

  // Validate mode
  if (mode !== "full" && mode !== "auto") {
    return {
      action: "error",
      message: `Invalid mode "${mode}". Use "full" or "auto".`,
    };
  }

  const slug = toSlug(description);
  const branch = `feature/${slug}`;
  const modeLabel = mode === "full" ? "full-kit" : "auto-kit";

  // Build workflow
  let workflow: WorkflowStep[] | undefined;
  if (mode === "auto" && classification) {
    workflow = buildDefaultWorkflow(classification);
  } else if (mode === "full") {
    workflow = buildFullWorkflow();
  }

  // Find first active sub-stage
  let firstPhase: PhaseName = "plan";
  let firstSubStage = "clarify";

  if (workflow) {
    const first = workflow.find((s) => s.included);
    if (first) {
      firstPhase = first.phase;
      firstSubStage = first.subStage;
    }
  }

  // Build state
  const state: WorkKitState = {
    version: 1,
    slug,
    branch,
    started: new Date().toISOString(),
    mode: modeLabel,
    ...(classification && { classification }),
    status: "in-progress",
    currentPhase: firstPhase,
    currentSubStage: firstSubStage,
    phases: buildPhases(workflow),
    ...(mode === "auto" && workflow && { workflow }),
    loopbacks: [],
    metadata: {
      worktreeRoot,
      mainRepoRoot: worktreeRoot, // will be set properly by caller
    },
  };

  // Write state files
  writeState(worktreeRoot, state);
  writeStateMd(worktreeRoot, generateStateMd(slug, branch, modeLabel, description, classification, workflow));

  return {
    action: "spawn_agent",
    phase: firstPhase,
    subStage: firstSubStage,
    skillFile: skillFilePath(firstPhase, firstSubStage),
    agentPrompt: `You are starting the ${firstPhase} phase. Begin with the ${firstSubStage} sub-stage. Read the skill file and follow its instructions. Write outputs to .work-kit/state.md.`,
    onComplete: `npx work-kit-cli complete ${firstPhase}/${firstSubStage}`,
  };
}
