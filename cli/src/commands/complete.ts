import * as fs from "node:fs";
import * as path from "node:path";
import {
  ARCHIVE_DIR,
  CLI_BINARY,
  INDEX_FILE,
  MAX_DEBUG_ITERATIONS,
  MAX_LOOPBACKS_PER_ROUTE,
  SKILL_DIR_PREFIX,
  SUMMARY_FILE,
  TRACKER_DIR,
} from "../config/constants.js";
import { resolveModel } from "../config/model-routing.js";
import { buildDefaultWorkflow, PHASE_ORDER } from "../config/workflow.js";
import { resolveReceiptOutcome } from "../receipts/resolve.js";
import { isReceiptStepKey } from "../receipts/schemas.js";
import { parseLocation, resetToLocation } from "../state/helpers.js";
import {
  type Action,
  type Classification,
  isClassification,
  isStepOutcome,
  type Location,
  type PhaseName,
  STEP_OUTCOMES,
  type StepOutcome,
  type StepState,
  type WorkKitState,
} from "../state/schema.js";
import {
  clearBlockingMarkers,
  findWorktreeRoot,
  readState,
  readStateMd,
  resolveMainRepoRoot,
  STATE_FILE,
  STATE_MD_FILE,
  stateMdPath,
  statePath,
  writeState,
} from "../state/store.js";
import { checkLoopback, countLoopbacksForRoute } from "../workflow/loopbacks.js";
import { isPhaseComplete, nextStepInPhase } from "../workflow/transitions.js";

const DEBUG_SKILL_FILE = `.claude/skills/${SKILL_DIR_PREFIX}debug/SKILL.md`;

export function completeCommand(
  target: string,
  outcome?: string,
  worktreeRoot?: string,
  classification?: string,
): Action {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found. Run `work-kit init` first." };
  }

  // Forward state transition → clear any stale "blocked on user" markers
  clearBlockingMarkers(root);

  // Validate outcome against the closed enum
  let typedOutcome: StepOutcome | undefined;
  if (outcome) {
    if (!isStepOutcome(outcome)) {
      return {
        action: "error",
        message: `Invalid outcome "${outcome}".`,
        suggestion: `Valid outcomes: ${STEP_OUTCOMES.join(", ")}`,
      };
    }
    typedOutcome = outcome;
  }

  const state = readState(root);
  const { phase, step } = parseLocation(target);

  if (!state.phases[phase]) {
    return { action: "error", message: `Unknown phase: ${phase}` };
  }

  const stepState = state.phases[phase].steps[step];
  if (!stepState) {
    return { action: "error", message: `Unknown step: ${phase}/${step}` };
  }

  if (stepState.status === "completed") {
    return { action: "error", message: `${phase}/${step} is already completed.` };
  }
  if (stepState.status === "skipped") {
    return {
      action: "error",
      message: `${phase}/${step} is skipped and cannot be completed. Add it to the workflow first.`,
    };
  }

  // ── Receipts: if this step has a schema, the receipt is the source of truth. ──
  // The agent's --outcome / --classification flags become fallbacks for steps
  // without a schema, and a hard error when the receipt is missing or invalid.
  let effectiveOutcome: StepOutcome | undefined = typedOutcome;
  let effectiveClassification: Classification | undefined =
    classification && isClassification(classification) ? classification : undefined;

  if (isReceiptStepKey(`${phase}/${step}`)) {
    const resolved = resolveReceiptOutcome(root, phase, step);
    if (!resolved.ok) return resolved.action;
    effectiveOutcome = resolved.outcome;
    if (resolved.classification) effectiveClassification = resolved.classification;
  }

  if (effectiveOutcome === "needs_debug") {
    return handleNeedsDebug(root, state, stepState, { phase, step });
  }

  // Triage/classify writes classification into state and (for auto-kit) builds the workflow.
  if (phase === "triage" && step === "classify" && effectiveClassification) {
    if (!isClassification(effectiveClassification)) {
      return {
        action: "error",
        message: `Invalid classification "${effectiveClassification}".`,
        suggestion: `Valid: bug-fix, small-change, refactor, feature, large-feature`,
      };
    }
    applyClassification(state, effectiveClassification);
  }

  stepState.status = "completed";
  stepState.completedAt = new Date().toISOString();
  if (effectiveOutcome) {
    stepState.outcome = effectiveOutcome;
  }

  const loopback = checkLoopback(phase, step, effectiveOutcome);
  if (loopback) {
    const from = { phase, step };
    const sameRouteCount = countLoopbacksForRoute(state.loopbacks, from, loopback.to);

    if (sameRouteCount >= MAX_LOOPBACKS_PER_ROUTE) {
      writeState(root, state);
      return {
        action: "wait_for_user",
        message: `${phase}/${step} triggered loopback (outcome: ${effectiveOutcome}) but max loopback count (${MAX_LOOPBACKS_PER_ROUTE}) reached for this route. Proceeding with noted caveats.`,
      };
    }

    state.loopbacks.push({
      from,
      to: loopback.to,
      reason: loopback.reason,
      timestamp: new Date().toISOString(),
    });

    resetToLocation(state, loopback.to);
    state.currentPhase = loopback.to.phase;
    state.currentStep = loopback.to.step;

    writeState(root, state);

    return {
      action: "loopback",
      from,
      to: loopback.to,
      reason: loopback.reason,
    };
  }

  if (isPhaseComplete(state, phase)) {
    state.phases[phase].status = "completed";
    state.phases[phase].completedAt = new Date().toISOString();

    const phaseIdx = PHASE_ORDER.indexOf(phase);
    const nextPhases = PHASE_ORDER.slice(phaseIdx + 1);
    let nextPhaseName: PhaseName | null = null;

    for (const np of nextPhases) {
      if (state.phases[np].status !== "skipped") {
        nextPhaseName = np;
        break;
      }
    }

    if (!nextPhaseName) {
      state.status = "completed";
      state.currentPhase = null;
      state.currentStep = null;
      writeState(root, state);
      archiveOnComplete(root, state);
      return { action: "complete", message: "All phases complete. Work-kit finished." };
    }

    const nextSteps = Object.entries(state.phases[nextPhaseName].steps);
    const firstPending = nextSteps.find(([_, s]) => s.status === "pending");
    if (firstPending) {
      firstPending[1].status = "waiting";
    }

    state.currentPhase = nextPhaseName;
    state.currentStep = firstPending ? firstPending[0] : null;
    writeState(root, state);

    return {
      action: "wait_for_user",
      message: `${phase} phase complete. Ready to start ${nextPhaseName}. Proceed?`,
    };
  }

  const next = nextStepInPhase(state, phase);
  state.currentStep = next ?? null;

  writeState(root, state);

  return {
    action: "wait_for_user",
    message: `${phase}/${step} complete${effectiveOutcome ? ` (outcome: ${effectiveOutcome})` : ""}. Run \`${CLI_BINARY} next\` to continue.`,
  };
}

