import { readState, writeState, findWorktreeRoot, readStateMd } from "../state/store.js";
import { determineNextStep } from "../workflow/transitions.js";
import { validatePhasePrerequisites } from "../state/validators.js";
import { buildAgentPrompt } from "../context/prompt-builder.js";
import { getParallelGroup } from "../workflow/parallel.js";
import { skillFilePath } from "../config/workflow.js";
import { CLI_BINARY } from "../config/constants.js";

import type { Action, PhaseName, WorkKitState } from "../state/schema.js";

export function nextCommand(worktreeRoot?: string): Action {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    return { action: "error", message: "No work-kit state found. Run `work-kit init` first." };
  }

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
      .map((s) => ({
        phase,
        step: s,
        skillFile: skillFilePath(phase, s),
        agentPrompt: buildAgentPrompt(root, state, phase, s, stateMd),
        outputFile: `.work-kit/${phase}-${s}.md`,
      }));

    // If all parallel members were filtered out, fall through to single agent
    if (agents.length === 0) {
      // Skip to thenSequential if it exists, otherwise nothing to do
      if (parallelGroup.thenSequential) {
        const seqStep = parallelGroup.thenSequential;
        return {
          action: "spawn_agent",
          phase,
          step: seqStep,
          skillFile: skillFilePath(phase, seqStep),
          agentPrompt: buildAgentPrompt(root, state, phase, seqStep, stateMd),
          onComplete: `${CLI_BINARY} complete ${phase}/${seqStep}`,
        };
      }
      return { action: "error", message: `No active steps in parallel group for ${phase}` };
    }

    // If only 1 agent remains, run as single agent (no need for parallel)
    if (agents.length === 1 && !parallelGroup.thenSequential) {
      const agent = agents[0];
      return {
        action: "spawn_agent",
        phase: agent.phase,
        step: agent.step,
        skillFile: agent.skillFile,
        agentPrompt: agent.agentPrompt,
        onComplete: `${CLI_BINARY} complete ${agent.phase}/${agent.step}`,
      };
    }

    for (const agent of agents) {
      state.phases[phase].steps[agent.step].status = "in-progress";
      state.phases[phase].steps[agent.step].startedAt = new Date().toISOString();
    }

    const thenSequential = parallelGroup.thenSequential
      ? {
          phase,
          step: parallelGroup.thenSequential,
          skillFile: skillFilePath(phase, parallelGroup.thenSequential),
          agentPrompt: buildAgentPrompt(root, state, phase, parallelGroup.thenSequential, stateMd),
        }
      : undefined;

    writeState(root, state);

    return {
      action: "spawn_parallel_agents",
      agents,
      thenSequential,
      onComplete: `${CLI_BINARY} complete ${phase}/${parallelGroup.thenSequential || parallelGroup.parallel[parallelGroup.parallel.length - 1]}`,
    };
  }

  const skill = skillFilePath(phase, step);
  const prompt = buildAgentPrompt(root, state, phase, step, stateMd);

  return {
    action: "spawn_agent",
    phase,
    step,
    skillFile: skill,
    agentPrompt: prompt,
    onComplete: `${CLI_BINARY} complete ${phase}/${step}`,
  };
}
