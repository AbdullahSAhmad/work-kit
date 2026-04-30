import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { bold, cyan, dim, green, red, yellow } from "../utils/colors.js";
import { ensureKnowledgeDir, KNOWLEDGE_DIR, KNOWLEDGE_LOCK } from "../utils/knowledge.js";
import { doctorCommand } from "./doctor.js";
import { ensureGitignored } from "./init.js";

const SKILLS_SOURCE = path.resolve(import.meta.dirname, "..", "..", "..", "skills");

function findClaudeProjects(): { name: string; path: string }[] {
  const claudeDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude", "projects");
  if (!fs.existsSync(claudeDir)) return [];

  const entries = fs.readdirSync(claudeDir, { withFileTypes: true });
  const projects: { name: string; path: string }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Convert directory name back to filesystem path: -home-user-project → /home/user/project
    const projectPath = entry.name.replace(/^-/, "/").replace(/-/g, "/");
    if (fs.existsSync(projectPath)) {
      projects.push({ name: path.basename(projectPath), path: projectPath });
    }
  }

  return projects.sort((a, b) => a.path.localeCompare(b.path));
}

function isClaudeProject(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".claude"));
}

function copySkills(targetDir: string): { copied: string[]; skipped: string[] } {
  const skillsTarget = path.join(targetDir, ".claude", "skills");
  const copied: string[] = [];
  const skipped: string[] = [];

  if (!fs.existsSync(SKILLS_SOURCE)) {
    throw new Error(`Skills source not found at ${SKILLS_SOURCE}. Is work-kit installed correctly?`);
  }

  function copyDir(src: string, dest: string, prefix: string = "") {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      const label = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath, label);
      } else {
        if (fs.existsSync(destPath)) {
          const srcContent = fs.readFileSync(srcPath, "utf-8");
          const destContent = fs.readFileSync(destPath, "utf-8");
          if (srcContent === destContent) {
            skipped.push(label);
            continue;
          }
        }
        fs.copyFileSync(srcPath, destPath);
        copied.push(label);
      }
    }
  }

  copyDir(SKILLS_SOURCE, skillsTarget);
  return { copied, skipped };
}

// ── Hooks installation ──────────────────────────────────────────────
//
// Writes marker files the observer polls to detect "blocked on user" state.
// Each hook command carries a sentinel comment so setup can be re-run
// idempotently — existing work-kit entries are stripped and re-added.

const HOOK_SENTINEL = "# work-kit-hook";

type HookEntry = { type: "command"; command: string };
type HookMatcherGroup = { matcher?: string; hooks: HookEntry[] };
type HookSettings = Record<string, HookMatcherGroup[]>;

interface WorkKitHookSpec {
  event: string;
  matcher: string;
  command: string;
}

// Markers live under the per-worktree `.work-kit/` state dir.
// Hook commands run from Claude Code's CWD, which is the project/worktree root.
const WK_HOOKS: WorkKitHookSpec[] = [
  // PermissionRequest → agent blocked on a tool permission prompt
  {
    event: "PermissionRequest",
    matcher: "",
    command: `mkdir -p .work-kit && date -u +%s > .work-kit/awaiting-input ${HOOK_SENTINEL}`,
  },
  // AskUserQuestion tool call → agent explicitly asking the user
  {
    event: "PreToolUse",
    matcher: "AskUserQuestion",
    command: `mkdir -p .work-kit && date -u +%s > .work-kit/awaiting-input ${HOOK_SENTINEL}`,
  },
  {
    event: "PostToolUse",
    matcher: "AskUserQuestion",
    command: `rm -f .work-kit/awaiting-input ${HOOK_SENTINEL}`,
  },
  // Any tool call → clear idle marker (agent is active again)
  {
    event: "PreToolUse",
    matcher: "",
    command: `rm -f .work-kit/idle ${HOOK_SENTINEL}`,
  },
  // Stop → turn ended. Write idle marker (soft signal); also clear
  // any stale awaiting-input marker that wasn't paired with PostToolUse
  // (e.g. permission prompt was denied).
  {
    event: "Stop",
    matcher: "",
    command: `mkdir -p .work-kit && date -u +%s > .work-kit/idle && rm -f .work-kit/awaiting-input ${HOOK_SENTINEL}`,
  },
];

