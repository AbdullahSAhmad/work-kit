import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { loadProjectConfig } from "./project-config.js";
import { resolveParallelGroups, DEFAULT_PARALLEL_GROUPS } from "../workflow/parallel.js";
import { PROJECT_CONFIG_FILE } from "./constants.js";

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `wk-config-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

describe("loadProjectConfig", () => {
  it("returns empty config when file is missing", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    const config = loadProjectConfig(tmp);
    assert.deepStrictEqual(config, {});
  });

  it("loads valid defaults", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, PROJECT_CONFIG_FILE),
      JSON.stringify({ defaults: { mode: "auto", classification: "feature", gated: true } }),
    );
    const config = loadProjectConfig(tmp);
    assert.equal(config.defaults?.mode, "auto");
    assert.equal(config.defaults?.classification, "feature");
    assert.equal(config.defaults?.gated, true);
  });

  it("ignores invalid mode and classification", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, PROJECT_CONFIG_FILE),
      JSON.stringify({ defaults: { mode: "wat", classification: "nope" } }),
    );
    const config = loadProjectConfig(tmp);
    assert.equal(config.defaults?.mode, undefined);
    assert.equal(config.defaults?.classification, undefined);
  });

  it("loads parallel group overrides", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, PROJECT_CONFIG_FILE),
      JSON.stringify({
        parallel: {
          test: { parallel: ["exercise"], thenSequential: "validate" },
        },
      }),
    );
    const config = loadProjectConfig(tmp);
    assert.deepStrictEqual(config.parallel?.test, { parallel: ["exercise"], thenSequential: "validate" });
  });

  it("filters invalid step names from parallel overrides", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, PROJECT_CONFIG_FILE),
      JSON.stringify({
        parallel: { test: { parallel: ["exercise", "made-up"] } },
      }),
    );
    const config = loadProjectConfig(tmp);
    assert.deepStrictEqual(config.parallel?.test?.parallel, ["exercise"]);
  });

  it("validates workflow include/exclude refs", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, PROJECT_CONFIG_FILE),
      JSON.stringify({
        workflow: { include: ["wrap-up/knowledge", "bogus/step"], exclude: ["plan/audit"] },
      }),
    );
    const config = loadProjectConfig(tmp);
    assert.deepStrictEqual(config.workflow?.include, ["wrap-up/knowledge"]);
    assert.deepStrictEqual(config.workflow?.exclude, ["plan/audit"]);
  });

  it("survives invalid JSON", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    fs.writeFileSync(path.join(tmp, PROJECT_CONFIG_FILE), "not json");
    const config = loadProjectConfig(tmp);
    assert.deepStrictEqual(config, {});
  });
});

describe("resolveParallelGroups", () => {
  it("returns defaults with no project root", () => {
    assert.deepStrictEqual(resolveParallelGroups(), DEFAULT_PARALLEL_GROUPS);
  });

  it("merges project overrides over defaults", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    fs.writeFileSync(
      path.join(tmp, PROJECT_CONFIG_FILE),
      JSON.stringify({
        parallel: { test: { parallel: ["exercise"], thenSequential: "validate" } },
      }),
    );
    const groups = resolveParallelGroups(tmp);
    assert.deepStrictEqual(groups.test, { parallel: ["exercise"], thenSequential: "validate" });
    // No default groups remain (test/review fan out internally now), so merging
    // a single override yields exactly that one group.
    assert.deepStrictEqual(Object.keys(groups), ["test"]);
  });
});
