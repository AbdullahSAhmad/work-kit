# Changelog

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
- Full-kit mode: 6 phases, 27 sub-stages, strict ordering
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
