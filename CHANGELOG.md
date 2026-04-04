# Changelog

## 1.0.0 (2026-04-04)

### Added
- TypeScript CLI orchestrator with 10 commands (init, next, complete, status, context, validate, loopback, workflow, doctor, setup)
- `setup` command for one-step installation into any Claude Code project
- `doctor` command for environment health checks with --json flag
- Full-kit mode: 6 phases, 27 sub-stages, strict ordering
- Auto-kit mode: dynamic workflow based on work classification (bug-fix, small-change, refactor, feature, large-feature)
- Parallel agent coordination for test (verify + e2e) and review (4 parallel reviewers) phases
- Loop-back routing with max-count enforcement (max 2 per route)
- Dual state management: state.json (state machine) + state.md (content)
- 8 skill templates following Claude Code SKILL.md convention
- Atomic file writes for state corruption prevention
- 40 unit tests covering core modules
