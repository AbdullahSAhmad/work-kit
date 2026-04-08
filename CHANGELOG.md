# Changelog

## 0.5.0 (2026-04-08)

### Added
- **New Define phase** runs before Plan with two steps: `refine` (surface ambiguity, propose framings, ask the user to pick) and `spec` (lightweight 5-section PRD: goal, non-goals, users, success signal, constraints). The phase exists to catch vague asks before Plan wastes effort investigating the wrong target. Auto-skipped for `bug-fix`, `small-change`, and `refactor` classifications; runs by default for `feature` and `large-feature`. `full-kit` always starts at Define.
- **wk-debug recovery skill** is auto-invoked when any step reports outcome `needs_debug`. Five-step triage methodology (Reproduce → Isolate → Hypothesize → Test → Fix or escalate). The originating step retries automatically after the debug agent finishes; max 2 debug iterations per step before surfacing to the user. New `spawn_debug_agent` action type returned by `work-kit complete`. Not user-invocable — fires from inside the pipeline only.
- **`test/browser` step** drives the running app via Chrome DevTools MCP and verifies each user-facing acceptance criterion in a real browser. No `*.spec.ts` files to maintain — the agent uses MCP tools interactively. Runs in parallel with `verify` and `e2e` (validate consolidates), gated `if UI` for feature/large-feature. `work-kit doctor` probes for the MCP server and warns (does not fail) when missing; the step skips itself gracefully if the MCP isn't installed.
- **`decision` as a 5th knowledge type** routed into `.work-kit-knowledge/decisions.md`. `work-kit extract` now harvests bullets under `## Decisions` that match the documented `**<context>**: chose X over Y — <why>` shape and graduates them into the knowledge layer. `work-kit learn --type decision --text "..."` works for explicit captures. `wk-bootstrap` injects `decisions.md` alongside lessons/conventions/risks so future sessions don't re-litigate settled choices. No separate `docs/adr/` system, no Nygard format, no new commands — the existing two-layer knowledge persistence handles everything.
- New `needs_debug` step outcome in the `STEP_OUTCOMES` enum.
- New `kind: "debug"` field on `LoopbackRecord` to distinguish debug retries from standard loop-backs.

### Changed
- **`WorkKitState.version` bumped from 2 to 3.** No backwards-compatibility shim — v0.5 is a clean break. Cancel or complete in-flight v2 sessions before upgrading.
- `PHASE_NAMES` now leads with `define`. `STEPS_BY_PHASE.define = ["refine", "spec"]`. `TEST_STEPS` reordered to `["verify", "e2e", "browser", "validate"]`.
- `validatePhasePrerequisites` treats a fully-skipped prerequisite phase as satisfied, so the new Define phase doesn't block Plan when the workflow matrix opts out.
- `WORKFLOW_MATRIX` extended with `define/refine`, `define/spec`, and `test/browser` rows for every classification. Define gating: feature + large-feature only by default. Browser gating: `if UI` for feature/large-feature.
- `LOOPBACK_ROUTES` adds `define/spec --revise→ define/refine` (max 2 iterations).
- `agent-map.ts`: Plan now reads `### Define: Final` when present (silently skipped when absent). New step contexts for `define/refine`, `define/spec`, and `test/browser`.
- `model-routing.ts`: Define phase defaults to `opus`; `define/refine` = opus, `define/spec` = sonnet, `test/browser` = sonnet.
- `wk-wrap-up/steps/knowledge.md`: documentation updated to reflect that `## Decisions` is now auto-harvested. Free-form decision bullets are skipped silently — only those matching the documented format graduate.
- `full-kit/SKILL.md` and `auto-kit/SKILL.md`: phase tables updated, `spawn_debug_agent` action handler added to the execution loop.
- `wk-bootstrap/SKILL.md`: surfaces `knowledge.decisions` alongside lessons/conventions/risks; documents v0.5 capabilities.
- `work-kit doctor` checks for the new `wk-define` and `wk-debug` skills, and probes for Chrome DevTools MCP availability via `~/.claude/settings.json`, `~/.claude/mcp.json`, and `./.mcp.json`.

