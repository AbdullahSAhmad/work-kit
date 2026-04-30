import { CLI_BINARY } from "../config/constants.js";
import { resolveModel } from "../config/model-routing.js";
import { skillFilePath } from "../config/workflow.js";
import { buildAgentPrompt } from "../context/prompt-builder.js";
import { receiptPathIfApplicable } from "../receipts/store.js";
import type { Action, PhaseName, WorkKitState } from "../state/schema.js";
import { clearBlockingMarkers, findWorktreeRoot, readState, readStateMd, writeState } from "../state/store.js";
import { validatePhasePrerequisites } from "../state/validators.js";
import { getParallelGroup } from "../workflow/parallel.js";
import { determineNextStep } from "../workflow/transitions.js";

export function nextCommand(worktreeRoot?: string): Action {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found. Run `work-kit init` first." };
  }

  // Forward state transition → clear any stale "blocked on user" markers
  clearBlockingMarkers(root);

  const state = readState(root);

  if (state.status === "completed") {
    return { action: "complete", message: "Work-kit is already complete." };
  }

  if (state.status === "failed") {
    return { action: "error", message: "Work-kit is in failed state.", suggestion: "Review the state and restart." };
  }

  if (state.status === "paused") {
    return {
      action: "error",
      message: `Work-kit is paused (since ${state.pausedAt ?? "earlier"}).`,
      suggestion: `Run \`${CLI_BINARY} resume\` to continue.`,
    };
  }

  const nextStep = determineNextStep(state);

  switch (nextStep.type) {
    case "complete":
      return { action: "complete", message: nextStep.message! };

    case "wait-for-user":
      return { action: "wait_for_user", message: nextStep.message! };

    case "phase-boundary": {
      const phase = nextStep.phase!;

      const validation = validatePhasePrerequisites(state, phase);
      if (!validation.valid) {
        return {
          action: "error",
          message: validation.message,
          suggestion: `Complete ${validation.missingPrerequisite} first.`,
        };
      }

      state.currentPhase = phase;
      state.phases[phase].status = "in-progress";
      state.phases[phase].startedAt = new Date().toISOString();

      const entries = Object.entries(state.phases[phase].steps);
      const firstActive = entries.find(([_, s]) => s.status === "pending" || s.status === "waiting");

      if (!firstActive) {
        return { action: "error", message: `No pending steps in ${phase}` };
      }

      const [step] = firstActive;
      state.currentStep = step;
      state.phases[phase].steps[step].status = "in-progress";
      state.phases[phase].steps[step].startedAt = new Date().toISOString();
      writeState(root, state);

      return buildSpawnAction(root, state, phase, step);
    }

    case "step": {
      const phase = nextStep.phase!;
      const step = nextStep.step!;

      state.currentPhase = phase;
      state.currentStep = step;
      if (state.phases[phase].status === "pending") {
        state.phases[phase].status = "in-progress";
        state.phases[phase].startedAt = new Date().toISOString();
      }
      state.phases[phase].steps[step].status = "in-progress";
      state.phases[phase].steps[step].startedAt = new Date().toISOString();
      writeState(root, state);

      return buildSpawnAction(root, state, phase, step);
    }

    default:
      return { action: "error", message: `Unknown step type: ${nextStep.type}` };
  }
}

function buildSpawnAction(root: string, state: WorkKitState, phase: PhaseName, step: string): Action {
  // Read state.md once for all prompt builds
  const stateMd = readStateMd(root);
  const parallelGroup = getParallelGroup(phase, step, state);

  if (parallelGroup) {
    const agents = parallelGroup.parallel
      .filter((s) => {
        const sState = state.phases[phase].steps[s];
        return sState && sState.status !== "skipped" && sState.status !== "completed";
      })
      .map((s) => {
        const rp = receiptPathIfApplicable(phase, s);
        return withModel(
          {
            phase,
            step: s,
            skillFile: skillFilePath(phase, s),
            agentPrompt: buildAgentPrompt(root, state, phase, s, stateMd),
            ...(rp && { receiptPath: rp }),
          },
          state,
        );
      });

    // If all parallel members were filtered out, skip to thenSequential or error
    if (agents.length === 0) {
      if (parallelGroup.thenSequential) {
        return spawnSingleAgent(root, state, phase, parallelGroup.thenSequential, stateMd);
      }
      return { action: "error", message: `No active steps in parallel group for ${phase}` };
    }

    // If only 1 agent remains, run as single agent (no need for parallel overhead)
    if (agents.length === 1 && !parallelGroup.thenSequential) {
      return spawnSingleAgent(root, state, agents[0].phase, agents[0].step, stateMd);
    }

    for (const agent of agents) {
      state.phases[phase].steps[agent.step].status = "in-progress";
      state.phases[phase].steps[agent.step].startedAt = new Date().toISOString();
    }

    const thenSequential = parallelGroup.thenSequential
      ? (() => {
          const seq = parallelGroup.thenSequential!;
          const rp = receiptPathIfApplicable(phase, seq);
          return withModel(
            {
              phase,
              step: seq,
              skillFile: skillFilePath(phase, seq),
              agentPrompt: buildAgentPrompt(root, state, phase, seq, stateMd),
              ...(rp && { receiptPath: rp }),
            },
            state,
          );
        })()
      : undefined;

    writeState(root, state);

    return {
      action: "spawn_parallel_agents",
      agents,
      thenSequential,
      onComplete: `${CLI_BINARY} complete ${phase}/${parallelGroup.thenSequential || parallelGroup.parallel[parallelGroup.parallel.length - 1]}`,
    };
  }

  return spawnSingleAgent(root, state, phase, step, stateMd);
}

function spawnSingleAgent(
  root: string,
  state: WorkKitState,
  phase: PhaseName,
  step: string,
  stateMd: string | null,
): Extract<Action, { action: "spawn_agent" }> {
  const rp = receiptPathIfApplicable(phase, step);
  return withModelAction(
    {
      action: "spawn_agent",
      phase,
      step,
      skillFile: skillFilePath(phase, step),
      agentPrompt: buildAgentPrompt(root, state, phase, step, stateMd),
      onComplete: `${CLI_BINARY} complete ${phase}/${step}`,
      ...(rp && { receiptPath: rp }),
    },
    state,
  );
}

/**
 * Attach the resolved model tier to an AgentSpec. Omits the field entirely
 * when resolveModel returns undefined (policy "inherit" or hard-default miss),
 * keeping the action JSON compatible with skills that haven't yet been updated
 * to forward a model parameter.
 */
function withModel<T extends { phase: PhaseName; step: string }>(
  spec: T,
  state: WorkKitState,
): T & { model?: ReturnType<typeof resolveModel> } {
  const model = resolveModel(state, spec.phase, spec.step);
  return model ? { ...spec, model } : spec;
}

function withModelAction(
  action: Extract<Action, { action: "spawn_agent" }>,
  state: WorkKitState,
): Extract<Action, { action: "spawn_agent" }> {
  const model = resolveModel(state, action.phase, action.step);
  return model ? { ...action, model } : action;
}
