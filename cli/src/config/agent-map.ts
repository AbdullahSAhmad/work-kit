import { PhaseName } from "../state/schema.js";

/**
 * Maps each phase/step to the sections it needs from state.md.
 * "##" prefix = top-level section, "###" prefix = Final section.
 */

export interface AgentContext {
  sections: string[]; // sections to extract from state.md
  needsGitDiff?: boolean; // whether the agent needs `git diff main...HEAD`
}

// Phase-level context (what the phase runner agent reads)
export const PHASE_CONTEXT: Record<PhaseName, AgentContext> = {
  triage: {
    sections: ["## Description"],
  },
  plan: {
    sections: ["## Description", "### Triage: Final", "## Criteria"],
  },
  build: {
    sections: ["### Plan: Final", "## Criteria", "## Description"],
  },
  test: {
    sections: ["### Build: Final", "### Plan: Final", "## Criteria"],
  },
  review: {
    sections: ["### Plan: Final", "### Build: Final", "### Test: Final", "## Criteria"],
  },
  deploy: {
    sections: ["### Review: Final", "### Build: Final", "## Criteria"],
  },
  "wrap-up": {
    sections: [], // reads full state.md
  },
};

// Step-level context (for parallel sub-agents that need specific sections)
export const STEP_CONTEXT: Record<string, AgentContext> = {
  // Triage steps
  "triage/classify": { sections: ["## Description"] },

  // Test steps — test/exercise is the Conductor: it reads Build/Plan context
  // and uses the Agent tool to fan out 3 parallel lens sub-agents (Verify,
  // E2E, Browser). Validate aggregates the lens outputs against criteria and
  // produces the Test: Final verdict.
  "test/exercise": {
    sections: ["### Build: Final", "### Plan: Final", "### Plan: UX Flow", "## Criteria"],
  },
  "test/validate": {
    sections: ["### Test: Verify", "### Test: E2E", "### Test: Browser", "## Criteria"],
  },

  // Review steps — review/review is the Conductor: it reads scope + all
  // upstream context and uses Agent tool to fan out 4 parallel reviewer
  // sub-agents (Quality, Efficiency, Security, Compliance). Resolve reads
  // every lens output plus test status to fix and decide ship/no-ship.
  "review/scope": { sections: ["### Plan: Final", "### Build: Final"], needsGitDiff: true },
  "review/review": {
    sections: ["### Plan: Final", "### Build: Final", "### Review: Scope", "## Criteria"],
    needsGitDiff: true,
  },
  "review/resolve": {
    sections: [
      "### Review: Scope",
      "### Review: Roundup",
      "### Review: Quality",
      "### Review: Efficiency",
      "### Review: Security",
      "### Review: Compliance",
      "### Test: Final",
      "## Criteria",
    ],
    needsGitDiff: true,
  },
};

export function getContextFor(phase: PhaseName, step?: string): AgentContext {
  if (step) {
    const key = `${phase}/${step}`;
    if (STEP_CONTEXT[key]) return STEP_CONTEXT[key];
  }
  return PHASE_CONTEXT[phase];
}
