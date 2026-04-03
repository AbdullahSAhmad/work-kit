import { PhaseName, Location } from "../state/schema.js";

/**
 * Defines when a completed sub-stage should trigger a loop-back
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
    from: { phase: "plan", subStage: "audit" },
    triggerOutcome: "revise",
    to: { phase: "plan", subStage: "blueprint" },
    reason: "Audit found gaps — revising Blueprint",
  },
  {
    from: { phase: "build", subStage: "refactor" },
    triggerOutcome: "broken",
    to: { phase: "build", subStage: "core" },
    reason: "Refactor broke tests — re-running Core to fix",
  },
  {
    from: { phase: "review", subStage: "handoff" },
    triggerOutcome: "changes_requested",
    to: { phase: "build", subStage: "core" },
    reason: "Review requested changes — looping back to Build/Core",
  },
  {
    from: { phase: "deploy", subStage: "merge" },
    triggerOutcome: "fix_needed",
    to: { phase: "build", subStage: "core" },
    reason: "Merge blocked — fix needed in Build/Core",
  },
  {
    from: { phase: "deploy", subStage: "remediate" },
    triggerOutcome: "fix_and_redeploy",
    to: { phase: "build", subStage: "core" },
    reason: "Deployment issue — fix and redeploy from Build/Core",
  },
];
