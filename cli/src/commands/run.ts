/**
 * `work-kit run` is the skinny driver that the orchestrator skill loops on.
 *
 * Without flags: equivalent to `next`, with an `after` field telling the
 * orchestrator the exact bash command to run when the spawned agent finishes.
 *
 * With `--finished <phase>/<step>`: equivalent to `complete` (which derives
 * the outcome from the receipt) followed by `next`, returned as a single
 * augmented action.
 *
 * The orchestrator's loop becomes:
 *   1. Run `work-kit run` (or `--finished <step>` after an agent returns).
 *   2. Do whatever the action says (spawn agent, wait, etc.).
 *   3. Run the bash in `after`.
 *   4. Goto 1.
 */

import { findWorktreeRoot, readState } from "../state/store.js";
import { nextCommand } from "./next.js";
import { completeCommand } from "./complete.js";
import { CLI_BINARY } from "../config/constants.js";

import type { Action } from "../state/schema.js";

export type RunAction = Action & { after?: string };

export function runCommand(opts: { finished?: string; worktreeRoot?: string }): RunAction {
  const root = opts.worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found. Run `work-kit init` first." };
  }

  // Step 1: complete the previous step if one was just finished.
  if (opts.finished) {
    const completeResult = completeCommand(opts.finished, undefined, root);

    // Hard errors: surface and stop. The orchestrator will surface to the user.
    if (completeResult.action === "error") {
      return completeResult;
    }

    // wait_for_user from complete fires for two cases:
    //   1. Phase-boundary stop (always emitted, even when not gated).
    //   2. Max-loopback exhausted (informational; "proceeding with caveats").
    //
    // For non-gated sessions we auto-fall-through to next() so the orchestrator
    // gets the next concrete imperative in one round trip. Gated sessions get
    // the wait surfaced so the user can confirm.
    if (completeResult.action === "wait_for_user") {
      const state = readState(root);
      if (state.gated) {
        return { ...completeResult, after: `${CLI_BINARY} run` };
      }
      // Auto-proceed: fall through to next() below.
    }

    // Debug spawn fired from complete: a step reported needs_debug and the
    // engine wants the wk-debug skill to run. The orchestrator spawns it, then
    // the originating step retries via plain `work-kit run`.
    if (completeResult.action === "spawn_debug_agent") {
      return { ...completeResult, after: `${CLI_BINARY} run` };
    }

    // Loopback: tracker.json now records the loopback. Fall through to next()
    // so the orchestrator gets the spawn at the loopback target directly.

    // `complete` (whole work-kit done) falls through to next() which returns
    // the same `complete` action.
  }

  const next = nextCommand(root);
  return augmentWithAfter(next);
}

function augmentWithAfter(action: Action): RunAction {
  switch (action.action) {
    case "spawn_agent":
      return { ...action, after: `${CLI_BINARY} run --finished ${action.phase}/${action.step}` };

    case "spawn_parallel_agents": {
      // After every parallel agent + the optional thenSequential have run, the
      // orchestrator marks the last step as finished. Pick the right step to
      // signal completion of the whole group.
      const last = action.thenSequential
        ? action.thenSequential
        : action.agents[action.agents.length - 1];
      return { ...action, after: `${CLI_BINARY} run --finished ${last.phase}/${last.step}` };
    }

    case "spawn_debug_agent":
      // Debug doesn't take --finished — the originating step retries via plain run.
      return { ...action, after: `${CLI_BINARY} run` };

    case "wait_for_user":
      return { ...action, after: `${CLI_BINARY} run` };

    case "loopback":
      return { ...action, after: `${CLI_BINARY} run` };

    case "complete":
    case "error":
    case "paused":
    case "resumed":
    case "select_session":
      return action;
  }
}
