import { PhaseName, Location, LoopbackRecord } from "../state/schema.js";
import { LOOPBACK_ROUTES } from "../config/loopback-routes.js";

interface LoopbackResult {
  to: Location;
  reason: string;
}

/**
 * Count how many times a specific loopback route has been taken.
 */
export function countLoopbacksForRoute(loopbacks: LoopbackRecord[], from: Location, to: Location): number {
  return loopbacks.filter(
    (lb) => lb.from.phase === from.phase && lb.from.step === from.step
      && lb.to.phase === to.phase && lb.to.step === to.step
  ).length;
}

/**
 * Check if completing a step with a given outcome should trigger a loop-back.
 */
export function checkLoopback(
  phase: PhaseName,
  step: string,
  outcome?: string
): LoopbackResult | null {
  if (!outcome) return null;

  const route = LOOPBACK_ROUTES.find(
    (r) =>
      r.from.phase === phase &&
      r.from.step === step &&
      r.triggerOutcome === outcome
  );

  if (!route) return null;

  return {
    to: route.to,
    reason: route.reason,
  };
}
