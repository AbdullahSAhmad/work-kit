import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { initCommand } from "./init.js";
import { runCommand } from "./run.js";
import { writeReceipt } from "../receipts/store.js";

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `work-kit-run-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe("runCommand", () => {
  it("without --finished returns the next spawn_agent action augmented with after", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Run no flags", worktreeRoot: tmp });

    const result = runCommand({ worktreeRoot: tmp });
    assert.equal(result.action, "spawn_agent");
    if (result.action === "spawn_agent") {
      assert.equal(result.phase, "triage");
      assert.equal(result.step, "classify");
      assert.ok(result.after, "after field should be present");
      assert.match(result.after!, /run --finished triage\/classify/);
      assert.ok(result.receiptPath, "receiptPath should be present for triage/classify");
    }
  });

  it("--finished without a receipt errors with a clear suggestion", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Run no receipt", worktreeRoot: tmp });

    const result = runCommand({ finished: "triage/classify", worktreeRoot: tmp });
    assert.equal(result.action, "error");
    if (result.action === "error") {
      assert.ok(result.message.includes("requires a receipt"));
    }
  });

  it("--finished with a valid receipt advances + returns the next action", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Run with receipt", worktreeRoot: tmp });

    writeReceipt(tmp, "triage", "classify", {
      version: 1,
      step: "triage/classify",
      timestamp: new Date().toISOString(),
      classification: "feature",
      signals: { ui: true },
    });

    const result = runCommand({ finished: "triage/classify", worktreeRoot: tmp });
    // Triage → Plan boundary in full mode (not gated) auto-advances to plan/understand.
    assert.equal(result.action, "spawn_agent");
    if (result.action === "spawn_agent") {
      assert.equal(result.phase, "plan");
      assert.equal(result.step, "understand");
      assert.match(result.after!, /run --finished plan\/understand/);
    }
  });

  it("propagates wait_for_user from gated mode with after=run", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Run gated", gated: true, worktreeRoot: tmp });

    writeReceipt(tmp, "triage", "classify", {
      version: 1,
      step: "triage/classify",
      timestamp: new Date().toISOString(),
      classification: "feature",
      signals: { ui: true },
    });

    const result = runCommand({ finished: "triage/classify", worktreeRoot: tmp });
    assert.equal(result.action, "wait_for_user");
    if (result.action === "wait_for_user") {
      assert.match(result.after!, /work-kit run$/);
    }
  });

  it("loopback derived from receipt routes the next action to the loopback target", () => {
    // plan/audit with non-empty gaps → outcome `revise` → loopback to plan/design.
    // Using auto mode lets us seed the workflow with both audit and design.
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({
      mode: "full",
      description: "Run loopback",
      worktreeRoot: tmp,
    });

    // Drive triage → plan/understand → plan/design → plan/audit.
    writeReceipt(tmp, "triage", "classify", {
      version: 1,
      step: "triage/classify",
      timestamp: new Date().toISOString(),
      classification: "large-feature",
      signals: {},
    });
    runCommand({ finished: "triage/classify", worktreeRoot: tmp });

    writeReceipt(tmp, "plan", "understand", {
      version: 1,
      step: "plan/understand",
      timestamp: new Date().toISOString(),
      criteria: [{ id: "C1", description: "x" }],
    });
    runCommand({ finished: "plan/understand", worktreeRoot: tmp });

    writeReceipt(tmp, "plan", "design", {
      version: 1,
      step: "plan/design",
      timestamp: new Date().toISOString(),
      blueprint_section: "### Plan: Final",
    });
    runCommand({ finished: "plan/design", worktreeRoot: tmp });

    writeReceipt(tmp, "plan", "audit", {
      version: 1,
      step: "plan/audit",
      timestamp: new Date().toISOString(),
      gaps: [{ id: "G1", where: "blueprint", description: "missing X" }],
    });

    const result = runCommand({ finished: "plan/audit", worktreeRoot: tmp });
    // Loopback target is plan/design — `run` collapses to the next spawn there.
    assert.equal(result.action, "spawn_agent");
    if (result.action === "spawn_agent") {
      assert.equal(result.phase, "plan");
      assert.equal(result.step, "design");
    }
  });
});
