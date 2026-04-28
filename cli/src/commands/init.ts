import * as fs from "node:fs";
import * as path from "node:path";
import { WorkKitState, PhaseState, PhaseName, PHASE_NAMES, STEPS_BY_PHASE, WorkflowStep, Classification, MODE_FULL, MODE_AUTO, ModelPolicy, isModelPolicy } from "../state/schema.js";
import { writeState, writeStateMd, stateExists, STATE_DIR, resolveMainRepoRoot } from "../state/store.js";
import { buildFullWorkflow, buildDefaultWorkflow, skillFilePath } from "../config/workflow.js";
import { BRANCH_PREFIX, CLI_BINARY } from "../config/constants.js";
import { loadProjectConfig } from "../config/project-config.js";
import { resolveModel } from "../config/model-routing.js";
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
    const steps: Record<string, { status: "pending" | "skipped" }> = {};
    const allSteps = STEPS_BY_PHASE[phase];

    for (const s of allSteps) {
      if (workflow) {
        const ws = workflow.find((w) => w.phase === phase && w.step === s);
        steps[s] = { status: ws?.included ? "pending" : "skipped" };
      } else {
        steps[s] = { status: "pending" };
      }
    }

    // Check if entire phase is skipped (all steps skipped)
    const allSkipped = Object.values(steps).every((s) => s.status === "skipped");
    phases[phase] = {
      status: allSkipped ? "skipped" : "pending",
      steps,
    };
  }

  return phases;
}

function generateStateMd(
  slug: string,
  branch: string,
  mode: string,
  description: string,
  firstPhase: string,
  firstStep: string,
  classification?: string,
  workflow?: WorkflowStep[]
): string {
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

  md += `**Phase:** ${firstPhase}
**Step:** ${firstStep}
**Status:** in-progress

## Description
${description}
`;

  if (workflow) {
    md += `\n## Workflow\n`;
    for (const ws of workflow) {
      if (ws.included) {
        const label = `${ws.phase.charAt(0).toUpperCase() + ws.phase.slice(1)}: ${ws.step.charAt(0).toUpperCase() + ws.step.slice(1)}`;
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

## Observations
<!-- Append typed bullets as you notice things worth preserving across sessions. -->
<!-- wrap-up/knowledge routes these to .work-kit-knowledge/. -->
<!-- Grammar: - [lesson|convention|risk|workflow] text  (workflow tag may include :phase/step) -->
<!-- Examples: -->
<!--   - [risk] auth.middleware.ts breaks if SESSION_SECRET is unset. -->
<!--   - [convention] All API errors must use createApiError() helper. -->
<!--   - [workflow:test/exercise] The E2E lens doesn't tell agents to start the dev server first. -->

## Deviations
<!-- Append here whenever implementation diverges from the Blueprint -->
<!-- Format: **<Blueprint step>**: <what changed> — <why> -->
`;

  return md;
}

/**
 * Append `entry` to `<root>/.gitignore` if it isn't already present.
 * Idempotent. Creates the file if missing. Reused by setup.ts.
 */
export function ensureGitignored(root: string, entry: string): void {
  const gitignorePath = path.join(root, ".gitignore");

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (content.split("\n").some((line) => line.trim() === entry)) return;
    fs.appendFileSync(gitignorePath, `\n${entry}\n`);
  } else {
    fs.writeFileSync(gitignorePath, `${entry}\n`);
  }
}

export function initCommand(options: {
  mode?: "full" | "auto";
  description: string;
  classification?: Classification;
  gated?: boolean;
  modelPolicy?: ModelPolicy;
  worktreeRoot?: string;
}): Action {
  const worktreeRoot = options.worktreeRoot || process.cwd();
  const mainRepoRoot = resolveMainRepoRoot(worktreeRoot);
  const projectConfig = loadProjectConfig(mainRepoRoot);

  const mode = options.mode ?? projectConfig.defaults?.mode ?? "full";
  const classification = options.classification ?? projectConfig.defaults?.classification;
  const gated = options.gated ?? projectConfig.defaults?.gated ?? false;
  const modelPolicy: ModelPolicy = options.modelPolicy ?? "auto";
  const { description } = options;

  // Validate model policy (guards against CLI callers that bypass the commander layer)
  if (!isModelPolicy(modelPolicy)) {
    return {
      action: "error",
      message: `Invalid --model-policy "${modelPolicy}". Use one of: auto, opus, sonnet, haiku, inherit.`,
    };
  }

  // Guard: don't overwrite existing state
  if (stateExists(worktreeRoot)) {
    return {
      action: "error",
      message: "State already exists in this directory. Use `work-kit status` to check current state.",
      suggestion: "To start fresh, delete .work-kit/tracker.json first.",
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
  const branch = `${BRANCH_PREFIX}${slug}`;
  const modeLabel = mode === "full" ? MODE_FULL : MODE_AUTO;

  // Build workflow
  let workflow: WorkflowStep[] | undefined;
  if (mode === "auto" && classification) {
    workflow = buildDefaultWorkflow(classification, projectConfig.workflow);
  } else if (mode === "full") {
    workflow = buildFullWorkflow();
  }

  // First active step is always triage/classify — Triage runs first regardless of mode/classification.
  // For auto-kit without an upfront --classification, the workflow is empty until Triage classifies.
  let firstPhase: PhaseName = "triage";
  let firstStep = "classify";
  const first = workflow?.find((s) => s.included);
  if (first) {
    firstPhase = first.phase;
    firstStep = first.step;
  }

  // Build state
  const state: WorkKitState = {
    version: 3,
    slug,
    branch,
    started: new Date().toISOString(),
    mode: modeLabel,
    ...(gated && { gated: true }),
    ...(classification && { classification }),
    ...(modelPolicy !== "auto" && { modelPolicy }),
    status: "in-progress",
    currentPhase: firstPhase,
    currentStep: firstStep,
    phases: buildPhases(workflow),
    ...(mode === "auto" && workflow && { workflow }),
    loopbacks: [],
    metadata: {
      worktreeRoot,
      mainRepoRoot,
    },
  };

  // Ensure .work-kit/ is gitignored (temp working state, not for commits)
  ensureGitignored(worktreeRoot, `${STATE_DIR}/`);

  // Write state files
  writeState(worktreeRoot, state);
  writeStateMd(worktreeRoot, generateStateMd(slug, branch, modeLabel, description, firstPhase, firstStep, classification, workflow));

  const model = resolveModel(state, firstPhase, firstStep);

  return {
    action: "spawn_agent",
    phase: firstPhase,
    step: firstStep,
    skillFile: skillFilePath(firstPhase, firstStep),
    agentPrompt: `You are starting the ${firstPhase} phase. Begin with the ${firstStep} step. Read the skill file and follow its instructions. Write outputs to .work-kit/state.md.`,
    onComplete: `${CLI_BINARY} complete ${firstPhase}/${firstStep}`,
    ...(model && { model }),
  };
}
