# work-kit

Structured development workflow for [Claude Code](https://claude.com/claude-code). Two modes, 6 phases, 27 sub-stages — all as reusable skill files.

## Modes

### `/full-kit <description>`
Runs every phase and sub-stage in order. No shortcuts.

Best for: large features, new systems, maximum rigor.

### `/auto-kit <description>`
Analyzes the request first, classifies it (bug-fix, small-change, refactor, feature, large-feature), then builds a dynamic workflow with only the sub-stages needed.

Best for: bug fixes, small changes, refactors, well-understood tasks.

## Phases

| Phase | Sub-stages | Agent |
|-------|-----------|-------|
| **Plan** | Clarify, Investigate, Sketch, Scope, UX Flow, Architecture, Blueprint, Audit | Single |
| **Build** | Setup, Migration, Red, Core, UI, Refactor, Integration, Commit | Single |
| **Test** | Verify, E2E, Validate | Verify + E2E parallel, then Validate |
| **Review** | Self-Review, Security, Performance, Compliance, Handoff | 4 parallel reviewers, then Handoff |
| **Deploy** | Merge, Monitor, Remediate | Single (optional) |
| **Wrap-up** | Summary + Archive | Single |

## How it works

```
/full-kit add user avatar upload

  Plan (fresh agent)
    Clarify → Investigate → Sketch → Scope → UX Flow → Architecture → Blueprint → Audit
    writes: ### Plan: Final

  Build (fresh agent — reads Plan: Final)
    Setup → Migration → Red → Core → UI → Refactor → Integration → Commit
    writes: ### Build: Final

  Test (fresh agent — reads Build: Final)
    Verify ──┐ parallel
    E2E    ──┘ → Validate
    writes: ### Test: Final

  Review (fresh agent — reads all Finals)
    Self-Review  ──┐
    Security     ──┤ 4 parallel
    Performance  ──┤
    Compliance   ──┘ → Handoff
    writes: ### Review: Final

  Deploy → Wrap-up → done
```

## Architecture

### Context management
Each phase runs as a **fresh agent**. No context bloat — the Build agent doesn't carry Plan's investigation notes.

Phases communicate through **Final sections** in `.work-kit/state.md`. Each phase writes a `### <Phase>: Final` section that's all the next phase needs.

### State tracking
All work is tracked in `.work-kit/state.md` inside the git worktree. Sub-stage working notes accumulate alongside Final sections. The full file is archived on completion.

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

## File structure

```
.claude/skills/
  full-kit.md              # /full-kit orchestrator
  auto-kit.md              # /auto-kit orchestrator
  plan.md                  # Plan phase runner
  plan/
    clarify.md
    investigate.md
    sketch.md
    scope.md
    ux-flow.md
    architecture.md
    blueprint.md
    audit.md
  build.md                 # Build phase runner
  build/
    setup.md
    migration.md
    red.md
    core.md
    ui.md
    refactor.md
    integration.md
    commit.md
  test.md                  # Test phase runner
  test/
    verify.md
    e2e.md
    validate.md
  review.md                # Review phase runner
  review/
    self-review.md
    security.md
    performance.md
    compliance.md
    handoff.md
  deploy.md                # Deploy phase runner
  deploy/
    merge.md
    monitor.md
    remediate.md
  wrap-up.md               # Final summary + cleanup
```

## Installation

Copy the `.claude/skills/` directory into your project's `.claude/skills/` folder. The skills will be available as `/full-kit` and `/auto-kit` in Claude Code.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Git (worktrees used for branch isolation)
