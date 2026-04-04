import { readState, writeState, findWorktreeRoot } from "../state/store.js";
import { parseLocation, resetToLocation } from "../state/helpers.js";
import type { Action } from "../state/schema.js";

const MAX_LOOPBACKS_PER_ROUTE = 2;

export function loopbackCommand(opts: {
  from: string;
  to: string;
  reason: string;
  worktreeRoot?: string;
}): Action {
  const root = opts.worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found." };
  }

  const state = readState(root);
  const from = parseLocation(opts.from);
  const to = parseLocation(opts.to);

  if (!state.phases[from.phase]?.subStages[from.subStage]) {
    return { action: "error", message: `Invalid source: ${opts.from}` };
  }
  if (!state.phases[to.phase]?.subStages[to.subStage]) {
    return { action: "error", message: `Invalid target: ${opts.to}` };
  }

  // Can't loop back to a skipped sub-stage
  if (state.phases[to.phase].subStages[to.subStage].status === "skipped") {
    return { action: "error", message: `Cannot loop back to ${opts.to} — it is skipped.` };
  }

  // Enforce max loopback count per route
  const sameRouteCount = state.loopbacks.filter(
    (lb) => lb.from.phase === from.phase && lb.from.subStage === from.subStage
      && lb.to.phase === to.phase && lb.to.subStage === to.subStage
  ).length;
  if (sameRouteCount >= MAX_LOOPBACKS_PER_ROUTE) {
    return {
      action: "error",
      message: `Max loopback count (${MAX_LOOPBACKS_PER_ROUTE}) reached for ${opts.from} → ${opts.to}. Proceeding with noted caveats.`,
    };
  }

  state.loopbacks.push({
    from,
    to,
    reason: opts.reason,
    timestamp: new Date().toISOString(),
  });

  resetToLocation(state, to);
  state.currentPhase = to.phase;
  state.currentSubStage = to.subStage;
  writeState(root, state);

  return {
    action: "loopback",
    from,
    to,
    reason: opts.reason,
  };
}