function stripWorkKitHooks(hooks: HookSettings): HookSettings {
  const cleaned: HookSettings = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const cleanedGroups: HookMatcherGroup[] = [];
    for (const group of groups) {
      const cleanedEntries = (group.hooks || []).filter(
        (h) => !(h.type === "command" && typeof h.command === "string" && h.command.includes(HOOK_SENTINEL)),
      );
      if (cleanedEntries.length > 0) {
        cleanedGroups.push({ ...group, hooks: cleanedEntries });
      }
    }
    if (cleanedGroups.length > 0) {
      cleaned[event] = cleanedGroups;
    }
  }
  return cleaned;
}

function addWorkKitHooks(hooks: HookSettings): HookSettings {
  const out: HookSettings = { ...hooks };
  for (const spec of WK_HOOKS) {
    const groups = out[spec.event] ? [...out[spec.event]] : [];
    const entry: HookEntry = { type: "command", command: spec.command };
    // Try to reuse an existing matcher group with the same matcher
    const existingIdx = groups.findIndex((g) => (g.matcher ?? "") === spec.matcher);
    if (existingIdx >= 0) {
      groups[existingIdx] = {
        ...groups[existingIdx],
        hooks: [...(groups[existingIdx].hooks || []), entry],
      };
    } else {
      groups.push({ matcher: spec.matcher, hooks: [entry] });
    }
    out[spec.event] = groups;
  }
  return out;
}

function installHooks(projectDir: string): { added: number; file: string } {
  const settingsDir = path.join(projectDir, ".claude");
  const settingsFile = path.join(settingsDir, "settings.json");

  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsFile)) {
    try {
      const raw = fs.readFileSync(settingsFile, "utf-8");
      settings = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      throw new Error(
        `Failed to parse ${settingsFile}: ${(err as Error).message}. Fix or remove the file and re-run setup.`,
      );
    }
  }

  const existingHooks: HookSettings =
    (settings.hooks && typeof settings.hooks === "object" ? (settings.hooks as HookSettings) : {}) ?? {};

  const stripped = stripWorkKitHooks(existingHooks);
  const merged = addWorkKitHooks(stripped);

  settings.hooks = merged;
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");

  return { added: WK_HOOKS.length, file: settingsFile };
}

// ── Playwright detection / install ─────────────────────────────────
//
// Work-kit's Test phase requires a real E2E framework. We standardize on
// Playwright. setup/upgrade detect whether the target project already has
// it; if not, we offer to install it (and optionally scaffold a config).

type PackageManager = "pnpm" | "yarn" | "npm";

function detectPackageManager(projectDir: string): PackageManager {
  if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn";
  return "npm";
}

function hasPlaywrightInstalled(projectDir: string): boolean {
  const pkgPath = path.join(projectDir, "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return Boolean(deps["@playwright/test"] || deps["playwright"]);
  } catch {
    return false;
  }
}

function hasPlaywrightConfig(projectDir: string): boolean {
  return ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs", "playwright.config.cjs"].some((f) =>
    fs.existsSync(path.join(projectDir, f)),
  );
}

function runStreamed(cmd: string, args: string[], cwd: string): boolean {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  return result.status === 0;
}