/**
 * When triage/classify completes with a --classification flag, write the
 * classification into state and (for auto-kit sessions that started without
 * one) build the dynamic workflow now that we know the work type. Steps that
 * the workflow excludes get marked `skipped` so `next` can advance past them.
 */
function applyClassification(state: WorkKitState, classification: Classification): void {
  state.classification = classification;

  if (state.mode !== "auto-kit") return;
  if (state.workflow && state.workflow.length > 0) return; // already built at init

  const workflow = buildDefaultWorkflow(classification);
  state.workflow = workflow;

  // Sync phases to the new workflow: any step not flagged `included` becomes skipped.
  for (const ws of workflow) {
    const phaseState = state.phases[ws.phase];
    if (!phaseState) continue;
    const stepState = phaseState.steps[ws.step];
    if (!stepState) continue;
    if (stepState.status === "completed" || stepState.status === "in-progress") continue;
    stepState.status = ws.included ? "pending" : "skipped";
  }
  for (const phase of PHASE_ORDER) {
    const ps = state.phases[phase];
    if (!ps) continue;
    const allSkipped = Object.values(ps.steps).every((s) => s.status === "skipped");
    if (allSkipped && ps.status !== "completed") {
      ps.status = "skipped";
    }
  }
}

// ── Archive on completion ──────────────────────────────────────────

/**
 * Divert a step that reported `needs_debug` into the wk-debug skill. The
 * originating step stays in-progress so the next `next()` call retries it
 * after the debug agent finishes. Bails to `wait_for_user` once the per-step
 * iteration cap is reached.
 */
