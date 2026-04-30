import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { SKILL_DIR_PREFIX } from "../config/constants.js";
import { PHASE_NAMES } from "../state/schema.js";
import { STATE_DIR, STATE_FILE } from "../state/store.js";
import { bold, dim, green, red, yellow } from "../utils/colors.js";

const WORK_KIT_SKILLS = [
  "full-kit",
  "auto-kit",
  "cancel-kit",
  "pause-kit",
  "resume-kit",
  ...PHASE_NAMES.map((p) => `${SKILL_DIR_PREFIX}${p}`),
  `${SKILL_DIR_PREFIX}bootstrap`,
];

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function removeDir(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

export async function uninstallCommand(targetPath?: string): Promise<void> {
  const projectDir = targetPath ? path.resolve(targetPath) : process.cwd();
  const skillsDir = path.join(projectDir, ".claude", "skills");

  if (!fs.existsSync(skillsDir)) {
    console.error(red("No .claude/skills/ directory found. Nothing to uninstall."));
    process.exit(1);
  }

  // Check which work-kit skills are installed
  const installed: string[] = [];
  for (const skill of WORK_KIT_SKILLS) {
    const skillPath = path.join(skillsDir, skill);
    if (fs.existsSync(skillPath)) {
      installed.push(skill);
    }
  }

  if (installed.length === 0) {
    console.error(dim("No work-kit skills found in this project."));
    return;
  }

  console.error(`\nFound ${bold(String(installed.length))} work-kit skills in ${bold(projectDir)}:`);
  for (const skill of installed) {
    console.error(`  ${skill}/`);
  }

  // Check for active state
  const trackerFile = path.join(projectDir, STATE_DIR, STATE_FILE);
  if (fs.existsSync(trackerFile)) {
    console.error(yellow(`\nWarning: Active work-kit state found (${STATE_DIR}/${STATE_FILE}).`));
    console.error(yellow("Uninstalling will not remove in-progress state files."));
  }

  const answer = await promptUser("\nRemove all work-kit skills? (y/N): ");
  if (answer.toLowerCase() !== "y") {
    console.error(dim("Cancelled."));
    return;
  }

  // Remove skill directories
  let removed = 0;
  for (const skill of installed) {
    const skillPath = path.join(skillsDir, skill);
    if (removeDir(skillPath)) {
      console.error(`  ${red("-")} ${skill}/`);
      removed++;
    }
  }

  console.error(`\n${green(bold(`Removed ${removed} work-kit skill(s).`))}`);

  // Check if .claude/skills/ is now empty
  if (fs.existsSync(skillsDir)) {
    const remaining = fs.readdirSync(skillsDir);
    if (remaining.length === 0) {
      fs.rmdirSync(skillsDir);
      console.error(dim("Removed empty .claude/skills/ directory."));
    } else {
      console.error(dim(`${remaining.length} other skill(s) remain in .claude/skills/.`));
    }
  }
}
