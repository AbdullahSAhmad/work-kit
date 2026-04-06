import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { initCommand } from "./init.js";
import { pauseCommand } from "./pause.js";
import { resumeCommand } from "./resume.js";
import { nextCommand } from "./next.js";
import { bootstrapCommand } from "./bootstrap.js";
import { completeCommand } from "./complete.js";

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `work-kit-pause-${randomUUID()}`);
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

describe("pause / resume", () => {
  it("pause flips status and records timestamp", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Pause test", worktreeRoot: tmp });

    const result = pauseCommand("lunch", tmp);
    assert.equal(result.action, "paused");

    const tracker = JSON.parse(fs.readFileSync(path.join(tmp, ".work-kit", "tracker.json"), "utf-8"));
    assert.equal(tracker.status, "paused");
    assert.ok(tracker.pausedAt);
  });

  it("pause is idempotent — second pause errors", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Double pause", worktreeRoot: tmp });

    pauseCommand(undefined, tmp);
    const result = pauseCommand(undefined, tmp);
    assert.equal(result.action, "error");
  });

  it("resume flips status back and clears pausedAt", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Resume test", worktreeRoot: tmp });
    pauseCommand(undefined, tmp);

    const result = resumeCommand(tmp);
    assert.equal(result.action, "resumed");

    const tracker = JSON.parse(fs.readFileSync(path.join(tmp, ".work-kit", "tracker.json"), "utf-8"));
    assert.equal(tracker.status, "in-progress");
    assert.equal(tracker.pausedAt, undefined);
  });

  it("resume on already in-progress is idempotent", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Already running", worktreeRoot: tmp });

    const result = resumeCommand(tmp);
    assert.equal(result.action, "resumed");
  });

  it("next refuses to advance a paused session", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Paused next", worktreeRoot: tmp });
    pauseCommand(undefined, tmp);

    const result = nextCommand(tmp);
    assert.equal(result.action, "error");
    if (result.action === "error") {
      assert.ok(result.message.includes("paused"));
    }
  });

  it("bootstrap --auto-resume flips paused → in-progress", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Auto resume", worktreeRoot: tmp });
    pauseCommand(undefined, tmp);

    const result = bootstrapCommand(tmp, { autoResume: true });
    assert.equal(result.status, "in-progress");
    assert.equal(result.resumed, true);
  });

  it("bootstrap without --auto-resume leaves paused state alone", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "No auto", worktreeRoot: tmp });
    pauseCommand(undefined, tmp);

    const result = bootstrapCommand(tmp);
    assert.equal(result.status, "paused");
    assert.notEqual(result.resumed, true);
  });
});

describe("complete outcome validation", () => {
  it("rejects invalid outcomes", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Outcome test", worktreeRoot: tmp });

    const result = completeCommand("plan/clarify", "totally-bogus", tmp);
    assert.equal(result.action, "error");
    if (result.action === "error") {
      assert.ok(result.message.includes("Invalid outcome"));
    }
  });

  it("accepts known outcomes", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "Outcome ok", worktreeRoot: tmp });

    const result = completeCommand("plan/clarify", "done", tmp);
    assert.notEqual(result.action, "error");
  });

  it("accepts undefined outcome", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    initCommand({ mode: "full", description: "No outcome", worktreeRoot: tmp });

    const result = completeCommand("plan/clarify", undefined, tmp);
    assert.notEqual(result.action, "error");
  });
});
