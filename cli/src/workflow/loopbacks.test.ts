import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { checkLoopback } from "./loopbacks.js";

describe("checkLoopback", () => {
  it("plan/audit with 'revise' loops back to plan/design", () => {
    const result = checkLoopback("plan", "audit", "revise");
    assert.notEqual(result, null);
    assert.deepStrictEqual(result!.to, { phase: "plan", step: "design" });
    assert.ok(result!.reason.length > 0);
  });

  it("plan/audit with 'proceed' returns null (no loopback)", () => {
    const result = checkLoopback("plan", "audit", "proceed");
    assert.equal(result, null);
  });

  it("review/handoff with 'changes_requested' loops back to build/implement", () => {
    const result = checkLoopback("review", "handoff", "changes_requested");
    assert.notEqual(result, null);
    assert.deepStrictEqual(result!.to, { phase: "build", step: "implement" });
  });

  it("build/implement with 'done' returns null", () => {
    const result = checkLoopback("build", "implement", "done");
    assert.equal(result, null);
  });

  it("returns null when outcome is undefined", () => {
    const result = checkLoopback("plan", "audit");
    assert.equal(result, null);
  });
});
