import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { doctorCommand } from "./doctor.js";

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
    console.error(`Installing to current project: ${projectDir}`);
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
        console.error(`  ${i + 1}. ${projects[i].path}`);
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
      console.error(`  + ${f}`);
    }
  }
  if (skipped.length > 0) {
    console.error(`  (${skipped.length} files unchanged)`);
  }
  if (copied.length === 0 && skipped.length > 0) {
    console.error("  Already up to date.");
  }

  // Run doctor against the target project
  console.error("\nRunning doctor...");
  const result = doctorCommand(projectDir);
  for (const check of result.checks) {
    const icon = check.status === "pass" ? "\u2713" : check.status === "warn" ? "!" : "\u2717";
    console.error(`  ${icon} ${check.name}: ${check.message}`);
  }

  console.error();
  if (result.ok) {
    console.error("Ready. Use /full-kit or /auto-kit in Claude Code.");
  } else {
    console.error("Setup complete but some checks failed. Review the issues above.");
  }
}
