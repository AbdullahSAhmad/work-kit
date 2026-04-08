import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { bootstrapCommand } from "./bootstrap.js";
import { initCommand } from "./init.js";
import { learnCommand } from "./learn.js";

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `work-kit-test-${randomUUID()}`);
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

describe("bootstrapCommand", () => {
  it("returns inactive when no state exists", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    const result = bootstrapCommand(tmp);
    assert.equal(result.active, false);
    assert.ok(result.nextAction?.includes("/full-kit"));
  });

  it("returns active state after init", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "Test feature",
      worktreeRoot: tmp,
    });

    const result = bootstrapCommand(tmp);
    assert.equal(result.active, true);
    assert.equal(result.slug, "test-feature");
    assert.equal(result.mode, "full-kit");
    assert.equal(result.status, "in-progress");
    assert.equal(result.phase, "define");
    assert.equal(result.recovery, null);
  });

  it("detects stale state", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "Stale test",
      worktreeRoot: tmp,
    });

    // Backdate the tracker.json file to 3 hours ago
    const stateFile = path.join(tmp, ".work-kit", "tracker.json");
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    fs.utimesSync(stateFile, threeHoursAgo, threeHoursAgo);

    const result = bootstrapCommand(tmp);
    assert.equal(result.active, true);
    assert.ok(result.recovery !== null);
    assert.ok(result.recovery?.includes("stale"));
  });

  it("reports completed state", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "Done feature",
      worktreeRoot: tmp,
    });

    // Manually set status to completed
    const stateFile = path.join(tmp, ".work-kit", "tracker.json");
    const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    state.status = "completed";
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

    const result = bootstrapCommand(tmp);
    assert.equal(result.active, true);
    assert.equal(result.status, "completed");
    assert.ok(result.nextAction?.includes("complete"));
  });

  it("injects knowledge field when knowledge files exist", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "Knowledge test",
      worktreeRoot: tmp,
    });

    // Write entries to lessons, conventions, risks, and workflow
    learnCommand({ type: "lesson", text: "A useful lesson", worktreeRoot: tmp });
    learnCommand({ type: "convention", text: "A coding convention", worktreeRoot: tmp });
    learnCommand({ type: "risk", text: "A fragile area", worktreeRoot: tmp });
    learnCommand({ type: "workflow", text: "Workflow feedback", worktreeRoot: tmp });

    const result = bootstrapCommand(tmp);
    assert.ok(result.knowledge, "knowledge field should be present");
    assert.ok(result.knowledge?.lessons?.includes("A useful lesson"));
    assert.ok(result.knowledge?.conventions?.includes("A coding convention"));
    assert.ok(result.knowledge?.risks?.includes("A fragile area"));
    // workflow.md is intentionally NOT injected
    assert.equal((result.knowledge as any).workflow, undefined);
  });

  it("does not inject knowledge field when no knowledge files exist", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "No knowledge test",
      worktreeRoot: tmp,
    });

    const result = bootstrapCommand(tmp);
    assert.equal(result.knowledge, undefined);
  });

  it("reports failed state", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "Failed feature",
      worktreeRoot: tmp,
    });

    const stateFile = path.join(tmp, ".work-kit", "tracker.json");
    const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    state.status = "failed";
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

    const result = bootstrapCommand(tmp);
    assert.equal(result.active, true);
    assert.equal(result.status, "failed");
    assert.ok(result.nextAction?.includes("failed"));
  });
});
