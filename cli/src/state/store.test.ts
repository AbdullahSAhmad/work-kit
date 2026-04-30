import * as assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import type { WorkKitState } from "./schema.js";
import { readState, STATE_DIR, STATE_FILE, writeState } from "./store.js";

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `work-kit-store-test-${randomUUID()}`);
  fs.mkdirSync(path.join(dir, STATE_DIR), { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

function writeRaw(root: string, raw: unknown): void {
  fs.writeFileSync(path.join(root, STATE_DIR, STATE_FILE), JSON.stringify(raw, null, 2));
}

function validState(): WorkKitState {
  return {
    version: 4,
    slug: "demo",
    branch: "wk/demo",
    started: new Date().toISOString(),
    mode: "full-kit",
    status: "in-progress",
    currentPhase: "triage",
    currentStep: "classify",
    phases: {
      triage: { status: "in-progress", steps: { classify: { status: "in-progress" } } },
      plan: {
        status: "pending",
        steps: { understand: { status: "pending" }, design: { status: "pending" }, audit: { status: "pending" } },
      },
      build: {
        status: "pending",
        steps: { setup: { status: "pending" }, implement: { status: "pending" }, commit: { status: "pending" } },
      },
      test: { status: "pending", steps: { exercise: { status: "pending" }, validate: { status: "pending" } } },
      review: {
        status: "pending",
        steps: { scope: { status: "pending" }, review: { status: "pending" }, resolve: { status: "pending" } },
      },
      deploy: { status: "pending", steps: { ship: { status: "pending" } } },
      "wrap-up": { status: "pending", steps: {} },
    },
    loopbacks: [],
    metadata: { worktreeRoot: "/tmp/x", mainRepoRoot: "/tmp/x" },
  };
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

describe("readState validation", () => {
  it("accepts a well-formed v4 tracker", () => {
    const tmp = makeTmpDir();
    writeState(tmp, validState());
    const got = readState(tmp);
    assert.equal(got.slug, "demo");
    assert.equal(got.version, 4);
  });

  it("throws on invalid JSON", () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, STATE_DIR, STATE_FILE), "{not json");
    assert.throws(() => readState(tmp), /invalid JSON/);
  });

  it("rejects wrong version after migration", () => {
    const tmp = makeTmpDir();
    const s = validState() as unknown as Record<string, unknown>;
    s.version = 99;
    writeRaw(tmp, s);
    assert.throws(() => readState(tmp), /version must be 4/);
  });

  it("rejects invalid mode", () => {
    const tmp = makeTmpDir();
    const s = validState() as unknown as Record<string, unknown>;
    s.mode = "fast-kit";
    writeRaw(tmp, s);
    assert.throws(() => readState(tmp), /mode must be/);
  });

  it("rejects invalid status", () => {
    const tmp = makeTmpDir();
    const s = validState() as unknown as Record<string, unknown>;
    s.status = "exploding";
    writeRaw(tmp, s);
    assert.throws(() => readState(tmp), /status must be one of/);
  });

  it("collects multiple errors in one throw", () => {
    const tmp = makeTmpDir();
    const s = validState() as unknown as Record<string, unknown>;
    s.slug = "";
    s.mode = "x";
    writeRaw(tmp, s);
    try {
      readState(tmp);
      assert.fail("should have thrown");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      assert.ok(msg.includes("slug"));
      assert.ok(msg.includes("mode"));
    }
  });

  it("accepts optional fields when set correctly", () => {
    const tmp = makeTmpDir();
    const s = validState();
    s.classification = "feature";
    s.modelPolicy = "opus";
    writeState(tmp, s);
    const got = readState(tmp);
    assert.equal(got.classification, "feature");
    assert.equal(got.modelPolicy, "opus");
  });

  it("rejects invalid optional classification", () => {
    const tmp = makeTmpDir();
    const s = validState() as unknown as Record<string, unknown>;
    s.classification = "blah";
    writeRaw(tmp, s);
    assert.throws(() => readState(tmp), /classification/);
  });
});
