import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { resolveModel, BY_PHASE, BY_STEP } from "./model-routing.js";
import type { WorkKitState, ModelPolicy, Classification } from "../state/schema.js";

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `wk-model-routing-${randomUUID()}`);
  fs.mkdirSync(path.join(dir, ".work-kit"), { recursive: true });
  return dir;
}

let tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

function fakeState(opts: {
  worktreeRoot: string;
  policy?: ModelPolicy;
  classification?: Classification;
  mode?: "auto-kit" | "full-kit";
}): Pick<WorkKitState, "modelPolicy" | "classification" | "mode"> & { metadata: { worktreeRoot: string } } {
  return {
    modelPolicy: opts.policy,
    classification: opts.classification,
    mode: (opts.mode ?? "full-kit") as any,
    metadata: { worktreeRoot: opts.worktreeRoot },
  };
}

describe("resolveModel — defaults", () => {
  it("uses step default when no policy or override", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({ worktreeRoot: tmp });
    assert.equal(resolveModel(state, "plan", "investigate"), "opus");
    assert.equal(resolveModel(state, "build", "commit"), "haiku");
    assert.equal(resolveModel(state, "review", "security"), "opus");
  });

  it("falls back to phase default for unknown step", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({ worktreeRoot: tmp });
    // Pick a phase/step that isn't in BY_STEP
    const key = "plan/__nonexistent__";
    assert.ok(!(key in BY_STEP));
    assert.equal(resolveModel(state, "plan", "__nonexistent__"), BY_PHASE.plan);
  });
});

describe("resolveModel — session policy", () => {
  it("policy=opus forces opus for every step, even mechanical ones", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({ worktreeRoot: tmp, policy: "opus" });
    assert.equal(resolveModel(state, "build", "commit"), "opus");
    assert.equal(resolveModel(state, "deploy", "monitor"), "opus");
    assert.equal(resolveModel(state, "plan", "investigate"), "opus");
  });

  it("policy=haiku forces haiku everywhere", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({ worktreeRoot: tmp, policy: "haiku" });
    assert.equal(resolveModel(state, "plan", "investigate"), "haiku");
    assert.equal(resolveModel(state, "review", "security"), "haiku");
  });

  it("policy=inherit returns undefined so no model is passed", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({ worktreeRoot: tmp, policy: "inherit" });
    assert.equal(resolveModel(state, "plan", "investigate"), undefined);
    assert.equal(resolveModel(state, "build", "core"), undefined);
    assert.equal(resolveModel(state, "deploy", "merge"), undefined);
  });

  it("policy=auto is equivalent to omitting it", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const autoState = fakeState({ worktreeRoot: tmp, policy: "auto" });
    const unsetState = fakeState({ worktreeRoot: tmp });
    assert.equal(
      resolveModel(autoState, "plan", "investigate"),
      resolveModel(unsetState, "plan", "investigate")
    );
  });
});

describe("resolveModel — classification", () => {
  it("small-change knocks plan/investigate down to haiku in auto-kit mode", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({
      worktreeRoot: tmp,
      classification: "small-change",
      mode: "auto-kit",
    });
    assert.equal(resolveModel(state, "plan", "investigate"), "haiku");
  });

  it("bug-fix keeps plan/investigate on opus (not in its override map)", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({
      worktreeRoot: tmp,
      classification: "bug-fix",
      mode: "auto-kit",
    });
    assert.equal(resolveModel(state, "plan", "investigate"), "opus");
    assert.equal(resolveModel(state, "plan", "blueprint"), "sonnet");
  });

  it("refactor promotes review/performance to opus", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({
      worktreeRoot: tmp,
      classification: "refactor",
      mode: "auto-kit",
    });
    assert.equal(resolveModel(state, "review", "performance"), "opus");
  });

  it("classification overrides are ignored in full-kit mode", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({
      worktreeRoot: tmp,
      classification: "small-change",
      mode: "full-kit",
    });
    assert.equal(resolveModel(state, "plan", "investigate"), "opus");
  });

  it("session policy beats classification override", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    const state = fakeState({
      worktreeRoot: tmp,
      classification: "small-change",
      mode: "auto-kit",
      policy: "opus",
    });
    assert.equal(resolveModel(state, "plan", "investigate"), "opus");
  });
});

describe("resolveModel — workspace JSON override", () => {
  it("workspace model-config.json beats session policy", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, ".work-kit", "model-config.json"),
      JSON.stringify({ "build/commit": "sonnet" })
    );
    const state = fakeState({ worktreeRoot: tmp, policy: "opus" });
    assert.equal(resolveModel(state, "build", "commit"), "sonnet");
    // Other steps still forced to opus by the policy
    assert.equal(resolveModel(state, "plan", "investigate"), "opus");
  });

  it("workspace JSON beats step default", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, ".work-kit", "model-config.json"),
      JSON.stringify({ "plan/investigate": "haiku" })
    );
    const state = fakeState({ worktreeRoot: tmp });
    assert.equal(resolveModel(state, "plan", "investigate"), "haiku");
  });

  it("malformed JSON falls back silently to defaults", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, ".work-kit", "model-config.json"),
      "{not json"
    );
    const state = fakeState({ worktreeRoot: tmp });
    assert.equal(resolveModel(state, "plan", "investigate"), "opus");
  });

  it("invalid tier values in JSON are ignored", () => {
    const tmp = makeTmpDir(); tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, ".work-kit", "model-config.json"),
      JSON.stringify({ "plan/investigate": "turbo", "build/core": "opus" })
    );
    const state = fakeState({ worktreeRoot: tmp });
    // Bad value ignored → falls back to step default
    assert.equal(resolveModel(state, "plan", "investigate"), "opus");
    // Good value applied
    assert.equal(resolveModel(state, "build", "core"), "opus");
  });
});
