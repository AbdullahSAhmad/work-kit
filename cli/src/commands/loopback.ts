import { readState, writeState, findWorktreeRoot } from "../state/store.js";
import { parseLocation, resetToLocation } from "../state/helpers.js";
import { countLoopbacksForRoute } from "../workflow/loopbacks.js";
import { MAX_LOOPBACKS_PER_ROUTE } from "../config/constants.js";
import type { Action } from "../state/schema.js";

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

  if (!state.phases[from.phase]?.steps[from.step]) {
    return { action: "error", message: `Invalid source: ${opts.from}` };
  }
  if (!state.phases[to.phase]?.steps[to.step]) {
    return { action: "error", message: `Invalid target: ${opts.to}` };
  }

  // Can't loop back to a skipped step
  if (state.phases[to.phase].steps[to.step].status === "skipped") {
    return { action: "error", message: `Cannot loop back to ${opts.to} — it is skipped.` };
  }

  // Enforce max loopback count per route
  const sameRouteCount = countLoopbacksForRoute(state.loopbacks, from, to);
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
  state.currentStep = to.step;
  writeState(root, state);

  return {
    action: "loopback",
    from,
    to,
    reason: opts.reason,
  };
}
