#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { nextCommand } from "./commands/next.js";
import { completeCommand } from "./commands/complete.js";
import { validateCommand } from "./commands/validate.js";
import { contextCommand } from "./commands/context.js";
import { loopbackCommand } from "./commands/loopback.js";
import { workflowCommand } from "./commands/workflow.js";
import { doctorCommand } from "./commands/doctor.js";
import { setupCommand } from "./commands/setup.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { completionsCommand } from "./commands/completions.js";
import { observeCommand } from "./commands/observe.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { bold, green, yellow, red } from "./utils/colors.js";
import type { Classification, PhaseName } from "./state/schema.js";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

const program = new Command();

program
  .name("work-kit")
  .description("State machine orchestrator for work-kit development workflow")
  .version(pkg.version);

// ── init ─────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Create worktree and initialize state")
  .requiredOption("--mode <mode>", "Workflow mode: full or auto")
  .requiredOption("--description <text>", "Description of the work")
  .option("--classification <type>", "Work classification (auto mode): bug-fix, small-change, refactor, feature, large-feature")
  .option("--worktree-root <path>", "Override worktree root directory")
  .action((opts) => {
    try {
      const result = initCommand({
        mode: opts.mode as "full" | "auto",
        description: opts.description,
        classification: opts.classification as Classification | undefined,
        worktreeRoot: opts.worktreeRoot,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── next ─────────────────────────────────────────────────────────────

program
  .command("next")
  .description("Get the next action to perform")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    try {
      const result = nextCommand(opts.worktreeRoot);
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── complete ─────────────────────────────────────────────────────────

program
  .command("complete <target>")
  .description("Mark a phase/sub-stage as complete (e.g., plan/clarify)")
  .option("--outcome <value>", "Outcome of the step (e.g., done, revise, broken, changes_requested)")
  .option("--worktree-root <path>", "Override worktree root")
  .action((target, opts) => {
    try {
      const result = completeCommand(target, opts.outcome, opts.worktreeRoot);
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── status ───────────────────────────────────────────────────────────

program
  .command("status")
  .description("Show current state summary")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    try {
      const result = statusCommand(opts.worktreeRoot);
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── context ──────────────────────────────────────────────────────────

program
  .command("context <phase>")
  .description("Extract Final sections needed for a phase's agent")
  .option("--worktree-root <path>", "Override worktree root")
  .action((phase, opts) => {
    try {
      const result = contextCommand(phase as PhaseName, opts.worktreeRoot);
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── validate ─────────────────────────────────────────────────────────

program
  .command("validate <phase>")
  .description("Check prerequisites for a phase")
  .option("--worktree-root <path>", "Override worktree root")
  .action((phase, opts) => {
    try {
      const result = validateCommand(phase as PhaseName, opts.worktreeRoot);
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── loopback ─────────────────────────────────────────────────────────

program
  .command("loopback")
  .description("Register a loop-back transition")
  .requiredOption("--from <source>", "Source phase/sub-stage (e.g., review/handoff)")
  .requiredOption("--to <target>", "Target phase/sub-stage (e.g., build/core)")
  .requiredOption("--reason <text>", "Reason for loop-back")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    try {
      const result = loopbackCommand({
        from: opts.from,
        to: opts.to,
        reason: opts.reason,
        worktreeRoot: opts.worktreeRoot,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── workflow ─────────────────────────────────────────────────────────

program
  .command("workflow")
  .description("Manage auto-kit dynamic workflow")
  .option("--add <step>", "Add a step (e.g., review/security)")
  .option("--remove <step>", "Remove a step (e.g., test/e2e)")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    try {
      const result = workflowCommand({
        add: opts.add,
        remove: opts.remove,
        worktreeRoot: opts.worktreeRoot,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── doctor ───────────────────────────────────────────────────────────

program
  .command("doctor")
  .description("Check CLI installation, skills, and environment health")
  .option("--json", "Output as JSON")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    const result = doctorCommand(opts.worktreeRoot);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const check of result.checks) {
        const icon = check.status === "pass" ? green("\u2713") : check.status === "warn" ? yellow("!") : red("\u2717");
        console.error(`  ${icon} ${bold(check.name)}: ${check.message}`);
      }
      console.error();
      console.error(result.ok ? green("All checks passed.") : red("Some checks failed. Fix the issues above."));
    }
    process.exit(result.ok ? 0 : 1);
  });

// ── setup ────────────────────────────────────────────────────────────

program
  .command("setup [path]")
  .description("Install work-kit skills into a project")
  .action(async (targetPath) => {
    await setupCommand(targetPath);
  });

// ── upgrade ───────────────────────────────────────────────────────────

program
  .command("upgrade")
  .description("Update work-kit skills to the latest version")
  .option("--worktree-root <path>", "Override project path")
  .action(async (opts) => {
    await upgradeCommand(opts.worktreeRoot);
  });

// ── completions ─────────────────────────────────────────────────────

program
  .command("completions <shell>")
  .description("Output shell completions (bash, zsh, fish)")
  .action((shell) => {
    completionsCommand(shell);
  });

// ── observe ─────────────────────────────────────────────────────────

program
  .command("observe")
  .description("Real-time dashboard of all active work items")
  .option("--repo <path>", "Main repository root")
  .action(async (opts) => {
    await observeCommand({ mainRepo: opts.repo });
  });

// ── uninstall ────────────────────────────────────────────────────────

program
  .command("uninstall [path]")
  .description("Remove work-kit skills from a project")
  .action(async (targetPath) => {
    await uninstallCommand(targetPath);
  });

program.parse();
