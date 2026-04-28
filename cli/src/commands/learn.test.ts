import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { initCommand } from "./init.js";
import { learnCommand } from "./learn.js";
import { extractCommand } from "./extract.js";
import { KNOWLEDGE_DIR, AUTO_BLOCK_START, AUTO_BLOCK_END } from "../utils/knowledge.js";

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

function setupSession(tmp: string) {
  initCommand({
    mode: "full",
    description: "Test feature",
    worktreeRoot: tmp,
  });
}

describe("learnCommand", () => {
  it("rejects invalid type", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);
    const r = learnCommand({ type: "garbage", text: "x", worktreeRoot: tmp });
    assert.equal(r.action, "error");
  });

  it("rejects empty text", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);
    const r = learnCommand({ type: "lesson", text: "   ", worktreeRoot: tmp });
    assert.equal(r.action, "error");
  });

  it("appends a lesson and creates auto-block markers", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    const r = learnCommand({
      type: "lesson",
      text: "Test fixtures must be reset between Playwright suites.",
      worktreeRoot: tmp,
    });

    assert.equal(r.action, "learned");
    assert.equal(r.file, "lessons.md");

    const lessonsPath = path.join(tmp, KNOWLEDGE_DIR, "lessons.md");
    assert.ok(fs.existsSync(lessonsPath));
    const content = fs.readFileSync(lessonsPath, "utf-8");
    assert.ok(content.includes(AUTO_BLOCK_START));
    assert.ok(content.includes(AUTO_BLOCK_END));
    assert.ok(content.includes("Test fixtures must be reset"));
  });

  it("routes each type to its own file", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    learnCommand({ type: "lesson", text: "L", worktreeRoot: tmp });
    learnCommand({ type: "convention", text: "C", worktreeRoot: tmp });
    learnCommand({ type: "risk", text: "R", worktreeRoot: tmp });
    learnCommand({ type: "workflow", text: "W", worktreeRoot: tmp });

    const dir = path.join(tmp, KNOWLEDGE_DIR);
    assert.ok(fs.readFileSync(path.join(dir, "lessons.md"), "utf-8").includes("L"));
    assert.ok(fs.readFileSync(path.join(dir, "conventions.md"), "utf-8").includes("C"));
    assert.ok(fs.readFileSync(path.join(dir, "risks.md"), "utf-8").includes("R"));
    assert.ok(fs.readFileSync(path.join(dir, "workflow.md"), "utf-8").includes("W"));
  });

  it("redacts secrets in text before writing", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    const r = learnCommand({
      type: "lesson",
      text: "API key is sk-abc123def456ghi789jkl012mno345 leaked here",
      worktreeRoot: tmp,
    });

    assert.equal(r.action, "learned");
    assert.equal(r.redacted, true);
    assert.ok((r.redactedKinds ?? []).includes("openai-style"));

    const content = fs.readFileSync(
      path.join(tmp, KNOWLEDGE_DIR, "lessons.md"),
      "utf-8"
    );
    assert.ok(content.includes("[REDACTED]"));
    assert.ok(!content.includes("sk-abc123def456ghi789"));
  });

  it("is idempotent on identical entries (returns duplicate)", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    const first = learnCommand({ type: "risk", text: "Same text", worktreeRoot: tmp });
    const second = learnCommand({ type: "risk", text: "Same text", worktreeRoot: tmp });

    assert.equal(first.action, "learned");
    assert.equal(second.action, "duplicate");

    const content = fs.readFileSync(
      path.join(tmp, KNOWLEDGE_DIR, "risks.md"),
      "utf-8"
    );
    // Only one entry should exist
    const matches = content.match(/Same text/g) ?? [];
    assert.equal(matches.length, 1);
  });

  it("auto-fills phase and step from tracker.json", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    learnCommand({
      type: "lesson",
      text: "Phase auto-fill check",
      worktreeRoot: tmp,
    });

    const content = fs.readFileSync(
      path.join(tmp, KNOWLEDGE_DIR, "lessons.md"),
      "utf-8"
    );
    // Full-kit init now starts at triage/classify (Triage is the first phase)
    assert.ok(content.includes("triage/classify"));
  });

  it("extracts typed bullets from state.md ## Observations", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    // Inject typed bullets into the existing ## Observations section
    const stateMdPath = path.join(tmp, ".work-kit", "state.md");
    const original = fs.readFileSync(stateMdPath, "utf-8");
    const injected = original.replace(
      "\n## Deviations",
      "\n- [risk] foo.ts is fragile\n- [convention] All inputs validated via Zod\n- [workflow:test/e2e] e2e step needs server\n- [lesson] We discovered something useful\n\n## Deviations"
    );
    fs.writeFileSync(stateMdPath, injected);

    const r = extractCommand({ worktreeRoot: tmp });
    assert.equal(r.action, "extracted");
    // 4 typed observation bullets, all should route
    assert.equal(r.byType.risk, 1);
    assert.equal(r.byType.convention, 1);
    assert.equal(r.byType.workflow, 1, "workflow:test/e2e bullet should be routed (regression: digit in step name)");
    assert.equal(r.byType.lesson, 1);

    const workflowMd = fs.readFileSync(path.join(tmp, KNOWLEDGE_DIR, "workflow.md"), "utf-8");
    assert.ok(workflowMd.includes("e2e step needs server"));
  });

  it("ignores bullets under ## Decisions and ## Deviations", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    // Simulate an agent dumping test-plan noise into Decisions/Deviations.
    // None of these should be harvested — only ## Observations is auto-routed.
    const stateMdPath = path.join(tmp, ".work-kit", "state.md");
    const original = fs.readFileSync(stateMdPath, "utf-8");
    const injected = original
      .replace(
        "## Decisions\n<!-- Append here whenever you choose between real alternatives -->",
        "## Decisions\n<!-- Append here whenever you choose between real alternatives -->\n- Picked Zod over Yup\n- Use Firestore onSnapshot\n- **Expected:** Badge renders X / Y"
      )
      .replace(
        "## Deviations\n<!-- Append here whenever implementation diverges from the Blueprint -->",
        "## Deviations\n<!-- Append here whenever implementation diverges from the Blueprint -->\n- Navigate to / and verify cards render\n- Check badge shows 0 / 0\n- **Flow 3:** Pass"
      );
    fs.writeFileSync(stateMdPath, injected);

    const r = extractCommand({ worktreeRoot: tmp });
    assert.equal(r.action, "extracted");
    assert.equal(r.written, 0, "no bullets from Decisions/Deviations should be harvested");
    assert.equal(r.byType.convention, 0);
    assert.equal(r.byType.workflow, 0);
  });

  it("extract is idempotent (re-run produces only duplicates)", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    const stateMdPath = path.join(tmp, ".work-kit", "state.md");
    const original = fs.readFileSync(stateMdPath, "utf-8");
    fs.writeFileSync(
      stateMdPath,
      original.replace("\n## Deviations", "\n- [risk] one\n- [risk] two\n\n## Deviations")
    );

    const first = extractCommand({ worktreeRoot: tmp });
    const second = extractCommand({ worktreeRoot: tmp });

    assert.equal(first.written, 2);
    assert.equal(first.duplicates, 0);
    assert.equal(second.written, 0);
    assert.equal(second.duplicates, 2);
  });

  it("does not contaminate the Manual section", () => {
    const tmp = makeTmpDir();
    tmpDirs.push(tmp);
    setupSession(tmp);

    learnCommand({ type: "lesson", text: "Auto only", worktreeRoot: tmp });

    const content = fs.readFileSync(
      path.join(tmp, KNOWLEDGE_DIR, "lessons.md"),
      "utf-8"
    );
    // Find the Manual section and ensure the entry isn't in it
    const manualIdx = content.indexOf("## Manual");
    assert.ok(manualIdx > -1);
    const manualSection = content.slice(manualIdx);
    assert.ok(!manualSection.includes("Auto only"));
  });
});
