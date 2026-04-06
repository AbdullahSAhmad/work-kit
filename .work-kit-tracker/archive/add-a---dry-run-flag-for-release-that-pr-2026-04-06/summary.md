---
slug: release-dry-run
branch: feature/release-dry-run
pr: 1
started: 2026-04-06
completed: 2026-04-07
status: completed
---

## Summary
Added a `--dry-run` flag to the `/release` slash command so users can preview the version bump, computed changelog section, and tag name without writing files, committing, tagging, or pushing. The change is a single-file edit to `.claude/commands/release.md` (a Claude Code prompt file) — no TypeScript, no new tests. Shipped via PR #1, squash-merged to main as `8b48302`.

## Criteria
- [x] `/release patch --dry-run` (and minor/major) runs without modifying any files — Verify confirms DRY_RUN guards on Steps 3/5/6 and Step 7 preview branch; E2E scenarios 2 and 3 trace no file writes for patch/minor
- [x] Dry-run prints current version and computed next version — Preview block in Step 7 includes `Current version` and `Next version` fields
- [x] Dry-run prints the changelog section that *would* be inserted — Step 6 computes section in memory and Step 7 preview block renders it; same `git log` source as real release
- [x] Dry-run prints the tag name that *would* be created — Preview block has dedicated `Tag: v<X.Y.Z+1>` line
- [x] Dry-run does NOT run `git add`, `git commit`, `git tag`, or `git push` — Step 7 DRY_RUN branch explicitly says "STOP. Do NOT run any git write commands." and Important NEVER-list enumerates all four commands
- [x] Dry-run still runs the test suite — Step 4 intentionally un-guarded; E2E scenario 2 trace includes Step 4 execution
- [x] Dry-run output clearly labels itself as a preview — `═══ DRY RUN — no changes will be made ═══` header and closing `DRY RUN complete — no changes made.`
- [x] If `--dry-run` is passed without a bump type, the agent still asks the one bump-type question — E2E scenario 4 traces flag-stripped → empty remainder → existing Step 2 ask branch fires

## Key Decisions
- **Implementation surface**: chose to edit the prompt file rather than add a commander/TypeScript flag — `/release` is a markdown slash command with no code path; a CLI flag would have been wrong-layer.
- **Single command vs new `/release-preview`**: chose to extend `/release` rather than create a sibling command — avoids drift between preview and real release behavior, satisfies "preview must match exactly" guarantee.
- **Tests in dry-run**: chose to keep Step 4 (test suite) un-guarded — a preview that hides test failures would be misleading; the user wants to know the release would actually succeed. Acceptable because current test commands (`npx tsx --test`, `tsc --noEmit`) are read-only.
- **Defense-in-depth guarding**: every write surface is guarded twice (per-step `If DRY_RUN` clause + explicit `## Important` NEVER-list enumerating all four git commands and both protected files) — redundancy is intentional anti-footgun for an LLM-executed prompt.
- **Typo tolerance for `--dry-run`** (added in Review: Handoff, commit `d7a7117`): broadened the parser to match `--dryrun`, `--DRY-RUN`, `--dry_run`, em-dash variants, and `--dry-run=value` forms case-insensitively, all fail-safe toward preview. For other tokens containing `dry`, the agent stops and asks "Did you mean `--dry-run`?" rather than guessing. Closed the medium-severity finding that a typo would silently perform a real release — the exact failure mode the feature exists to prevent.

## Deviations from Plan
- **Typo-tolerant parser added during Review (commit `d7a7117`)**: not in original Blueprint. Review: Security flagged it as MEDIUM (typo'd `--dry-run` → real release), Review: Handoff applied the fix inline rather than bouncing back to Build. Scope was a tightening of the `## Argument parsing` section the PR already owned.
- **Step 2 lead-in clarification**: added a parenthetical noting `$ARGUMENTS` has `--dry-run` already stripped, to prevent the LLM from re-matching the flag as a bump type. Cross-reference, not a flow change.
- **Step 4 inline parenthetical**: duplicated the new "tests still run in dry-run" Important bullet at the point where it applies. Harmless redundancy reinforcing a Key Constraint.
- **PR opened during Deploy** (not Build): Plan: Final said "no PR" and Build honored that. Deploy: Merge pushed the local-only branch and opened PR #1, then squash-merged. The `gh pr merge --delete-branch` call hit a worktree-conflict updating local main but the squash succeeded server-side; the remote feature branch was deleted manually.
