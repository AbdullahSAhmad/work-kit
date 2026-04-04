import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { validatePhasePrerequisites } from "./validators.js";
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

function completePhase(state: WorkKitState, phase: PhaseName): void {
  state.phases[phase].status = "completed";
  state.phases[phase].completedAt = "2026-01-01";
  for (const ss of Object.values(state.phases[phase].subStages)) {
    ss.status = "completed";
    ss.completedAt = "2026-01-01";
  }
}

describe("validatePhasePrerequisites", () => {
  it("plan has no prerequisites — valid", () => {
    const state = makeState();
    const result = validatePhasePrerequisites(state, "plan");
    assert.equal(result.valid, true);
  });

  it("build with plan incomplete — invalid", () => {
    const state = makeState();
    const result = validatePhasePrerequisites(state, "build");
    assert.equal(result.valid, false);
    assert.equal(result.missingPrerequisite, "plan");
  });

  it("build with plan complete — valid", () => {
    const state = makeState();
    completePhase(state, "plan");
    const result = validatePhasePrerequisites(state, "build");
    assert.equal(result.valid, true);
  });

  it("deploy with review complete but handoff not approved — invalid", () => {
    const state = makeState();
    completePhase(state, "plan");
    completePhase(state, "build");
    completePhase(state, "test");
    completePhase(state, "review");
    // handoff completed but without "approved" outcome
    state.phases.review.subStages.handoff.outcome = "pending_review";
    const result = validatePhasePrerequisites(state, "deploy");
    assert.equal(result.valid, false);
  });

  it("deploy with review complete and handoff approved — valid", () => {
    const state = makeState();
    completePhase(state, "plan");
    completePhase(state, "build");
    completePhase(state, "test");
    completePhase(state, "review");
    state.phases.review.subStages.handoff.outcome = "approved";
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
