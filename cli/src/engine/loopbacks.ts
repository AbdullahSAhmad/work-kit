import { PhaseName, Location } from "../state/schema.js";
import { LOOPBACK_ROUTES } from "../config/loopback-routes.js";

interface LoopbackResult {
  to: Location;
  reason: string;
}

/**
 * Check if completing a sub-stage with a given outcome should trigger a loop-back.
 */
export function checkLoopback(
  phase: PhaseName,
  subStage: string,
  outcome?: string
): LoopbackResult | null {
  if (!outcome) return null;

  const route = LOOPBACK_ROUTES.find(
    (r) =>
      r.from.phase === phase &&
      r.from.subStage === subStage &&
      r.triggerOutcome === outcome
  );

  if (!route) return null;

  return {
    to: route.to,
    reason: route.reason,
  };
}
