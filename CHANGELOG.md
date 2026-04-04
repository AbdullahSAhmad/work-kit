# Changelog

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