function handleNeedsDebug(root: string, state: WorkKitState, stepState: StepState, origin: Location): Action {
  const debugCount = state.loopbacks.filter(
    (lb) => lb.kind === "debug" && lb.from.phase === origin.phase && lb.from.step === origin.step,
  ).length;

  if (debugCount >= MAX_DEBUG_ITERATIONS) {
    writeState(root, state);
    return {
      action: "wait_for_user",
      message: `${origin.phase}/${origin.step} reported needs_debug but max debug iterations (${MAX_DEBUG_ITERATIONS}) reached. Surface to user — manual intervention required.`,
    };
  }

  const iteration = debugCount + 1;
  state.loopbacks.push({
    from: origin,
    to: origin,
    reason: `Step reported needs_debug — invoking wk-debug (iteration ${iteration})`,
    timestamp: new Date().toISOString(),
    kind: "debug",
  });
  stepState.status = "in-progress";
  delete stepState.outcome;
  delete stepState.completedAt;
  writeState(root, state);

  const agentPrompt = [
    `# Debug Triage`,
    ``,
    `**Origin:** ${origin.phase}/${origin.step}`,
    `**Iteration:** ${iteration} of ${MAX_DEBUG_ITERATIONS}`,
    `**Worktree:** ${root}`,
    ``,
    `## Instructions`,
    `Read and follow the skill file: \`${DEBUG_SKILL_FILE}\``,
    ``,
    `The originating step (${origin.phase}/${origin.step}) hit something it cannot resolve.`,
    `Read \`.work-kit/state.md\` and the originating agent's working notes for that step.`,
    ``,
    `Run the 5-step triage methodology. Write your full report to \`.work-kit/debug-<ISO-timestamp>.md\`.`,
    `Do NOT call \`work-kit complete\` for the originating step — when you finish, the orchestrator will re-run \`work-kit run\` and the originating step will retry automatically.`,
  ].join("\n");

  const debugModel = resolveModel(state, origin.phase, origin.step);

  return {
    action: "spawn_debug_agent",
    origin,
    iteration,
    skillFile: DEBUG_SKILL_FILE,
    agentPrompt,
    onComplete: `${CLI_BINARY} next`,
    ...(debugModel && { model: debugModel }),
  };
}

function archiveFolderName(slug: string, completedAt: string): string {
  return `${slug}-${completedAt.split("T")[0]}`;
}

/**
 * Single-step archive: copies state.md, tracker.json, and summary.md (if the
 * wrap-up step wrote one) into `<main>/.work-kit-tracker/archive/<slug>-<date>/`,
 * then appends a row to the index. Uses a single timestamp captured at the
 * moment of completion to avoid date drift across multiple archive calls.
 */
function archiveOnComplete(worktreeRoot: string, state: WorkKitState): void {
  const mainRoot = resolveMainRepoRoot(worktreeRoot);
  const slug = state.slug;
  const completedAt = new Date().toISOString();
  const date = completedAt.split("T")[0];

  const wkDir = path.join(mainRoot, TRACKER_DIR);
  const folderName = archiveFolderName(slug, completedAt);
  const archiveDir = path.join(wkDir, ARCHIVE_DIR, folderName);

  fs.mkdirSync(archiveDir, { recursive: true });

  const stateMd = readStateMd(worktreeRoot);
  if (stateMd) {
    fs.writeFileSync(path.join(archiveDir, STATE_MD_FILE), stateMd, "utf-8");
  }

  const trackerSrc = statePath(worktreeRoot);
  fs.copyFileSync(trackerSrc, path.join(archiveDir, STATE_FILE));

  const summarySrc = path.join(path.dirname(stateMdPath(worktreeRoot)), SUMMARY_FILE);
  const summaryDest = path.join(archiveDir, SUMMARY_FILE);
  const completedPhases = PHASE_ORDER.filter((p) => state.phases[p].status === "completed").join("→");

  if (fs.existsSync(summarySrc)) {
    fs.copyFileSync(summarySrc, summaryDest);
  } else {
    // Placeholder summary if the wrap-up agent didn't write one
    fs.writeFileSync(
      summaryDest,
      `---\nslug: ${slug}\nbranch: ${state.branch}\nstarted: ${state.started.split("T")[0]}\ncompleted: ${date}\nstatus: completed\n---\n\n## Summary\n\nPhases: ${completedPhases}\n\n_Pending wrap-up summary._\n`,
      "utf-8",
    );
  }

  const indexPath = path.join(wkDir, INDEX_FILE);
  let indexContent = "";
  if (fs.existsSync(indexPath)) {
    indexContent = fs.readFileSync(indexPath, "utf-8");
  }
  if (!indexContent.includes("| Date ")) {
    indexContent =
      "| Date | Slug | PR | Status | Phases | Summary | Archive |\n| --- | --- | --- | --- | --- | --- | --- |\n";
  }
  const summaryLink = `[summary](${ARCHIVE_DIR}/${folderName}/${SUMMARY_FILE})`;
  const archiveLink = `[archive](${ARCHIVE_DIR}/${folderName}/)`;
  indexContent += `| ${date} | ${slug} | n/a | completed | ${completedPhases} | ${summaryLink} | ${archiveLink} |\n`;
  fs.writeFileSync(indexPath, indexContent, "utf-8");
}
