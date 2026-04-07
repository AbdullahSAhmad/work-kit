import * as fs from "node:fs";
import * as path from "node:path";
import { readState, writeState, findWorktreeRoot, readStateMd, statePath, resolveMainRepoRoot, clearBlockingMarkers, STATE_MD_FILE, STATE_FILE } from "../state/store.js";
import { isPhaseComplete, nextStepInPhase } from "../workflow/transitions.js";
import { checkLoopback, countLoopbacksForRoute } from "../workflow/loopbacks.js";
import { PHASE_ORDER } from "../config/workflow.js";
import { parseLocation, resetToLocation } from "../state/helpers.js";
import { TRACKER_DIR, ARCHIVE_DIR, INDEX_FILE, SUMMARY_FILE, MAX_LOOPBACKS_PER_ROUTE, CLI_BINARY } from "../config/constants.js";
import { isStepOutcome, STEP_OUTCOMES, type Action, type PhaseName, type StepOutcome, type WorkKitState } from "../state/schema.js";
import { stateMdPath } from "../state/store.js";

export function completeCommand(target: string, outcome?: string, worktreeRoot?: string): Action {
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
    return { action: "error", message: `${phase}/${step} is skipped and cannot be completed. Add it to the workflow first.` };
  }

  stepState.status = "completed";
  stepState.completedAt = new Date().toISOString();
  if (typedOutcome) {
    stepState.outcome = typedOutcome;
  }

  const loopback = checkLoopback(phase, step, typedOutcome);
  if (loopback) {
    const from = { phase, step };
    const sameRouteCount = countLoopbacksForRoute(state.loopbacks, from, loopback.to);

    if (sameRouteCount >= MAX_LOOPBACKS_PER_ROUTE) {
      writeState(root, state);
      return {
        action: "wait_for_user",
        message: `${phase}/${step} triggered loopback (outcome: ${typedOutcome}) but max loopback count (${MAX_LOOPBACKS_PER_ROUTE}) reached for this route. Proceeding with noted caveats.`,
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
    message: `${phase}/${step} complete${typedOutcome ? ` (outcome: ${typedOutcome})` : ""}. Run \`${CLI_BINARY} next\` to continue.`,
  };
}

// ── Archive on completion ──────────────────────────────────────────

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
  if (fs.existsSync(trackerSrc)) {
    fs.copyFileSync(trackerSrc, path.join(archiveDir, STATE_FILE));
  }

  const summarySrc = path.join(path.dirname(stateMdPath(worktreeRoot)), SUMMARY_FILE);
  const summaryDest = path.join(archiveDir, SUMMARY_FILE);
  const completedPhases = PHASE_ORDER
    .filter(p => state.phases[p].status === "completed")
    .join("→");

  if (fs.existsSync(summarySrc)) {
    fs.copyFileSync(summarySrc, summaryDest);
  } else {
    // Placeholder summary if the wrap-up agent didn't write one
    fs.writeFileSync(
      summaryDest,
      `---\nslug: ${slug}\nbranch: ${state.branch}\nstarted: ${state.started.split("T")[0]}\ncompleted: ${date}\nstatus: completed\n---\n\n## Summary\n\nPhases: ${completedPhases}\n\n_Pending wrap-up summary._\n`,
      "utf-8"
    );
  }

  const indexPath = path.join(wkDir, INDEX_FILE);
  let indexContent = "";
  if (fs.existsSync(indexPath)) {
    indexContent = fs.readFileSync(indexPath, "utf-8");
  }
  if (!indexContent.includes("| Date ")) {
    indexContent = "| Date | Slug | PR | Status | Phases | Summary | Archive |\n| --- | --- | --- | --- | --- | --- | --- |\n";
  }
  const summaryLink = `[summary](${ARCHIVE_DIR}/${folderName}/${SUMMARY_FILE})`;
  const archiveLink = `[archive](${ARCHIVE_DIR}/${folderName}/)`;
  indexContent += `| ${date} | ${slug} | n/a | completed | ${completedPhases} | ${summaryLink} | ${archiveLink} |\n`;
  fs.writeFileSync(indexPath, indexContent, "utf-8");
}
