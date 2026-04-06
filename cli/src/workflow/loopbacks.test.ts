import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { checkLoopback } from "./loopbacks.js";

describe("checkLoopback", () => {
  it("plan/audit with 'revise' loops back to plan/blueprint", () => {
    const result = checkLoopback("plan", "audit", "revise");
    assert.notEqual(result, null);
    assert.deepStrictEqual(result!.to, { phase: "plan", step: "blueprint" });
    assert.ok(result!.reason.length > 0);
  });

  it("plan/audit with 'proceed' returns null (no loopback)", () => {
    const result = checkLoopback("plan", "audit", "proceed");
    assert.equal(result, null);
  });

  it("review/handoff with 'changes_requested' loops back to build/core", () => {
    const result = checkLoopback("review", "handoff", "changes_requested");
    assert.notEqual(result, null);
    assert.deepStrictEqual(result!.to, { phase: "build", step: "core" });
  });

  it("build/core with 'done' returns null", () => {
    const result = checkLoopback("build", "core", "done");
    assert.equal(result, null);
  });

  it("returns null when outcome is undefined", () => {
    const result = checkLoopback("plan", "audit");
    assert.equal(result, null);
  });
});
