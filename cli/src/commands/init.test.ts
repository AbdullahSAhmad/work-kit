import * as assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import { initCommand } from "./init.js";

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

describe("initCommand", () => {
  it("creates tracker.json and state.md", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "Add user login",
      worktreeRoot: tmp,
    });

    assert.ok(fs.existsSync(path.join(tmp, ".work-kit", "tracker.json")));
    assert.ok(fs.existsSync(path.join(tmp, ".work-kit", "state.md")));

    const state = JSON.parse(fs.readFileSync(path.join(tmp, ".work-kit", "tracker.json"), "utf-8"));
    assert.equal(state.slug, "add-user-login");
    assert.equal(state.status, "in-progress");
    assert.equal(state.currentPhase, "triage");
    assert.equal(state.currentStep, "classify");
    assert.equal(state.version, 4);
  });

  it("returns spawn_agent action", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    const result = initCommand({
      mode: "full",
      description: "Add user login",
      worktreeRoot: tmp,
    });

    assert.equal(result.action, "spawn_agent");
  });

  it("blocks double init", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "First init",
      worktreeRoot: tmp,
    });

    const result = initCommand({
      mode: "full",
      description: "Second init",
      worktreeRoot: tmp,
    });

    assert.equal(result.action, "error");
    if (result.action === "error") {
      assert.ok(result.message.includes("already exists"));
    }
  });

  it("auto mode requires classification", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    const result = initCommand({
      mode: "auto",
      description: "Some task",
      worktreeRoot: tmp,
    });

    assert.equal(result.action, "error");
    if (result.action === "error") {
      assert.ok(result.message.includes("classification"));
    }
  });

  it("persists model policy when provided", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "Ship the avatar feature",
      modelPolicy: "opus",
      worktreeRoot: tmp,
    });

    const state = JSON.parse(fs.readFileSync(path.join(tmp, ".work-kit", "tracker.json"), "utf-8"));
    assert.equal(state.modelPolicy, "opus");
  });

  it("omits modelPolicy from state when defaulting to auto", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    initCommand({
      mode: "full",
      description: "Some default task",
      worktreeRoot: tmp,
    });

    const state = JSON.parse(fs.readFileSync(path.join(tmp, ".work-kit", "tracker.json"), "utf-8"));
    assert.equal(state.modelPolicy, undefined);
  });

  it("rejects invalid model policy", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    const result = initCommand({
      mode: "full",
      description: "Task with bad policy",
      modelPolicy: "turbo" as any,
      worktreeRoot: tmp,
    });

    assert.equal(result.action, "error");
    if (result.action === "error") {
      assert.ok(result.message.includes("model-policy"));
    }
  });

  it("auto mode with classification succeeds", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);

    const result = initCommand({
      mode: "auto",
      description: "Fix login bug",
      classification: "bug-fix",
      worktreeRoot: tmp,
    });

    assert.equal(result.action, "spawn_agent");

    const state = JSON.parse(fs.readFileSync(path.join(tmp, ".work-kit", "tracker.json"), "utf-8"));
    assert.equal(state.mode, "auto-kit");
    assert.equal(state.classification, "bug-fix");
  });
});
