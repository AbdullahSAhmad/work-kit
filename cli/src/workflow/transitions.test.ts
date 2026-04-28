import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { nextStepInPhase, isPhaseComplete, determineNextStep } from "./transitions.js";
import type { WorkKitState, PhaseName, PhaseState, StepState } from "../state/schema.js";
import { PHASE_NAMES, STEPS_BY_PHASE } from "../state/schema.js";

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
    version: 3,
    slug: "test",
    branch: "feature/test",
    started: "2026-01-01",
    mode: "full-kit",
    status: "in-progress",
    currentPhase: "plan",
    currentStep: "understand",
    phases,
    loopbacks: [],
    metadata: { worktreeRoot: "/tmp/test", mainRepoRoot: "/tmp/test" },
  };
}

describe("nextStepInPhase", () => {
  it("returns first pending step", () => {
    const state = makeState();
    const result = nextStepInPhase(state, "plan");
    assert.equal(result, "understand");
  });

  it("returns null when all complete or skipped", () => {
    const state = makeState();
    for (const s of Object.values(state.phases.plan.steps)) {
      s.status = "completed";
    }
    const result = nextStepInPhase(state, "plan");
    assert.equal(result, null);
  });

  it("skips completed steps and returns next pending", () => {
    const state = makeState();
    state.phases.plan.steps.understand.status = "completed";
    const result = nextStepInPhase(state, "plan");
    assert.equal(result, "design");
  });
});

describe("isPhaseComplete", () => {
  it("returns true when all complete or skipped", () => {
    const state = makeState();
    for (const s of Object.values(state.phases.plan.steps)) {
      s.status = "completed";
    }
    assert.equal(isPhaseComplete(state, "plan"), true);
  });

  it("returns true with mix of completed and skipped", () => {
    const state = makeState();
    let first = true;
    for (const s of Object.values(state.phases.plan.steps)) {
      s.status = first ? "skipped" : "completed";
      first = false;
    }
    assert.equal(isPhaseComplete(state, "plan"), true);
  });

  it("returns false when some steps are pending", () => {
    const state = makeState();
    assert.equal(isPhaseComplete(state, "plan"), false);
  });
});

describe("determineNextStep", () => {
  it("returns complete when state is completed", () => {
    const state = makeState();
    state.status = "completed";
    const result = determineNextStep(state);
    assert.equal(result.type, "complete");
  });

  it("returns phase-boundary when no current phase", () => {
    const state = makeState();
    state.currentPhase = null;
    const result = determineNextStep(state);
    assert.equal(result.type, "phase-boundary");
    assert.equal(result.phase, "triage");
  });

  it("returns step for current phase with pending work", () => {
    const state = makeState();
    state.currentPhase = "plan";
    state.phases.plan.status = "in-progress";
    const result = determineNextStep(state);
    assert.equal(result.type, "step");
    assert.equal(result.phase, "plan");
    assert.equal(result.step, "understand");
  });

  it("auto-proceeds to next phase by default when current phase is complete", () => {
    const state = makeState();
    state.currentPhase = "plan";
    for (const s of Object.values(state.phases.plan.steps)) {
      s.status = "completed";
    }
    const result = determineNextStep(state);
    assert.equal(result.type, "phase-boundary");
    assert.equal(result.phase, "build");
  });

  it("returns wait-for-user when gated and current phase is complete", () => {
    const state = makeState();
    state.gated = true;
    state.currentPhase = "plan";
    for (const s of Object.values(state.phases.plan.steps)) {
      s.status = "completed";
    }
    const result = determineNextStep(state);
    assert.equal(result.type, "wait-for-user");
    assert.equal(result.phase, "build");
  });
});
