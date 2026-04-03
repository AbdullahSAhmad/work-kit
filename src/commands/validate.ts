import { readState, findWorktreeRoot } from "../state/store.js";
import { validatePhasePrerequisites } from "../state/validators.js";
import type { PhaseName } from "../state/schema.js";

interface ValidateResult {
  phase: PhaseName;
  valid: boolean;
  message: string;
  missingPrerequisite?: PhaseName;
  phaseStatus: string;
}

export function validateCommand(phase: PhaseName, worktreeRoot?: string): ValidateResult {
  const root = worktreeRoot || findWorktreeRoot();
  if (!root) {
    throw new Error("No work-kit state found. Run `work-kit init` first.");
  }

  const state = readState(root);

  if (!state.phases[phase]) {
    throw new Error(`Unknown phase: ${phase}`);
  }

  const result = validatePhasePrerequisites(state, phase);

  return {
    phase,
    valid: result.valid,
    message: result.message,
    missingPrerequisite: result.missingPrerequisite,
    phaseStatus: state.phases[phase].status,
  };
}
