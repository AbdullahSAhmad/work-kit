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
import { bootstrapCommand } from "./commands/bootstrap.js";
import { cancelCommand } from "./commands/cancel.js";
import { pauseCommand } from "./commands/pause.js";
import { resumeCommand } from "./commands/resume.js";
import { reportCommand } from "./commands/report.js";
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
  .option("--mode <mode>", "Workflow mode: full or auto (default: from project config or 'full')")
  .requiredOption("--description <text>", "Description of the work")
  .option("--classification <type>", "Work classification (auto mode): bug-fix, small-change, refactor, feature, large-feature")
  .option("--gated", "Wait for user approval between phases (default: auto-proceed)")
  .option("--worktree-root <path>", "Override worktree root directory")
  .action((opts) => {
    try {
      const result = initCommand({
        mode: opts.mode as "full" | "auto" | undefined,
        description: opts.description,
        classification: opts.classification as Classification | undefined,
        gated: opts.gated,
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
  .description("Mark a phase/step as complete (e.g., plan/clarify)")
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
  .requiredOption("--from <source>", "Source phase/step (e.g., review/handoff)")
  .requiredOption("--to <target>", "Target phase/step (e.g., build/core)")
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

// ── bootstrap ───────────────────────────────────────────────────────

program
  .command("bootstrap")
  .description("Detect work-kit state and output session orientation")
  .option("--json", "Output as JSON", true)
  .option("--auto-resume", "If paused or stale, auto-flip to in-progress")
  .action((opts) => {
    try {
      const result = bootstrapCommand(undefined, { autoResume: opts.autoResume });
      console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── pause ───────────────────────────────────────────────────────────

program
  .command("pause")
  .description("Pause the active work-kit session")
  .option("--reason <text>", "Optional reason for pausing")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    try {
      const result = pauseCommand(opts.reason, opts.worktreeRoot);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.action === "error" ? 1 : 0);
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── resume ──────────────────────────────────────────────────────────

program
  .command("resume")
  .description("Resume a paused work-kit session")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    try {
      const result = resumeCommand(opts.worktreeRoot);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.action === "error" ? 1 : 0);
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── report ──────────────────────────────────────────────────────────

program
  .command("report")
  .description("Show stats across completed work-kits")
  .option("--json", "Output as JSON")
  .option("--repo <path>", "Main repository root")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    try {
      reportCommand({ json: opts.json, repo: opts.repo, worktreeRoot: opts.worktreeRoot });
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

// ── cancel ──────────────────────────────────────────────────────────

program
  .command("cancel")
  .description("Cancel the active work-kit, remove worktree and branch")
  .option("--worktree-root <path>", "Override worktree root")
  .action((opts) => {
    try {
      const result = cancelCommand(opts.worktreeRoot);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.action === "error" ? 1 : 0);
    } catch (e: any) {
      console.error(JSON.stringify({ action: "error", message: e.message }));
      process.exit(1);
    }
  });

program.parse();
