import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parseLocation, resetToLocation } from "./helpers.js";
import type { WorkKitState, PhaseName, PhaseState, StepState } from "./schema.js";
import { PHASE_NAMES, STEPS_BY_PHASE } from "./schema.js";

function makeState(): WorkKitState {
  const phases = {} as Record<PhaseName, PhaseState>;
  for (const phase of PHASE_NAMES) {
    const steps: Record<string, StepState> = {};
    for (const s of STEPS_BY_PHASE[phase]) {
      steps[s] = { status: "pending" };
    }
    phases[phase] = { status: "pending", steps };
  }
  return {
    version: 2,
    slug: "test",
    branch: "feature/test",
    started: "2026-01-01",
    mode: "full-kit",
    status: "in-progress",
    currentPhase: "plan",
    currentStep: "clarify",
    phases,
    loopbacks: [],
    metadata: { worktreeRoot: "/tmp/test", mainRepoRoot: "/tmp/test" },
  };
}

describe("parseLocation", () => {
  it("parses plan/clarify correctly", () => {
    const loc = parseLocation("plan/clarify");
    assert.deepStrictEqual(loc, { phase: "plan", step: "clarify" });
  });

  it("throws on invalid format (no slash)", () => {
    assert.throws(() => parseLocation("invalid"), /Invalid location/);
  });

  it("throws on unknown phase", () => {
    assert.throws(() => parseLocation("foobar/baz"), /Unknown phase/);
  });

  it("throws on unknown step", () => {
    assert.throws(() => parseLocation("plan/nonexistent"), /Unknown step/);
  });
});

describe("resetToLocation", () => {
  it("resets target and later phases to pending", () => {
    const state = makeState();

    // Mark plan and build as completed
    for (const s of Object.values(state.phases.plan.steps)) {
      s.status = "completed";
      s.completedAt = "2026-01-01";
    }
    state.phases.plan.status = "completed";
    state.phases.plan.completedAt = "2026-01-01";

    for (const s of Object.values(state.phases.build.steps)) {
      s.status = "completed";
      s.completedAt = "2026-01-02";
    }
    state.phases.build.status = "completed";
    state.phases.build.completedAt = "2026-01-02";

    // Reset to plan/blueprint
    resetToLocation(state, { phase: "plan", step: "blueprint" });

    // Steps before blueprint should stay completed
    assert.equal(state.phases.plan.steps.clarify.status, "completed");
    assert.equal(state.phases.plan.steps.investigate.status, "completed");
    assert.equal(state.phases.plan.steps.sketch.status, "completed");
    assert.equal(state.phases.plan.steps.scope.status, "completed");
    assert.equal(state.phases.plan.steps["ux-flow"].status, "completed");
    assert.equal(state.phases.plan.steps.architecture.status, "completed");

    // Blueprint and audit should be reset
    assert.equal(state.phases.plan.steps.blueprint.status, "pending");
    assert.equal(state.phases.plan.steps.audit.status, "pending");

    // Plan phase should be in-progress
    assert.equal(state.phases.plan.status, "in-progress");

    // Build (later phase) should be reset
    assert.equal(state.phases.build.status, "pending");
    assert.equal(state.phases.build.steps.core.status, "pending");
  });
});