## 0.4.1 (2026-04-08)

### Fixed
- `work-kit extract` no longer auto-harvests bullets under `## Decisions` and `## Deviations`. Those sections are agent scratch space and routinely contain test-plan walkthroughs and self-review notes, which flooded `workflow.md` with dozens of `[deviation]` entries that had no signal about the work-kit workflow itself. Only typed `## Observations` bullets (`- [lesson|convention|risk|workflow] text`) plus tracker loopbacks/skipped/failed steps are now extracted.
- `work-kit setup` retries Playwright install with `--legacy-peer-deps` when npm fails with ERESOLVE (e.g., target project has a pre-existing vite peer-dep conflict). Warns the user that the underlying conflict still needs separate attention.

## 0.4.0 (2026-04-08)

### Added
- Two-layer knowledge persistence so sessions stop being amnesiac. New `.work-kit-knowledge/` directory at the main repo root holds `lessons.md`, `conventions.md`, `risks.md` (project-specific, injected into every new session via `wk-bootstrap`) and `workflow.md` (kit-level feedback, mined manually across projects to improve work-kit upstream).
- New `wrap-up/knowledge` step runs after `wrap-up/summary`. Calls `work-kit extract` to parse typed `## Observations` bullets from `state.md` plus loopbacks/skipped/failed steps from `tracker.json`, then routes entries into the four knowledge files. Skipped by default for `bug-fix` and `small-change` classifications.
- `work-kit learn --type {lesson|convention|risk|workflow} --text "..."` CLI command for explicit mid-session captures. Auto-fills slug/phase/step from current `tracker.json`. Secret redaction at write time.
- `work-kit extract` CLI command. Idempotent (content-hash dedup); batches one read-modify-write per file under a single lockfile acquisition.
- New `## Observations` section in the `state.md` template with a typed-bullet grammar (`- [lesson|convention|risk|workflow] text`) so agents can capture observations as a normal part of phase work.
- Per-step model routing: `--opus`, `--sonnet`, `--haiku`, `--inherit` flags on `/full-kit` and `/auto-kit` set a session-wide model policy. Layered precedence: workspace JSON override → user global override → session policy → classification override → step default → phase default → hard default. New `cli/src/config/model-routing.ts` with full test coverage.
- `work-kit setup` now scaffolds `.work-kit-knowledge/` with stub files and a README on first install, gitignores `.work-kit-knowledge/.lock`, and prints a one-time "files are committed to your repo" warning.
- `work-kit setup` and `work-kit upgrade` now detect Playwright and offer to install `@playwright/test` + Chromium when missing. The `wk-test/e2e` step is updated to require Playwright (no manual fallback).
- `wk-bootstrap` reads `lessons.md`, `conventions.md`, and `risks.md` (capped at 200 lines each) and injects them into every new session's opening context. `workflow.md` is intentionally not injected — it's a write-only artifact for human curators.
- Process-wide caches for `gitHeadSha` and `ensureKnowledgeDir` to eliminate redundant subprocess spawns and stat calls during multi-entry wrap-ups.
- Shared `atomicWriteFile` helper in `cli/src/utils/fs.ts` for crash-safe writes (temp + rename).
- Generalized `ensureGitignored(root, entry)` helper, reused by `setup` for the knowledge lockfile entry.

### Changed
- Each phase `SKILL.md` (`wk-plan`, `wk-build`, `wk-test`, `wk-review`, `wk-deploy`) gains a one-line reminder to append typed bullets to `## Observations` in `state.md` during normal phase work, alongside the existing Decisions/Deviations recording guidance.
- `wk-wrap-up/SKILL.md` now describes two steps (`summary` then `knowledge`) instead of one.

