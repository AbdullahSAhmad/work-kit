import { PhaseName } from "../state/schema.js";

// ── Phase-level Wait Points ──────────────────────────────────────────
// After completing these phases, the orchestrator should wait for user
// confirmation before proceeding to the next phase.

export const WAIT_AFTER_PHASE: Set<PhaseName> = new Set([
  "plan",    // User reviews the blueprint before build
  "build",   // User reviews the PR before test
  "test",    // User reviews test results before review
  "review",  // User reviews the ship decision before deploy
]);

// ── Phase Display Names ──────────────────────────────────────────────

export const PHASE_DISPLAY_NAMES: Record<PhaseName, string> = {
  define: "Define",
  plan: "Plan",
  build: "Build",
  test: "Test",
  review: "Review",
  deploy: "Deploy",
  "wrap-up": "Wrap-up",
};
