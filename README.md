# work-kit

Structured development workflow for [Claude Code](https://claude.com/claude-code). Two modes, 6 phases, 27 sub-stages — orchestrated by a TypeScript CLI with reusable skill files.

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

Runs every phase and sub-stage in strict order. No shortcuts.

Best for: large features, new systems, maximum rigor.

### `/auto-kit <description>`

Classifies the request (bug-fix, small-change, refactor, feature, large-feature) and builds a dynamic workflow with only the sub-stages needed.

Best for: bug fixes, small changes, refactors, well-understood tasks.

## CLI commands

| Command | Description |
|---------|-------------|
| `init <description>` | Initialize a new workflow with a task description |
| `next` | Advance to the next sub-stage |
| `complete` | Mark the current sub-stage as complete |
| `status` | Show current workflow state (phase, sub-stage, progress) |
| `context` | Generate context summary for the current phase |
| `validate` | Validate state integrity and phase prerequisites |
| `loopback` | Route back to a previous stage (max 2 per route) |
| `workflow` | Display the full workflow plan |
| `doctor` | Run environment health checks (supports `--json`) |
| `setup` | Install work-kit skills into a Claude Code project |

## Phases

| Phase | Sub-stages | Agent |
|-------|-----------|-------|
| **Plan** | Clarify, Investigate, Sketch, Scope, UX Flow, Architecture, Blueprint, Audit | Single |
| **Build** | Setup, Migration, Red, Core, UI, Refactor, Integration, Commit | Single |
| **Test** | Verify, E2E, Validate | Verify + E2E parallel, then Validate |
| **Review** | Self-Review, Security, Performance, Compliance, Handoff | 4 parallel reviewers, then Handoff |
| **Deploy** | Merge, Monitor, Remediate | Single (optional) |
| **Wrap-up** | Summary + Archive | Single |

## Architecture

### Context management

Each phase runs as a **fresh agent**. The Build agent doesn't carry Plan's investigation notes — no context bloat.

Phases communicate through **Final sections** in `.work-kit/state.md`. Each phase writes a `### <Phase>: Final` section that the next phase reads.

### State management

Dual state files in `.work-kit/`:

- **state.json** — state machine (current phase, sub-stage, transitions, loop-back counts)
- **state.md** — content (working notes, Final sections, accumulated context)

All writes are atomic to prevent state corruption.

### Parallel agents

- **Test phase**: Verify and E2E run in parallel, then Validate runs sequentially
- **Review phase**: Self-Review, Security, Performance, and Compliance run as 4 parallel reviewers, then Handoff runs sequentially

### Loop-back routing

Any stage can route back to a previous stage. Each route is enforced with a max count of 2 to prevent infinite loops.

### Validation

- **full-kit**: phase-level prerequisites (Plan before Build before Test...)
- **auto-kit**: step-level validation against the `## Workflow` checklist
- Both modes refuse to skip ahead

### Output

```
.claude/work-kit/
  2026-04-03-avatar-upload.md        # distilled summary
  archive/
    2026-04-03-avatar-upload.md      # full state.md copy
  index.md                           # log of all completed work
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
    plan/stages/        # 8 stage files
    build/SKILL.md      # Build phase runner
    build/stages/       # 8 stage files
    test/SKILL.md       # Test phase runner
    test/stages/        # 3 stage files
    review/SKILL.md     # Review phase runner
    review/stages/      # 5 stage files
    deploy/SKILL.md     # Deploy phase runner
    deploy/stages/      # 3 stage files
    wrap-up/SKILL.md    # Final summary + cleanup
  package.json
```

## Requirements

- Node.js >= 18
- Git
- [Claude Code](https://claude.com/claude-code)