## 0.3.0 (2026-04-07)

### Added
- Observer detects "blocked on user input" state via Claude Code hooks. Setup installs `PermissionRequest`, `PreToolUse(AskUserQuestion)`, `PostToolUse`, and `Stop` hooks into the target project's `.claude/settings.json` (idempotent merge that preserves user-defined hooks).
- Magenta `▶ AWAITING INPUT` badge with pulsing arrow on blocked work items, plus header counter; current step and current phase highlighted in magenta with `← waiting you` hint.
- Soft `⏸ idle` indicator when the agent yields mid-step (gated on current step still in-progress to avoid false positives between steps).
- `--dry-run` flag for `/release` slash command: previews next version, changelog section, and tag without writing or pushing.
- Pause/resume commands and skills (`/pause-kit`, `/resume-kit`).
- Report command for work-item summaries.
- Per-project configuration via `.work-kit/config.json`.
- Single-step archive flow.

### Changed
- Phase names rendered uppercase + letter-spaced (`P L A N`, `W R A P - U P`) to visually distinguish phases from steps.
- Branch name moved beneath worktree path in observer dashboard.
- Removed redundant phase/step timing row above the progress bar (timings already appear under phases and inside the step box).
- Added space between badge row and progress bar.
- `wk complete` and `wk next` clear stale `.work-kit/awaiting-input` and `.work-kit/idle` markers as a safety net for edge cases (denied permissions, killed sessions).
- Internal rename: sub-stage → step, engine → workflow; constants extracted to `cli/src/config/constants.ts`.

## 0.2.8 (2026-04-06)

### Changed
- Show phase timing below each phase in pipeline (completed duration + live elapsed for active)
- Bold phase names for better visual hierarchy
- Add `⎇` icon for branch name and `⌂` icon for worktree path

## 0.2.7 (2026-04-06)

### Changed
- Redesign observer dashboard: braille spinner, pulse animations, progress bar gradient, step detail box with per-step timing
- Add animated mascot (gear with sparks when active, sleeping when idle)
- Show all steps of current phase in a bordered box with status icons and durations
- Add colored mode/gated/status badges, phase pipeline with connectors
- Rename state.json to tracker.json, restructure archive to folder-based layout
- Fix observer rendering ghost frames (clear to end of screen after each draw)

## 0.2.6 (2026-04-06)

### Changed
- Add `/cancel-kit` slash command and `work-kit cancel` CLI to stop and clean up active sessions

## 0.2.5 (2026-04-06)

### Changed
- Add "waiting" step status with flashing indicators in observer
- Auto-add `.work-kit/` to `.gitignore` on init to prevent committing temp state
- Fix observer showing same feature in both active and completed sections
- Move tracker/archive path from `.claude/work-kit/` to `.work-kit-tracker/`
- Support `--gated` flag in `/full-kit` and `/auto-kit` slash commands

## 0.2.4 (2026-04-04)

### Changed
- Phases auto-proceed by default — no more waiting for user approval between phases
- Add `--gated` flag to `init` to opt into manual approval between phases

## 0.2.3 (2026-04-04)

### Added
- Anti-rationalization tables in 18 step files to counter LLM shortcut-taking
- Three-tier boundaries (Always / Ask First / Never) in all 6 phase runner skills
- Verdict protocol with structured output templates across phase runners and steps
- Bootstrap command (`npx work-kit-cli bootstrap`) for session detection and recovery
- Content redactor with `@wk-ignore-start/end` markers to hide code from agents
- Session recovery flow in full-kit and auto-kit orchestrators

## 0.2.2 (2026-04-04)

### Fixed
- Deploy merge now included by default in both full-kit and auto-kit (was incorrectly marked optional/skipped)
- Observer: advance currentStep on complete so dashboard refreshes correctly
- Observer: show current step on its own line below phase indicators for clarity

## 0.2.1 (2026-04-04)