function installPlaywrightPackage(pm: PackageManager, projectDir: string): boolean {
  const args =
    pm === "pnpm"
      ? ["add", "-D", "@playwright/test"]
      : pm === "yarn"
        ? ["add", "-D", "@playwright/test"]
        : ["install", "-D", "@playwright/test"];
  console.error(`  ${dim(`$ ${pm} ${args.join(" ")}`)}`);
  if (runStreamed(pm, args, projectDir)) return true;

  // The most common npm failure here is ERESOLVE — the user's project has
  // a pre-existing peer-dep conflict that npm refuses to resolve. Retry with
  // --legacy-peer-deps so Playwright still installs; the user's underlying
  // conflict is left for them to fix separately.
  if (pm === "npm") {
    console.error(
      `  ${yellow("!")} npm install failed (likely peer-dep conflict). Retrying with --legacy-peer-deps...`,
    );
    const fallbackArgs = [...args, "--legacy-peer-deps"];
    console.error(`  ${dim(`$ ${pm} ${fallbackArgs.join(" ")}`)}`);
    if (runStreamed(pm, fallbackArgs, projectDir)) {
      console.error(
        `  ${dim("Note: installed with --legacy-peer-deps. Your project still has the original peer-dep conflict — fix it separately when convenient.")}`,
      );
      return true;
    }
  }

  return false;
}

function installPlaywrightBrowsers(projectDir: string): boolean {
  // Chromium-only — fastest install, covers most E2E needs.
  console.error(`  ${dim("$ npx playwright install chromium")}`);
  return runStreamed("npx", ["playwright", "install", "chromium"], projectDir);
}

function scaffoldPlaywrightConfig(pm: PackageManager, projectDir: string): boolean {
  // `npm init playwright@latest` works regardless of pm (it just runs the create-playwright bin).
  // Yarn/pnpm have their own equivalents but npm init is universally available.
  console.error(`  ${dim("$ npm init playwright@latest -- --quiet --browser=chromium --no-examples")}`);
  return runStreamed(
    "npm",
    ["init", "playwright@latest", "--", "--quiet", "--browser=chromium", "--no-examples"],
    projectDir,
  );
}

async function ensurePlaywright(projectDir: string): Promise<void> {
  console.error(`\nChecking Playwright (required for work-kit's E2E test step)...`);

  // Non-Node project — nothing to do.
  if (!fs.existsSync(path.join(projectDir, "package.json"))) {
    console.error(`  ${dim("No package.json found — skipping Playwright setup.")}`);
    return;
  }

  const pm = detectPackageManager(projectDir);
  const installed = hasPlaywrightInstalled(projectDir);
  const configured = hasPlaywrightConfig(projectDir);

  if (installed && configured) {
    console.error(`  ${green("\u2713")} Playwright already installed and configured.`);
    return;
  }

  if (!installed) {
    const answer = (await promptUser(`  Install Playwright (@playwright/test) via ${pm}? [y/N]: `)).toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      console.error(`  ${yellow("!")} Skipped. The wk-test E2E step will fail until Playwright is installed.`);
      return;
    }
    if (!installPlaywrightPackage(pm, projectDir)) {
      console.error(`  ${red("\u2717")} Failed to install @playwright/test.`);
      return;
    }
    if (!installPlaywrightBrowsers(projectDir)) {
      console.error(`  ${red("\u2717")} Failed to install Chromium browser.`);
      return;
    }
    console.error(`  ${green("+")} Installed @playwright/test and Chromium.`);
  }

  if (!hasPlaywrightConfig(projectDir)) {
    const answer = (await promptUser(`  No playwright.config found. Scaffold one now? [y/N]: `)).toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      console.error(`  ${yellow("!")} Skipped scaffolding. Create a playwright.config.ts before running wk-test.`);
      return;
    }
    if (!scaffoldPlaywrightConfig(pm, projectDir)) {
      console.error(`  ${red("\u2717")} Scaffolding failed. Run \`npm init playwright@latest\` manually.`);
      return;
    }
    console.error(`  ${green("+")} Playwright config scaffolded.`);
  }
}

