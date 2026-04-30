import * as assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import { MAX_DEBUG_ITERATIONS, MAX_LOOPBACKS_PER_ROUTE } from "../config/constants.js";
import { writeReceipt } from "../receipts/store.js";
import { readState, writeState } from "../state/store.js";
import { completeCommand } from "./complete.js";
import { initCommand } from "./init.js";

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `work-kit-complete-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

/** Mark every step before `target` as completed so we can isolate one transition. */
function fastForwardTo(root: string, phase: string, step: string): void {
  const state = readState(root);
  const order = ["triage", "plan", "build", "test", "review", "deploy", "wrap-up"] as const;
  for (const p of order) {
    if (p === phase) {
      for (const [s, ss] of Object.entries(state.phases[p].steps)) {
        if (s === step) {
          ss.status = "in-progress";
          ss.startedAt = new Date().toISOString();
          break;
        }
        if (ss.status === "pending") {
          ss.status = "completed";
          ss.completedAt = new Date().toISOString();
        }
      }
      state.phases[p].status = "in-progress";
      state.phases[p].startedAt = new Date().toISOString();
      state.currentPhase = p;
      state.currentStep = step;
      break;
    }
    state.phases[p].status = "completed";
    state.phases[p].startedAt = new Date(Date.now() - 1000).toISOString();
    state.phases[p].completedAt = new Date().toISOString();
    for (const ss of Object.values(state.phases[p].steps)) {
      if (ss.status !== "skipped") {
        ss.status = "completed";
        ss.completedAt = new Date().toISOString();
      }
    }
  }
  writeState(root, state);
}

describe("complete: needs_debug routing", () => {
  it("spawns debug agent when receipt has error field", () => {
    const tmp = makeTmpDir();
    initCommand({ mode: "full", description: "Debug routing", worktreeRoot: tmp });
    fastForwardTo(tmp, "build", "implement");

    writeReceipt(tmp, "build", "implement", {
      version: 1,
      step: "build/implement",
      timestamp: new Date().toISOString(),
      tests_passing: false,
      test_command: "npm test",
      error: { kind: "test-failure", message: "auth.test.ts failed" },
    });

    const result = completeCommand("build/implement", undefined, tmp);
    assert.equal(result.action, "spawn_debug_agent");
    if (result.action === "spawn_debug_agent") {
      assert.equal(result.iteration, 1);
      assert.deepEqual(result.origin, { phase: "build", step: "implement" });
    }
  });

  it("tracks debug iterations and surfaces to user at the cap", () => {
    const tmp = makeTmpDir();
    initCommand({ mode: "full", description: "Debug cap", worktreeRoot: tmp });
    fastForwardTo(tmp, "build", "implement");

    // Pre-populate the loopback log with MAX_DEBUG_ITERATIONS debug records.
    const state = readState(tmp);
    for (let i = 0; i < MAX_DEBUG_ITERATIONS; i++) {
      state.loopbacks.push({
        from: { phase: "build", step: "implement" },
        to: { phase: "build", step: "implement" },
        reason: `prior debug ${i + 1}`,
        timestamp: new Date().toISOString(),
        kind: "debug",
      });
    }
    writeState(tmp, state);

    writeReceipt(tmp, "build", "implement", {
      version: 1,
      step: "build/implement",
      timestamp: new Date().toISOString(),
      tests_passing: false,
      test_command: "npm test",
      error: { kind: "still-broken", message: "still failing" },
    });

    const result = completeCommand("build/implement", undefined, tmp);
    assert.equal(result.action, "wait_for_user");
    if (result.action === "wait_for_user") {
      assert.ok(result.message.includes("max debug iterations"));
    }
  });
});

describe("complete: triage classification", () => {
  it("stores classification when triage/classify completes (auto mode)", () => {
    const tmp = makeTmpDir();
    initCommand({
      mode: "auto",
      description: "Classify test",
      classification: "bug-fix",
      worktreeRoot: tmp,
    });

    writeReceipt(tmp, "triage", "classify", {
      version: 1,
      step: "triage/classify",
      timestamp: new Date().toISOString(),
      classification: "feature",
      signals: { ui: true },
    });

    completeCommand("triage/classify", undefined, tmp);

    const state = readState(tmp);
    // Receipt-derived classification should overwrite the init-time one.
    assert.equal(state.classification, "feature");
    assert.equal(state.phases.triage.steps.classify.status, "completed");
  });
});

describe("complete: loopback routing", () => {
  it("plan/audit with gaps loops back to plan/design", () => {
    const tmp = makeTmpDir();
    initCommand({ mode: "full", description: "Audit loopback", worktreeRoot: tmp });
    fastForwardTo(tmp, "plan", "audit");

    writeReceipt(tmp, "plan", "audit", {
      version: 1,
      step: "plan/audit",
      timestamp: new Date().toISOString(),
      gaps: [{ id: "G1", where: "blueprint", description: "missing API contract" }],
    });

    const result = completeCommand("plan/audit", undefined, tmp);
    assert.equal(result.action, "loopback");
    if (result.action === "loopback") {
      assert.equal(result.to.phase, "plan");
      assert.equal(result.to.step, "design");
    }

    // State should reflect the loopback: design back to pending, audit pending again.
    const state = readState(tmp);
    assert.equal(state.phases.plan.steps.design.status, "pending");
    assert.equal(state.phases.plan.steps.audit.status, "pending");
    assert.equal(state.loopbacks.length, 1);
  });

  it("audit with no gaps just advances (outcome=done)", () => {
    const tmp = makeTmpDir();
    initCommand({ mode: "full", description: "Audit clean", worktreeRoot: tmp });
    fastForwardTo(tmp, "plan", "audit");

    writeReceipt(tmp, "plan", "audit", {
      version: 1,
      step: "plan/audit",
      timestamp: new Date().toISOString(),
      gaps: [],
    });

    const result = completeCommand("plan/audit", undefined, tmp);
    // Plan phase now complete → wait_for_user with the next-phase prompt.
    assert.equal(result.action, "wait_for_user");
    if (result.action === "wait_for_user") {
      assert.ok(result.message.toLowerCase().includes("plan"));
    }
  });

  it("max loopback per route surfaces to user instead of looping", () => {
    const tmp = makeTmpDir();
    initCommand({ mode: "full", description: "Max loopback", worktreeRoot: tmp });
    fastForwardTo(tmp, "plan", "audit");

    // Pre-populate the same route at the cap.
    const state = readState(tmp);
    for (let i = 0; i < MAX_LOOPBACKS_PER_ROUTE; i++) {
      state.loopbacks.push({
        from: { phase: "plan", step: "audit" },
        to: { phase: "plan", step: "design" },
        reason: "earlier loopback",
        timestamp: new Date().toISOString(),
      });
    }
    writeState(tmp, state);

    writeReceipt(tmp, "plan", "audit", {
      version: 1,
      step: "plan/audit",
      timestamp: new Date().toISOString(),
      gaps: [{ id: "G1", where: "design", description: "still missing" }],
    });

    const result = completeCommand("plan/audit", undefined, tmp);
    assert.equal(result.action, "wait_for_user");
    if (result.action === "wait_for_user") {
      assert.ok(result.message.includes("max loopback count"));
    }
  });
});

describe("complete: phase advancement", () => {
  it("rejects already-completed steps", () => {
    const tmp = makeTmpDir();
    initCommand({ mode: "full", description: "Already done", worktreeRoot: tmp });

    const state = readState(tmp);
    state.phases.triage.steps.classify.status = "completed";
    state.phases.triage.steps.classify.completedAt = new Date().toISOString();
    writeState(tmp, state);

    const result = completeCommand("triage/classify", undefined, tmp);
    assert.equal(result.action, "error");
    if (result.action === "error") {
      assert.ok(result.message.includes("already completed"));
    }
  });

  it("rejects skipped steps", () => {
    const tmp = makeTmpDir();
    initCommand({
      mode: "auto",
      description: "Skipped step",
      classification: "bug-fix",
      worktreeRoot: tmp,
    });

    // bug-fix skips plan/design — we should refuse to complete it.
    const result = completeCommand("plan/design", undefined, tmp);
    assert.equal(result.action, "error");
    if (result.action === "error") {
      assert.ok(result.message.includes("skipped"));
    }
  });
});
