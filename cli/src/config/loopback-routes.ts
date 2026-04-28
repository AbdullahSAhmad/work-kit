import { Location, StepOutcome } from "../state/schema.js";

/**
 * Defines when a completed step should trigger a loop-back
 * based on its outcome.
 */
export interface LoopbackRoute {
  from: Location;
  triggerOutcome: StepOutcome;
  to: Location;
  reason: string;
}

export const LOOPBACK_ROUTES: LoopbackRoute[] = [
  {
    from: { phase: "plan", step: "audit" },
    triggerOutcome: "revise",
    to: { phase: "plan", step: "design" },
    reason: "Audit found gaps — revising Design",
  },
  {
    from: { phase: "review", step: "handoff" },
    triggerOutcome: "changes_requested",
    to: { phase: "build", step: "implement" },
    reason: "Review requested changes — looping back to Build/Implement",
  },
  {
    from: { phase: "deploy", step: "merge" },
    triggerOutcome: "fix_needed",
    to: { phase: "build", step: "implement" },
    reason: "Merge blocked — fix needed in Build/Implement",
  },
  {
    from: { phase: "deploy", step: "remediate" },
    triggerOutcome: "fix_and_redeploy",
    to: { phase: "build", step: "implement" },
    reason: "Deployment issue — fix and redeploy from Build/Implement",
  },
];
