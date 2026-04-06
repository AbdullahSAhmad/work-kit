import { PhaseName, Location } from "../state/schema.js";

/**
 * Defines when a completed step should trigger a loop-back
 * based on its outcome.
 */
export interface LoopbackRoute {
  from: Location;
  triggerOutcome: string;
  to: Location;
  reason: string;
}

export const LOOPBACK_ROUTES: LoopbackRoute[] = [
  {
    from: { phase: "plan", step: "audit" },
    triggerOutcome: "revise",
    to: { phase: "plan", step: "blueprint" },
    reason: "Audit found gaps — revising Blueprint",
  },
  {
    from: { phase: "build", step: "refactor" },
    triggerOutcome: "broken",
    to: { phase: "build", step: "core" },
    reason: "Refactor broke tests — re-running Core to fix",
  },
  {
    from: { phase: "review", step: "handoff" },
    triggerOutcome: "changes_requested",
    to: { phase: "build", step: "core" },
    reason: "Review requested changes — looping back to Build/Core",
  },
  {
    from: { phase: "deploy", step: "merge" },
    triggerOutcome: "fix_needed",
    to: { phase: "build", step: "core" },
    reason: "Merge blocked — fix needed in Build/Core",
  },
  {
    from: { phase: "deploy", step: "remediate" },
    triggerOutcome: "fix_and_redeploy",
    to: { phase: "build", step: "core" },
    reason: "Deployment issue — fix and redeploy from Build/Core",
  },
];
