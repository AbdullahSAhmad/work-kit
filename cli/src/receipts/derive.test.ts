import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { deriveOutcome } from "./derive.js";
import type {
  BuildImplementReceipt,
  DeployShipReceipt,
  PlanAuditReceipt,
  ReviewResolveReceipt,
  TestValidateReceipt,
  TriageClassifyReceipt,
  PlanUnderstandReceipt,
} from "./schemas.js";

const STAMP = "2026-04-29T00:00:00Z";

describe("deriveOutcome", () => {
  it("any error → needs_debug, regardless of step", () => {
    const r: PlanUnderstandReceipt = {
      version: 1,
      step: "plan/understand",
      timestamp: STAMP,
      criteria: [],
      error: { kind: "fs", message: "could not read repo" },
    };
    assert.equal(deriveOutcome(r), "needs_debug");
  });

  it("plan/audit with gaps → revise", () => {
    const r: PlanAuditReceipt = {
      version: 1,
      step: "plan/audit",
      timestamp: STAMP,
      gaps: [{ id: "G1", where: "blueprint", description: "missing race handling" }],
    };
    assert.equal(deriveOutcome(r), "revise");
  });

  it("plan/audit with empty gaps → done", () => {
    const r: PlanAuditReceipt = {
      version: 1,
      step: "plan/audit",
      timestamp: STAMP,
      gaps: [],
    };
    assert.equal(deriveOutcome(r), "done");
  });

  it("build/implement passing → done", () => {
    const r: BuildImplementReceipt = {
      version: 1,
      step: "build/implement",
      timestamp: STAMP,
      tests_passing: true,
      test_command: "npm test",
    };
    assert.equal(deriveOutcome(r), "done");
  });

  it("build/implement failing → needs_debug", () => {
    const r: BuildImplementReceipt = {
      version: 1,
      step: "build/implement",
      timestamp: STAMP,
      tests_passing: false,
      test_command: "npm test",
    };
    assert.equal(deriveOutcome(r), "needs_debug");
  });

  it("test/validate verdict pass → done", () => {
    const r: TestValidateReceipt = {
      version: 1,
      step: "test/validate",
      timestamp: STAMP,
      criteria: [{ id: "C1", status: "pass" }],
      verdict: "pass",
    };
    assert.equal(deriveOutcome(r), "done");
  });

  it("test/validate verdict fail → revise", () => {
    const r: TestValidateReceipt = {
      version: 1,
      step: "test/validate",
      timestamp: STAMP,
      criteria: [{ id: "C1", status: "fail" }],
      verdict: "fail",
    };
    assert.equal(deriveOutcome(r), "revise");
  });

  it("review/resolve approved → approved", () => {
    const r: ReviewResolveReceipt = {
      version: 1,
      step: "review/resolve",
      timestamp: STAMP,
      ship_decision: "approved",
    };
    assert.equal(deriveOutcome(r), "approved");
  });

  it("review/resolve changes_requested → changes_requested", () => {
    const r: ReviewResolveReceipt = {
      version: 1,
      step: "review/resolve",
      timestamp: STAMP,
      ship_decision: "changes_requested",
    };
    assert.equal(deriveOutcome(r), "changes_requested");
  });

  it("deploy/ship green merge → done", () => {
    const r: DeployShipReceipt = {
      version: 1,
      step: "deploy/ship",
      timestamp: STAMP,
      merged: true,
      monitor_status: "green",
    };
    assert.equal(deriveOutcome(r), "done");
  });

  it("deploy/ship not merged → fix_needed", () => {
    const r: DeployShipReceipt = {
      version: 1,
      step: "deploy/ship",
      timestamp: STAMP,
      merged: false,
      monitor_status: "skipped",
    };
    assert.equal(deriveOutcome(r), "fix_needed");
  });

  it("deploy/ship merged but monitor red → fix_needed", () => {
    const r: DeployShipReceipt = {
      version: 1,
      step: "deploy/ship",
      timestamp: STAMP,
      merged: true,
      monitor_status: "red",
    };
    assert.equal(deriveOutcome(r), "fix_needed");
  });

  it("triage/classify always → done (classification side-effect handled elsewhere)", () => {
    const r: TriageClassifyReceipt = {
      version: 1,
      step: "triage/classify",
      timestamp: STAMP,
      classification: "feature",
      signals: { ui: true },
    };
    assert.equal(deriveOutcome(r), "done");
  });
});
