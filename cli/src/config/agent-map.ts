import { PhaseName } from "../state/schema.js";

/**
 * Maps each phase/step to the sections it needs from state.md.
 * "##" prefix = top-level section, "###" prefix = Final section.
 */

export interface AgentContext {
  sections: string[];         // sections to extract from state.md
  needsGitDiff?: boolean;     // whether the agent needs `git diff main...HEAD`
}

// Phase-level context (what the phase runner agent reads)
export const PHASE_CONTEXT: Record<PhaseName, AgentContext> = {
  define: {
    sections: ["## Description"],
  },
  plan: {
    sections: ["## Description", "### Define: Final", "## Criteria"],
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
  // Define steps
  "define/refine": { sections: ["## Description"] },
  "define/spec": { sections: ["## Description", "### Define: Refine"] },

  // Test steps
  "test/verify": { sections: ["### Build: Final", "## Criteria"] },
  "test/browser": { sections: ["### Build: Final", "## Criteria", "### Plan: UX Flow"] },
  "test/e2e": { sections: ["### Build: Final", "### Plan: Final"] },
  "test/validate": { sections: ["### Test: Verify", "### Test: Browser", "### Test: E2E", "## Criteria"] },

  // Review steps
  "review/triage": { sections: ["### Plan: Final", "### Build: Final"], needsGitDiff: true },
  "review/self-review": { sections: ["### Build: Final", "### Review: Triage"], needsGitDiff: true },
  "review/security": { sections: ["### Build: Final", "### Review: Triage"], needsGitDiff: true },
  "review/performance": { sections: ["### Build: Final", "### Review: Triage"], needsGitDiff: true },
  "review/compliance": { sections: ["### Plan: Final", "### Build: Final", "### Review: Triage"], needsGitDiff: true },
  "review/fix": {
    sections: [
      "### Review: Self-Review", "### Review: Security",
      "### Review: Performance", "### Review: Compliance",
    ],
    needsGitDiff: true,
  },
  "review/handoff": {
    sections: [
      "### Review: Self-Review", "### Review: Security",
      "### Review: Performance", "### Review: Compliance",
      "### Review: Fix", "### Test: Final", "## Criteria",
    ],
  },
};

export function getContextFor(phase: PhaseName, step?: string): AgentContext {
  if (step) {
    const key = `${phase}/${step}`;
    if (STEP_CONTEXT[key]) return STEP_CONTEXT[key];
  }
  return PHASE_CONTEXT[phase];
}
