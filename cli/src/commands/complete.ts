import * as fs from "node:fs";
import * as path from "node:path";
import { readState, writeState, findWorktreeRoot, readStateMd } from "../state/store.js";
import { isPhaseComplete } from "../engine/transitions.js";
import { checkLoopback } from "../engine/loopbacks.js";
import { PHASE_ORDER } from "../config/phases.js";
import { parseLocation, resetToLocation } from "../state/helpers.js";
import type { Action, PhaseName, WorkKitState } from "../state/schema.js";

export function completeCommand(target: string, outcome?: string, worktreeRoot?: string): Action {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found. Run `work-kit init` first." };
  }

  const state = readState(root);
  const { phase, subStage } = parseLocation(target);

  // Validate phase exists
  if (!state.phases[phase]) {
    return { action: "error", message: `Unknown phase: ${phase}` };
  }

  // Validate sub-stage exists
  const ssState = state.phases[phase].subStages[subStage];
  if (!ssState) {
    return { action: "error", message: `Unknown sub-stage: ${phase}/${subStage}` };
  }

  // Validate sub-stage is in a completable state
  if (ssState.status === "completed") {
    return { action: "error", message: `${phase}/${subStage} is already completed.` };
  }
  if (ssState.status === "skipped") {
    return { action: "error", message: `${phase}/${subStage} is skipped and cannot be completed. Add it to the workflow first.` };
  }

  // Mark sub-stage complete
  ssState.status = "completed";
  ssState.completedAt = new Date().toISOString();
  if (outcome) {
    ssState.outcome = outcome;
  }

  // Check for loop-back triggers
  const loopback = checkLoopback(phase, subStage, outcome);
  if (loopback) {
    // Enforce max 2 loopbacks per route
    const sameRouteCount = state.loopbacks.filter(
      (lb) => lb.from.phase === phase && lb.from.subStage === subStage
        && lb.to.phase === loopback.to.phase && lb.to.subStage === loopback.to.subStage
    ).length;

    if (sameRouteCount >= 2) {
      // Max reached — proceed without looping back, note the caveat
      writeState(root, state);
      return {
        action: "wait_for_user",
        message: `${phase}/${subStage} triggered loopback (outcome: ${outcome}) but max loopback count (2) reached for this route. Proceeding with noted caveats.`,
      };
    }

    state.loopbacks.push({
      from: { phase, subStage },
      to: loopback.to,
      reason: loopback.reason,
      timestamp: new Date().toISOString(),
    });

    resetToLocation(state, loopback.to);
    state.currentPhase = loopback.to.phase;
    state.currentSubStage = loopback.to.subStage;

    writeState(root, state);

    return {
      action: "loopback",
      from: { phase, subStage },
      to: loopback.to,
      reason: loopback.reason,
    };
  }

  // Check if the phase is now complete
  if (isPhaseComplete(state, phase)) {
    state.phases[phase].status = "completed";
    state.phases[phase].completedAt = new Date().toISOString();

    // Find next phase
    const phaseIdx = PHASE_ORDER.indexOf(phase);
    const nextPhases = PHASE_ORDER.slice(phaseIdx + 1);
    let nextPhase: PhaseName | null = null;

    for (const np of nextPhases) {
      if (state.phases[np].status !== "skipped") {
        nextPhase = np;
        break;
      }
    }

    if (!nextPhase) {
      state.status = "completed";
      state.currentPhase = null;
      state.currentSubStage = null;
      writeState(root, state);
      archiveCompleted(root, state);
      return { action: "complete", message: "All phases complete. Work-kit finished." };
    }

    state.currentPhase = null;
    state.currentSubStage = null;
    writeState(root, state);

    return {
      action: "wait_for_user",
      message: `${phase} phase complete. Ready to start ${nextPhase}. Proceed?`,
    };
  }

  writeState(root, state);

  return {
    action: "wait_for_user",
    message: `${phase}/${subStage} complete${outcome ? ` (outcome: ${outcome})` : ""}. Run \`npx work-kit next\` to continue.`,
  };
}

// ── Archive on completion ──────────────────────────────────────────

function archiveCompleted(worktreeRoot: string, state: WorkKitState): void {
  const mainRoot = state.metadata.mainRepoRoot || worktreeRoot;
  const date = new Date().toISOString().split("T")[0];
  const slug = state.slug;
  const wkDir = path.join(mainRoot, ".claude", "work-kit");
  const archiveDir = path.join(wkDir, "archive");

  // Ensure directories exist
  fs.mkdirSync(archiveDir, { recursive: true });

  // Archive state.md
  const stateMd = readStateMd(worktreeRoot);
  if (stateMd) {
    const archivePath = path.join(archiveDir, `${date}-${slug}.md`);
    fs.writeFileSync(archivePath, stateMd, "utf-8");
  }

  // Compute completed phases
  const completedPhases = PHASE_ORDER
    .filter(p => state.phases[p].status === "completed")
    .join("→");

  // Append to index.md
  const indexPath = path.join(wkDir, "index.md");
  let indexContent = "";
  if (fs.existsSync(indexPath)) {
    indexContent = fs.readFileSync(indexPath, "utf-8");
  }
  if (!indexContent.includes("| Date ")) {
    indexContent = "| Date | Slug | PR | Status | Phases |\n| --- | --- | --- | --- | --- |\n";
  }
  indexContent += `| ${date} | ${slug} | n/a | completed | ${completedPhases} |\n`;
  fs.writeFileSync(indexPath, indexContent, "utf-8");
}
