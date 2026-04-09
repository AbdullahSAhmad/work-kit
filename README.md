# work-kit

Structured development workflow for [Claude Code](https://claude.com/claude-code). Two modes, 7 phases, 31 steps, plus auto-debug recovery — orchestrated by a TypeScript CLI with reusable skill files.

## What's new in v0.5

- **Define phase** runs before Plan to refine vague asks into a concrete spec (auto-skipped for bug fixes/refactors).
- **wk-debug** triage skill auto-fires when any step reports `needs_debug`, then the originating step retries (max 2 iterations). Not user-invocable — fires from inside the pipeline.
- **`test/browser`** drives the running app via Chrome DevTools MCP and verifies user-facing acceptance criteria in a real browser. Skips gracefully if the MCP isn't installed.
- **`decision` knowledge type** auto-graduates `## Decisions` bullets into `.work-kit-knowledge/decisions.md` so future sessions don't re-litigate settled choices.

## Installation

**One-step setup** (recommended):

```bash
npx work-kit-cli setup
```

This auto-detects Claude Code projects in your workspace and installs the skill files. If multiple projects are found, it lists them for you to choose.

**Global install**:

```bash
npm install -g work-kit-cli
```

## Quick start

```bash
# 1. Set up work-kit in your project
npx work-kit-cli setup

# 2. In Claude Code, start a workflow
/full-kit add user avatar upload    # strict, all phases
/auto-kit fix login redirect bug    # dynamic, only needed stages
```

## Modes

### `/full-kit <description>`

Runs every phase and step in strict order. No shortcuts.

Best for: large features, new systems, maximum rigor.

### `/auto-kit <description>`

Classifies the request (bug-fix, small-change, refactor, feature, large-feature) and builds a dynamic workflow with only the steps needed.

Best for: bug fixes, small changes, refactors, well-understood tasks.

## CLI commands

| Command | Description |
|---------|-------------|
| `init <description>` | Initialize a new workflow with a task description |
| `next` | Advance to the next step |
| `complete` | Mark the current step as complete |
| `status` | Show current workflow state (phase, step, progress) |
| `context` | Generate context summary for the current phase |
| `validate` | Validate state integrity and phase prerequisites |
| `loopback` | Route back to a previous stage (max 2 per route) |
| `workflow` | Display the full workflow plan |
| `pause` | Pause the active session (state preserved on disk) |
| `resume [--slug <slug>]` | Without `--slug`: list resumable sessions in this repo. With `--slug`: resume the named session |
| `observe [--all]` | Live TUI dashboard of active/paused/completed sessions. `--all` watches every work-kit project on the system |
| `doctor` | Run environment health checks (supports `--json`) |
| `setup` | Install work-kit skills into a Claude Code project |

### Picking up where you left off

`work-kit resume` (or `/resume-kit` in Claude Code) scans every worktree of the current repo for `.work-kit/tracker.json` files in `paused` or `in-progress` state and lets you pick one. It works from the main repo root — no need to `cd` into a worktree first. In-progress sessions are listed too, so a terminal you closed without pausing can be recovered: just look for the row with a stale `lastUpdatedAgoMs`.

### Watching multiple projects

`work-kit observe --all` discovers every work-kit-enabled repo from your `~/.claude/projects/` history and watches them all in one dashboard. Each row shows the project name, work item slug, mode, type, current state, and worktree.

## Phases

| Phase | Steps | Agent |
|-------|-----------|-------|
| **Plan** | Clarify, Investigate, Sketch, Scope, UX Flow, Architecture, Blueprint, Audit | Single |
| **Build** | Setup, Migration, Red, Core, UI, Refactor, Integration, Commit | Single |
| **Test** | Verify, E2E, Validate | Verify + E2E parallel, then Validate |
| **Review** | Triage, Self-Review, Security, Performance, Compliance, Fix, Handoff | Triage → parallel reviewers → Fix → Handoff |
| **Deploy** | Merge, Monitor, Remediate | Single (optional) |
| **Wrap-up** | Summary + Archive | Single |

## Architecture

### Context management

Each phase runs as a **fresh agent**. The Build agent doesn't carry Plan's investigation notes — no context bloat.

Phases communicate through **Final sections** in `.work-kit/state.md`. Each phase writes a `### <Phase>: Final` section that the next phase reads.

### State management

Dual state files in `.work-kit/`:

- **tracker.json** — state machine (current phase, step, transitions, loop-back counts)
- **state.md** — content (working notes, Final sections, accumulated context)

All writes are atomic to prevent state corruption.

### Parallel agents

- **Test phase**: Verify and E2E run in parallel, then Validate runs sequentially
- **Review phase**: Triage classifies the diff and selects reviewers, then selected reviewers run in parallel, then Fix aggressively resolves findings, then Handoff makes the ship decision

### Loop-back routing

Any stage can route back to a previous stage. Each route is enforced with a max count of 2 to prevent infinite loops.

### Validation

- **full-kit**: phase-level prerequisites (Plan before Build before Test...)
- **auto-kit**: step-level validation against the `## Workflow` checklist
- Both modes refuse to skip ahead

### Output

```
.work-kit-tracker/
  index.md                              # log of all completed work (links to summaries + archives)
  archive/
    avatar-upload-2026-04-03/
      state.md                          # full phase outputs
      tracker.json                      # full JSON tracker (phases, timing, status)
      summary.md                        # distilled wrap-up summary
```

## Repo structure

```
work-kit/
  cli/
    src/
      commands/       # CLI command implementations
      config/         # Configuration and defaults
      context/        # Context generation for phases
      engine/         # Workflow engine and transitions
      state/          # State machine and file management
      index.ts        # Entry point
  skills/
    full-kit/SKILL.md   # /full-kit orchestrator
    auto-kit/SKILL.md   # /auto-kit orchestrator
    plan/SKILL.md       # Plan phase runner
    plan/steps/        # 8 step files
    build/SKILL.md      # Build phase runner
    build/steps/       # 8 step files
    test/SKILL.md       # Test phase runner
    test/steps/        # 3 step files
    review/SKILL.md     # Review phase runner
    review/steps/      # 5 step files
    deploy/SKILL.md     # Deploy phase runner
    deploy/steps/      # 3 step files
    wrap-up/SKILL.md    # Final summary + cleanup
  package.json
```

## Requirements

- Node.js >= 18
- Git
- [Claude Code](https://claude.com/claude-code)
