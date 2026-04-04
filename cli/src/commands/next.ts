import { readState, writeState, findWorktreeRoot, readStateMd } from "../state/store.js";
import { determineNextStep } from "../engine/transitions.js";
import { validatePhasePrerequisites } from "../state/validators.js";
import { buildAgentPrompt } from "../context/prompt-builder.js";
import { getParallelGroup } from "../engine/parallel.js";
import { skillFilePath } from "../config/phases.js";
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

  const step = determineNextStep(state);

  switch (step.type) {
    case "complete":
      return { action: "complete", message: step.message! };

    case "wait-for-user":
      return { action: "wait_for_user", message: step.message! };

    case "phase-boundary": {
      const phase = step.phase!;

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

      const subStages = Object.entries(state.phases[phase].subStages);
      const firstActive = subStages.find(([_, ss]) => ss.status === "pending");

      if (!firstActive) {
        return { action: "error", message: `No pending sub-stages in ${phase}` };
      }

      const [subStage] = firstActive;
      state.currentSubStage = subStage;
      state.phases[phase].subStages[subStage].status = "in-progress";
      state.phases[phase].subStages[subStage].startedAt = new Date().toISOString();
      writeState(root, state);

      return buildSpawnAction(root, state, phase, subStage);
    }

    case "sub-stage": {
      const phase = step.phase!;
      const subStage = step.subStage!;

      state.currentPhase = phase;
      state.currentSubStage = subStage;
      if (state.phases[phase].status === "pending") {
        state.phases[phase].status = "in-progress";
        state.phases[phase].startedAt = new Date().toISOString();
      }
      state.phases[phase].subStages[subStage].status = "in-progress";
      state.phases[phase].subStages[subStage].startedAt = new Date().toISOString();
      writeState(root, state);

      return buildSpawnAction(root, state, phase, subStage);
    }

    default:
      return { action: "error", message: `Unknown step type: ${step.type}` };
  }
}

function buildSpawnAction(root: string, state: WorkKitState, phase: PhaseName, subStage: string): Action {
  // Read state.md once for all prompt builds
  const stateMd = readStateMd(root);
  const parallelGroup = getParallelGroup(phase, subStage, state);

  if (parallelGroup) {
    const agents = parallelGroup.parallel
      .filter((ss) => {
        const ssState = state.phases[phase].subStages[ss];
        return ssState && ssState.status !== "skipped" && ssState.status !== "completed";
      })
      .map((ss) => ({
        phase,
        subStage: ss,
        skillFile: skillFilePath(phase, ss),
        agentPrompt: buildAgentPrompt(root, state, phase, ss, stateMd),
        outputFile: `.work-kit/${phase}-${ss}.md`,
      }));

    // If all parallel members were filtered out, fall through to single agent
    if (agents.length === 0) {
      // Skip to thenSequential if it exists, otherwise nothing to do
      if (parallelGroup.thenSequential) {
        const seqSS = parallelGroup.thenSequential;
        return {
          action: "spawn_agent",
          phase,
          subStage: seqSS,
          skillFile: skillFilePath(phase, seqSS),
          agentPrompt: buildAgentPrompt(root, state, phase, seqSS, stateMd),
          onComplete: `npx work-kit complete ${phase}/${seqSS}`,
        };
      }
      return { action: "error", message: `No active sub-stages in parallel group for ${phase}` };
    }

    // If only 1 agent remains, run as single agent (no need for parallel)
    if (agents.length === 1 && !parallelGroup.thenSequential) {
      const agent = agents[0];
      return {
        action: "spawn_agent",
        phase: agent.phase,
        subStage: agent.subStage,
        skillFile: agent.skillFile,
        agentPrompt: agent.agentPrompt,
        onComplete: `npx work-kit complete ${agent.phase}/${agent.subStage}`,
      };
    }

    for (const agent of agents) {
      state.phases[phase].subStages[agent.subStage].status = "in-progress";
      state.phases[phase].subStages[agent.subStage].startedAt = new Date().toISOString();
    }

    const thenSequential = parallelGroup.thenSequential
      ? {
          phase,
          subStage: parallelGroup.thenSequential,
          skillFile: skillFilePath(phase, parallelGroup.thenSequential),
          agentPrompt: buildAgentPrompt(root, state, phase, parallelGroup.thenSequential, stateMd),
        }
      : undefined;

    writeState(root, state);

    return {
      action: "spawn_parallel_agents",
      agents,
      thenSequential,
      onComplete: `npx work-kit complete ${phase}/${parallelGroup.thenSequential || parallelGroup.parallel[parallelGroup.parallel.length - 1]}`,
    };
  }

  const skill = skillFilePath(phase, subStage);
  const prompt = buildAgentPrompt(root, state, phase, subStage, stateMd);

  return {
    action: "spawn_agent",
    phase,
    subStage,
    skillFile: skill,
    agentPrompt: prompt,
    onComplete: `npx work-kit complete ${phase}/${subStage}`,
  };
}
