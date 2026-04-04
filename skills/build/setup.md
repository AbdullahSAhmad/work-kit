---
description: "Build sub-stage: Branch creation, dependency installation, scaffolding."
---

# Setup

**Role:** Project Scaffolder
**Goal:** Prepare the workspace for implementation. No feature code yet.

## Instructions

1. Verify you're in the correct worktree on the feature branch
2. Install any new dependencies specified in the Blueprint
3. Create new files/directories that the Blueprint calls for (empty scaffolds)
4. Update config files if the Blueprint requires it
5. Verify the project still builds/compiles cleanly after setup

## Output (append to state.md)

```markdown
### Build: Setup

**Branch:** feature/<slug> (confirmed)
**Dependencies Added:**
- <package> — <why>

**Files Created:**
- `<path>` — <scaffold for what>

**Config Changes:**
- `<file>` — <what changed>

**Build Status:** clean | issues (detail)
```

## Rules

- Do NOT write implementation code — just scaffolding (empty files, directory structure)
- Do NOT write tests yet — that's Red
- If the worktree already has setup from a previous loop-back, verify state and skip what's done
- If dependency installation fails, diagnose the issue — don't proceed with broken dependencies
- Run the build/compile check to ensure nothing is broken before proceeding
