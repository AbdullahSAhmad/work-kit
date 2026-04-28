import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { validatePhasePrerequisites } from "./validators.js";
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

function completePhase(state: WorkKitState, phase: PhaseName): void {
  state.phases[phase].status = "completed";
  state.phases[phase].completedAt = "2026-01-01";
  for (const s of Object.values(state.phases[phase].steps)) {
    s.status = "completed";
    s.completedAt = "2026-01-01";
  }
}

describe("validatePhasePrerequisites", () => {
  it("triage has no prerequisites — valid", () => {
    const state = makeState();
    const result = validatePhasePrerequisites(state, "triage");
    assert.equal(result.valid, true);
  });

  it("plan with triage complete — valid", () => {
    const state = makeState();
    completePhase(state, "triage");
    const result = validatePhasePrerequisites(state, "plan");
    assert.equal(result.valid, true);
  });

  it("plan with triage skipped — valid (skipped satisfies prerequisite)", () => {
    const state = makeState();
    state.phases.triage.status = "skipped";
    for (const s of Object.values(state.phases.triage.steps)) {
      s.status = "skipped";
    }
    const result = validatePhasePrerequisites(state, "plan");
    assert.equal(result.valid, true);
  });

  it("build with plan incomplete — invalid", () => {
    const state = makeState();
    completePhase(state, "triage");
    const result = validatePhasePrerequisites(state, "build");
    assert.equal(result.valid, false);
    assert.equal(result.missingPrerequisite, "plan");
  });

  it("build with plan complete — valid", () => {
    const state = makeState();
    completePhase(state, "triage");
    completePhase(state, "plan");
    const result = validatePhasePrerequisites(state, "build");
    assert.equal(result.valid, true);
  });

  it("deploy with review complete but resolve not approved — invalid", () => {
    const state = makeState();
    completePhase(state, "plan");
    completePhase(state, "build");
    completePhase(state, "test");
    completePhase(state, "review");
    // resolve completed but without "approved" outcome
    state.phases.review.steps.resolve.outcome = "blocked";
    const result = validatePhasePrerequisites(state, "deploy");
    assert.equal(result.valid, false);
  });

  it("deploy with review complete and resolve approved — valid", () => {
    const state = makeState();
    completePhase(state, "plan");
    completePhase(state, "build");
    completePhase(state, "test");
    completePhase(state, "review");
    state.phases.review.steps.resolve.outcome = "approved";
    const result = validatePhasePrerequisites(state, "deploy");
    assert.equal(result.valid, true);
  });

  it("wrap-up with review complete — valid", () => {
    const state = makeState();
    completePhase(state, "plan");
    completePhase(state, "build");
    completePhase(state, "test");
    completePhase(state, "review");
    const result = validatePhasePrerequisites(state, "wrap-up");
    assert.equal(result.valid, true);
  });

  it("wrap-up with deploy in-progress — invalid", () => {
    const state = makeState();
    completePhase(state, "plan");
    completePhase(state, "build");
    completePhase(state, "test");
    completePhase(state, "review");
    state.phases.deploy.status = "in-progress";
    const result = validatePhasePrerequisites(state, "wrap-up");
    assert.equal(result.valid, false);
    assert.equal(result.missingPrerequisite, "deploy");
  });
});
