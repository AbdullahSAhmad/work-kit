import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { findWorktreeRoot, readState, stateExists } from "../state/store.js";

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
  const phases = ["wk-define", "wk-plan", "wk-build", "wk-test", "wk-review", "wk-deploy", "wk-wrap-up", "wk-debug"];
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

  // 3b. Chrome DevTools MCP availability (used by test/browser).
  // Warn-only: if missing, the browser step skips itself but the rest of the
  // pipeline runs unaffected.
  const cdpMcpAvailable = detectChromeDevtoolsMcp();
  if (cdpMcpAvailable === "yes") {
    checks.push({ name: "mcp:chrome-devtools", status: "pass", message: "Chrome DevTools MCP detected" });
  } else if (cdpMcpAvailable === "unknown") {
    checks.push({
      name: "mcp:chrome-devtools",
      status: "warn",
      message: "Chrome DevTools MCP could not be detected. The test/browser step will be skipped if invoked.",
    });
  } else {
    checks.push({
      name: "mcp:chrome-devtools",
      status: "warn",
      message: "Chrome DevTools MCP not configured. test/browser will skip — install the MCP server to enable live browser verification.",
    });
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
  if (root && stateExists(root)) {
    try {
      const state = readState(root);
      if (state.version === 3 && state.slug && state.status) {
        checks.push({ name: "state", status: "pass", message: `Active work-kit: "${state.slug}" (${state.status})` });
      } else {
        checks.push({ name: "state", status: "warn", message: "tracker.json exists but has unexpected structure" });
      }
    } catch (e: any) {
      checks.push({ name: "state", status: "warn", message: `tracker.json error: ${e.message}` });
    }
  } else {
    checks.push({ name: "state", status: "pass", message: "No active work-kit (OK — run `work-kit init` to start)" });
  }

  const ok = checks.every((c) => c.status !== "fail");
  return { ok, checks };
}

/**
 * Best-effort detection of the Chrome DevTools MCP server. We can't call MCP
 * tools from the CLI, so we scan the most common config trails for any
 * chrome-devtools-flavored server entry. Returns "yes" on a hit, "no" if a
 * config exists but doesn't mention it, and "unknown" if no config exists.
 */
function detectChromeDevtoolsMcp(): "yes" | "no" | "unknown" {
  const claudeDir = path.join(os.homedir(), ".claude");
  const candidates = [
    path.join(claudeDir, "settings.json"),
    path.join(claudeDir, "mcp.json"),
    path.join(process.cwd(), ".mcp.json"),
  ];

  let sawAny = false;
  for (const file of candidates) {
    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf-8");
    } catch {
      continue; // missing or unreadable — skip
    }
    sawAny = true;
    if (/chrome[-_]?devtools/i.test(raw)) return "yes";
  }
  return sawAny ? "no" : "unknown";
}
