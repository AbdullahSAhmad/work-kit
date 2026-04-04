import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { nextSubStageInPhase, isPhaseComplete, determineNextStep } from "./transitions.js";
import type { WorkKitState, PhaseName, PhaseState, SubStageState } from "../state/schema.js";
import { PHASE_NAMES, SUBSTAGES_BY_PHASE } from "../state/schema.js";

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

describe("nextSubStageInPhase", () => {
  it("returns first pending sub-stage", () => {
    const state = makeState();
    const result = nextSubStageInPhase(state, "plan");
    assert.equal(result, "clarify");
  });

  it("returns null when all complete or skipped", () => {
    const state = makeState();
    for (const ss of Object.values(state.phases.plan.subStages)) {
      ss.status = "completed";
    }
    const result = nextSubStageInPhase(state, "plan");
    assert.equal(result, null);
  });

  it("skips completed sub-stages and returns next pending", () => {
    const state = makeState();
    state.phases.plan.subStages.clarify.status = "completed";
    state.phases.plan.subStages.investigate.status = "completed";
    const result = nextSubStageInPhase(state, "plan");
    assert.equal(result, "sketch");
  });
});

describe("isPhaseComplete", () => {
  it("returns true when all complete or skipped", () => {
    const state = makeState();
    for (const ss of Object.values(state.phases.plan.subStages)) {
      ss.status = "completed";
    }
    assert.equal(isPhaseComplete(state, "plan"), true);
  });

  it("returns true with mix of completed and skipped", () => {
    const state = makeState();
    let first = true;
    for (const ss of Object.values(state.phases.plan.subStages)) {
      ss.status = first ? "skipped" : "completed";
      first = false;
    }
    assert.equal(isPhaseComplete(state, "plan"), true);
  });

  it("returns false when some sub-stages are pending", () => {
    const state = makeState();
    assert.equal(isPhaseComplete(state, "plan"), false);
  });
});

describe("determineNextStep", () => {
  it("returns complete when state is completed", () => {
    const state = makeState();
    state.status = "completed";
    const step = determineNextStep(state);
    assert.equal(step.type, "complete");
  });

  it("returns phase-boundary when no current phase", () => {
    const state = makeState();
    state.currentPhase = null;
    const step = determineNextStep(state);
    assert.equal(step.type, "phase-boundary");
    assert.equal(step.phase, "plan");
  });

  it("returns sub-stage for current phase with pending work", () => {
    const state = makeState();
    state.currentPhase = "plan";
    state.phases.plan.status = "in-progress";
    const step = determineNextStep(state);
    assert.equal(step.type, "sub-stage");
    assert.equal(step.phase, "plan");
    assert.equal(step.subStage, "clarify");
  });

  it("auto-proceeds to next phase by default when current phase is complete", () => {
    const state = makeState();
    state.currentPhase = "plan";
    for (const ss of Object.values(state.phases.plan.subStages)) {
      ss.status = "completed";
    }
    const step = determineNextStep(state);
    assert.equal(step.type, "phase-boundary");
    assert.equal(step.phase, "build");
  });

  it("returns wait-for-user when gated and current phase is complete", () => {
    const state = makeState();
    state.gated = true;
    state.currentPhase = "plan";
    for (const ss of Object.values(state.phases.plan.subStages)) {
      ss.status = "completed";
    }
    const step = determineNextStep(state);
    assert.equal(step.type, "wait-for-user");
    assert.equal(step.phase, "build");
  });
});
