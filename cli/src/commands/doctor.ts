import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { findWorktreeRoot, readState } from "../state/store.js";

interface Check {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

export function doctorCommand(worktreeRoot?: string): { ok: boolean; checks: Check[] } {
  const checks: Check[] = [];

  // 1. Node.js version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1), 10);
  if (major >= 18) {
    checks.push({ name: "node", status: "pass", message: `Node.js ${nodeVersion}` });
  } else {
    checks.push({ name: "node", status: "fail", message: `Node.js ${nodeVersion} — requires >= 18` });
  }

  // 2. Skills installed
  const cwd = worktreeRoot || process.cwd();
  const skillsDir = path.join(cwd, ".claude", "skills");
  const requiredSkills = ["full-kit", "auto-kit"];
  for (const skill of requiredSkills) {
    const skillPath = path.join(skillsDir, skill, "SKILL.md");
    if (fs.existsSync(skillPath)) {
      checks.push({ name: `skill:${skill}`, status: "pass", message: `${skill}/SKILL.md found` });
    } else {
      checks.push({ name: `skill:${skill}`, status: "fail", message: `${skill}/SKILL.md not found at ${skillPath}` });
    }
  }

  // 3. Phase skill files
  const phases = ["plan", "build", "test", "review", "deploy", "wrap-up"];
  let phasesMissing = 0;
  for (const phase of phases) {
    const phasePath = path.join(skillsDir, phase, "SKILL.md");
    if (!fs.existsSync(phasePath)) {
      phasesMissing++;
    }
  }
  if (phasesMissing === 0) {
    checks.push({ name: "skill:phases", status: "pass", message: `All ${phases.length} phase skills found` });
  } else {
    checks.push({ name: "skill:phases", status: "fail", message: `${phasesMissing} phase skill(s) missing from ${skillsDir}` });
  }

  // 4. Git available
  try {
    const gitVersion = execFileSync("git", ["--version"], { encoding: "utf-8" }).trim();
    checks.push({ name: "git", status: "pass", message: gitVersion });
  } catch {
    checks.push({ name: "git", status: "fail", message: "git not found in PATH" });
  }

  // 5. State file health (if in a worktree)
  const root = worktreeRoot ? worktreeRoot : findWorktreeRoot();
  if (root) {
    try {
      const state = readState(root);
      if (state.version === 1 && state.slug && state.status) {
        checks.push({ name: "state", status: "pass", message: `Active work-kit: "${state.slug}" (${state.status})` });
      } else {
        checks.push({ name: "state", status: "warn", message: "state.json exists but has unexpected structure" });
      }
    } catch (e: any) {
      checks.push({ name: "state", status: "warn", message: `state.json error: ${e.message}` });
    }
  } else {
    checks.push({ name: "state", status: "pass", message: "No active worktree (OK — run `work-kit init` to start)" });
  }

  const ok = checks.every((c) => c.status !== "fail");
  return { ok, checks };
}