### Changed
- Prefix phase skill directories with `wk-` (plan → wk-plan, build → wk-build, etc.) to avoid conflicts with user skills
- full-kit and auto-kit skill names unchanged
- Doctor checks `stateExists()` before reading state — no false warnings on fresh projects
- Update all cross-references in skill files and CLI code

## 0.2.0 (2026-04-04)

### Changed
- Rename package from `@abdullahsahmad/work-kit` to `work-kit-cli` (unscoped, simpler `npx work-kit-cli` usage)
- Update all skill files, CLI output, README, and PLAN.md to use new package name
- Doctor no longer errors when no state.json exists (expected state for fresh projects)
- Observer: show "Full Kit" / "Auto Kit · classification" labels, elapsed + phase timing, substage position, aligned completed columns
- Simplify index.md parser to single 5-column format

## 0.1.5 (2026-04-04)

### Changed
- Observer: show "Full Kit" / "Auto Kit · classification" instead of raw mode strings
- Observer: display elapsed time and current phase duration
- Observer: show substage position within phase (e.g., build/core 3/8)
- Observer: align completed items in fixed-width columns
- Simplify index.md parser to single 5-column format (remove legacy parsers)
- Make deploy and wrap-up mandatory and fully autonomous in skill docs

## 0.1.4 (2026-04-04)

### Fixed
- Observer index parser now handles 5-column table format (Date|Slug|PR|Status|Phases) to prevent duplicate completed items

### Changed
- Release skill runs non-interactively when bump type is provided as argument

## 0.1.3 (2026-04-04)

### Fixed
- Observer: store full ISO timestamp for accurate "Started X ago" display
- Observer: exclude skipped substages from progress bar (auto-kit showed inflated progress)
- Observer: watch .work-kit directory instead of file to survive atomic writes on Linux
- Observer: show completed items from worktree state files

### Changed
- CLI auto-archives state.md and writes to index.md on workflow completion
- Deploy/merge stage auto-merges after syncing with default branch (no user confirmation)
- Wrap-up skill cleanup now includes branch deletion

## 0.1.2 (2026-04-04)

### Fixed
- Bin wrapper now resolves tsx from package's own dependencies (fixes npx execution)
- Version output reads from package.json dynamically instead of hardcoded

## 0.1.1 (2026-04-04)

### Added
- `wk` shortcut alias for `work-kit` binary
- `uninstall` command to remove skills from a project
- Real-time observer dashboard (`work-kit observe`)
- Shell completions for bash, zsh, fish
- Colored terminal output (respects NO_COLOR)
- `/release` Claude Code command for automated publishing

### Fixed
- Scoped package name (`@abdullahsahmad/work-kit`) for npm compatibility
- Install commands in README and skill files updated

## 0.1.0 (2026-04-04)

### Added
- TypeScript CLI orchestrator with 15 commands (init, next, complete, status, context, validate, loopback, workflow, doctor, setup, upgrade, uninstall, observe, completions, release)
- `setup` command for one-step installation into any Claude Code project
- `doctor` command for environment health checks with --json flag
- Full-kit mode: 6 phases, 27 steps, strict ordering
- Auto-kit mode: dynamic workflow based on work classification (bug-fix, small-change, refactor, feature, large-feature)
- Parallel agent coordination for test (verify + e2e) and review (4 parallel reviewers) phases
- Loop-back routing with max-count enforcement (max 2 per route)
- Dual state management: state.json (state machine) + state.md (content)
- 8 skill templates following Claude Code SKILL.md convention
- Atomic file writes for state corruption prevention
- Real-time terminal observer dashboard (`work-kit observe`) with fs.watch
- Shell completions for bash, zsh, and fish
- Colored terminal output (respects NO_COLOR)
- `/release` Claude Code command for automated version bumping and publishing
- GitHub Actions CI (Node 18/20/22) and publish workflow (on v* tags)
- 40 unit tests covering core modules