// Project knowledge files (findings/workflow) are committed to the repo.
// Only the lockfile is gitignored.
function setupKnowledgeDir(projectDir: string): void {
  console.error(`\nScaffolding ${KNOWLEDGE_DIR}/ (project knowledge files)...`);
  try {
    const { created } = ensureKnowledgeDir(projectDir);
    if (created.length > 0) {
      for (const f of created) {
        console.error(`  ${green("+")} ${KNOWLEDGE_DIR}/${f}`);
      }
      console.error(`  ${yellow("!")} ${bold("These files are committed to your repo.")} Don't write secrets in them.`);
      console.error(
        `  ${dim("work-kit redacts known secret shapes at write time, but the regex sweep is best-effort.")}`,
      );
    } else {
      console.error(`  ${dim("Already scaffolded.")}`);
    }
    ensureGitignored(projectDir, `${KNOWLEDGE_DIR}/${KNOWLEDGE_LOCK}`);
  } catch (err) {
    console.error(`  ${red("\u2717")} ${(err as Error).message}`);
  }
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function setupCommand(targetPath?: string): Promise<void> {
  let projectDir: string;

  if (targetPath) {
    // Explicit path provided
    projectDir = path.resolve(targetPath);
    if (!fs.existsSync(projectDir)) {
      console.error(`Directory not found: ${projectDir}`);
      process.exit(1);
    }
  } else if (isClaudeProject(process.cwd())) {
    // Current directory is a Claude project
    projectDir = process.cwd();
    console.error(`Installing to current project: ${bold(projectDir)}`);
  } else {
    // Discover Claude projects and let user pick
    const projects = findClaudeProjects();

    if (projects.length === 0) {
      console.error("No Claude Code projects found on this machine.");
      const manual = await promptUser("Enter project path: ");
      if (!manual || !fs.existsSync(manual)) {
        console.error("Invalid path. Exiting.");
        process.exit(1);
      }
      projectDir = path.resolve(manual);
    } else {
      console.error("Found Claude Code projects:\n");
      for (let i = 0; i < projects.length; i++) {
        console.error(`  ${cyan(String(i + 1))}. ${projects[i].path}`);
      }
      console.error();

      const answer = await promptUser("Install work-kit skills to (number or path): ");
      const idx = parseInt(answer, 10);

      if (!isNaN(idx) && idx >= 1 && idx <= projects.length) {
        projectDir = projects[idx - 1].path;
      } else if (fs.existsSync(answer)) {
        projectDir = path.resolve(answer);
      } else {
        console.error("Invalid selection. Exiting.");
        process.exit(1);
      }
    }
  }

  // Copy skills
  console.error(`\nCopying skills to ${projectDir}/.claude/skills/...`);
  const { copied, skipped } = copySkills(projectDir);

  if (copied.length > 0) {
    for (const f of copied) {
      console.error(`  ${green("+")} ${f}`);
    }
  }
  if (skipped.length > 0) {
    console.error(`  (${skipped.length} files unchanged)`);
  }
  if (copied.length === 0 && skipped.length > 0) {
    console.error(`  ${dim("Already up to date.")}`);
  }

  // Install Claude Code hooks so the observer can detect "blocked on user" state
  console.error(`\nInstalling Claude Code hooks into ${projectDir}/.claude/settings.json...`);
  try {
    const { added, file } = installHooks(projectDir);
    console.error(
      `  ${green("+")} ${added} hook${added === 1 ? "" : "s"} merged into ${path.relative(projectDir, file) || file}`,
    );
    console.error(`  ${dim("Observer will now detect permission prompts and AskUserQuestion calls.")}`);
  } catch (err) {
    console.error(`  ${red("✗")} ${(err as Error).message}`);
  }

  // Ensure Playwright is available — wk-test's E2E step requires it.
  await ensurePlaywright(projectDir);

  // Scaffold the project-level knowledge directory.
  setupKnowledgeDir(projectDir);

  // Run doctor against the target project
  console.error("\nRunning doctor...");
  const result = doctorCommand(projectDir);
  for (const check of result.checks) {
    const icon = check.status === "pass" ? green("\u2713") : check.status === "warn" ? yellow("!") : red("\u2717");
    console.error(`  ${icon} ${bold(check.name)}: ${check.message}`);
  }

  console.error();
  if (result.ok) {
    console.error(green(bold("Ready. Use /full-kit or /auto-kit in Claude Code.")));
  } else {
    console.error(red("Setup complete but some checks failed. Review the issues above."));
  }
}
