import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateReceipt } from "./validate.js";

describe("validateReceipt", () => {
  describe("base validation", () => {
    it("rejects non-objects", () => {
      const res = validateReceipt("nope", "plan", "audit");
      assert.equal(res.ok, false);
      if (!res.ok) assert.match(res.errors[0], /not a JSON object/);
    });

    it("rejects unknown step keys", () => {
      const res = validateReceipt({ version: 1, step: "plan/audit", timestamp: "x", gaps: [] }, "plan" as any, "frob");
      assert.equal(res.ok, false);
      if (!res.ok) assert.match(res.errors[0], /no receipt schema is defined/);
    });

    it("rejects wrong version", () => {
      const res = validateReceipt({ version: 99, step: "plan/audit", timestamp: "x", gaps: [] }, "plan", "audit");
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes("version must be 1")));
    });

    it("rejects mismatched step", () => {
      const res = validateReceipt({ version: 1, step: "plan/design", timestamp: "x", gaps: [] }, "plan", "audit");
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes('step must be "plan/audit"')));
    });

    it("rejects missing timestamp", () => {
      const res = validateReceipt({ version: 1, step: "plan/audit", gaps: [] }, "plan", "audit");
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes("timestamp must be a string")));
    });

    it("validates error field shape", () => {
      const res = validateReceipt(
        { version: 1, step: "build/setup", timestamp: "x", error: { kind: 123, message: "x" } },
        "build",
        "setup",
      );
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes("error.kind must be a string")));
    });
  });

  describe("triage/classify", () => {
    it("accepts a valid receipt", () => {
      const res = validateReceipt(
        {
          version: 1,
          step: "triage/classify",
          timestamp: "2026-04-29T00:00:00Z",
          classification: "feature",
          signals: { ui: true, db: false },
          rationale: "user-facing",
        },
        "triage",
        "classify",
      );
      assert.equal(res.ok, true);
    });

    it("rejects unknown classification", () => {
      const res = validateReceipt(
        {
          version: 1,
          step: "triage/classify",
          timestamp: "x",
          classification: "wat",
          signals: {},
        },
        "triage",
        "classify",
      );
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes("classification")));
    });

    it("rejects missing signals", () => {
      const res = validateReceipt(
        { version: 1, step: "triage/classify", timestamp: "x", classification: "feature" },
        "triage",
        "classify",
      );
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes("signals")));
    });
  });

  describe("plan/audit", () => {
    it("accepts a clean audit", () => {
      const res = validateReceipt({ version: 1, step: "plan/audit", timestamp: "x", gaps: [] }, "plan", "audit");
      assert.equal(res.ok, true);
    });

    it("requires gap entries to be well-shaped", () => {
      const res = validateReceipt(
        {
          version: 1,
          step: "plan/audit",
          timestamp: "x",
          gaps: [{ id: "G1", where: "blueprint" /* description missing */ }],
        },
        "plan",
        "audit",
      );
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes("gaps[0].description")));
    });
  });

  describe("build/implement", () => {
    it("accepts a passing build", () => {
      const res = validateReceipt(
        {
          version: 1,
          step: "build/implement",
          timestamp: "x",
          tests_passing: true,
          test_command: "npm test",
        },
        "build",
        "implement",
      );
      assert.equal(res.ok, true);
    });

    it("rejects missing tests_passing", () => {
      const res = validateReceipt(
        { version: 1, step: "build/implement", timestamp: "x", test_command: "npm test" },
        "build",
        "implement",
      );
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes("tests_passing")));
    });
  });

  describe("test/validate", () => {
    it("accepts a pass verdict", () => {
      const res = validateReceipt(
        {
          version: 1,
          step: "test/validate",
          timestamp: "x",
          criteria: [{ id: "C1", status: "pass" }],
          verdict: "pass",
        },
        "test",
        "validate",
      );
      assert.equal(res.ok, true);
    });

    it("rejects unknown criterion status", () => {
      const res = validateReceipt(
        {
          version: 1,
          step: "test/validate",
          timestamp: "x",
          criteria: [{ id: "C1", status: "huh" }],
          verdict: "pass",
        },
        "test",
        "validate",
      );
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.errors.some((e) => e.includes("criteria[0].status")));
    });
  });

  describe("review/resolve", () => {
    it("accepts approved", () => {
      const res = validateReceipt(
        { version: 1, step: "review/resolve", timestamp: "x", ship_decision: "approved" },
        "review",
        "resolve",
      );
      assert.equal(res.ok, true);
    });

    it("rejects unknown ship_decision", () => {
      const res = validateReceipt(
        { version: 1, step: "review/resolve", timestamp: "x", ship_decision: "maybe" },
        "review",
        "resolve",
      );
      assert.equal(res.ok, false);
    });
  });

  describe("deploy/ship", () => {
    it("accepts a green merge", () => {
      const res = validateReceipt(
        { version: 1, step: "deploy/ship", timestamp: "x", merged: true, monitor_status: "green" },
        "deploy",
        "ship",
      );
      assert.equal(res.ok, true);
    });

    it("rejects bogus monitor_status", () => {
      const res = validateReceipt(
        { version: 1, step: "deploy/ship", timestamp: "x", merged: true, monitor_status: "purple" },
        "deploy",
        "ship",
      );
      assert.equal(res.ok, false);
    });
  });

  describe("evidence-only steps accept minimal receipts", () => {
    const minimal: { phase: any; step: string; payload: Record<string, unknown> }[] = [
      { phase: "build", step: "setup", payload: {} },
      {
        phase: "wrap-up",
        step: "finalize",
        payload: {
          extracted: { findings: 0, workflow: 0 },
        },
      },
    ];

    for (const m of minimal) {
      it(`${m.phase}/${m.step}`, () => {
        const res = validateReceipt(
          { version: 1, step: `${m.phase}/${m.step}`, timestamp: "x", ...m.payload },
          m.phase,
          m.step,
        );
        assert.equal(res.ok, true);
      });
    }
  });
});
