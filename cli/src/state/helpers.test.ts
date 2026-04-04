import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parseLocation, resetToLocation } from "./helpers.js";
import type { WorkKitState, PhaseName, PhaseState, SubStageState } from "./schema.js";
import { PHASE_NAMES, SUBSTAGES_BY_PHASE } from "./schema.js";

function makeState(): WorkKitState {
  const phases = {} as Record<PhaseName, PhaseState>;
  for (const phase of PHASE_NAMES) {
    const subStages: Record<string, SubStageState> = {};
    for (const ss of SUBSTAGES_BY_PHASE[phase]) {
      subStages[ss] = { status: "pending" };
    }
    phases[phase] = { status: "pending", subStages };
  }
  return {
    version: 1,
    slug: "test",
    branch: "feature/test",
    started: "2026-01-01",
    mode: "full-kit",
    status: "in-progress",
    currentPhase: "plan",
    currentSubStage: "clarify",
    phases,
    loopbacks: [],
    metadata: { worktreeRoot: "/tmp/test", mainRepoRoot: "/tmp/test" },
  };
}

describe("parseLocation", () => {
  it("parses plan/clarify correctly", () => {
    const loc = parseLocation("plan/clarify");
    assert.deepStrictEqual(loc, { phase: "plan", subStage: "clarify" });
  });

  it("throws on invalid format (no slash)", () => {
    assert.throws(() => parseLocation("invalid"), /Invalid location/);
  });

  it("throws on unknown phase", () => {
    assert.throws(() => parseLocation("foobar/baz"), /Unknown phase/);
  });

  it("throws on unknown sub-stage", () => {
    assert.throws(() => parseLocation("plan/nonexistent"), /Unknown sub-stage/);
  });
});

describe("resetToLocation", () => {
  it("resets target and later phases to pending", () => {
    const state = makeState();

    // Mark plan and build as completed
    for (const ss of Object.values(state.phases.plan.subStages)) {
      ss.status = "completed";
      ss.completedAt = "2026-01-01";
    }
    state.phases.plan.status = "completed";
    state.phases.plan.completedAt = "2026-01-01";

    for (const ss of Object.values(state.phases.build.subStages)) {
      ss.status = "completed";
      ss.completedAt = "2026-01-02";
    }
    state.phases.build.status = "completed";
    state.phases.build.completedAt = "2026-01-02";

    // Reset to plan/blueprint
    resetToLocation(state, { phase: "plan", subStage: "blueprint" });

    // Sub-stages before blueprint should stay completed
    assert.equal(state.phases.plan.subStages.clarify.status, "completed");
    assert.equal(state.phases.plan.subStages.investigate.status, "completed");
    assert.equal(state.phases.plan.subStages.sketch.status, "completed");
    assert.equal(state.phases.plan.subStages.scope.status, "completed");
    assert.equal(state.phases.plan.subStages["ux-flow"].status, "completed");
    assert.equal(state.phases.plan.subStages.architecture.status, "completed");

    // Blueprint and audit should be reset
    assert.equal(state.phases.plan.subStages.blueprint.status, "pending");
    assert.equal(state.phases.plan.subStages.audit.status, "pending");

    // Plan phase should be in-progress
    assert.equal(state.phases.plan.status, "in-progress");

    // Build (later phase) should be reset
    assert.equal(state.phases.build.status, "pending");
    assert.equal(state.phases.build.subStages.core.status, "pending");
  });
});
