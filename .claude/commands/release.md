---
description: "Bump version, update changelog, tag, and push to trigger npm publish via GitHub Actions."
argument-hint: "[patch|minor|major] [--dry-run]"
---

# Release

You are releasing a new version of work-kit to npm. Be fast and non-interactive — only ask the user a question if you genuinely cannot proceed without their input.

## Argument parsing

Parse `$ARGUMENTS` once at the start:
- If `$ARGUMENTS` contains `--dry-run` (anywhere, any position), set `DRY_RUN = true` and remove that token from the argument list.
- **Typo tolerance (fail-safe toward preview):** Also set `DRY_RUN = true` and strip the offending token if `$ARGUMENTS` contains any token that looks like a dry-run flag but is misspelled — case-insensitive, with or without the leading dashes, with `_` or no separator instead of `-`, or using an em-dash/en-dash prefix. Examples that MUST be treated as dry-run: `--dryrun`, `--DRY-RUN`, `--Dry-Run`, `-dry-run`, `—dry-run` (em-dash), `--dry_run`, `--dry-run=true`, `--dry-run=false`, `dry-run`, `dryrun`. Rationale: the entire point of this flag is to prevent unintended writes — if the user's intent looks remotely like "dry run", err toward preview, never toward a real release.
- If `$ARGUMENTS` contains the substring `dry` in a token that does NOT match any of the above patterns (e.g. `--drybones`, `--dryness`), STOP and ask the user: "Did you mean `--dry-run`? (yes = preview only / no = proceed with real release)". Do not guess.
- The remaining token (if any) is the bump type: `patch`, `minor`, or `major`.
- If `DRY_RUN` is true, you are in **PREVIEW MODE**: never write files, never commit, never tag, never push. Compute everything in memory and print a preview block at the end.
- Order does not matter: `/release patch --dry-run` and `/release --dry-run patch` are equivalent.

## Steps

1. **Read current version** from `package.json` at repo root

2. **Determine bump type** from the argument ($ARGUMENTS, with `--dry-run` already stripped):
   - If argument is `patch`, `minor`, or `major` — use it
   - If no argument — ask the user (this is the ONE question you ask):
     ```
     Current version: X.Y.Z

     1. patch → X.Y.(Z+1)  (bug fixes)
     2. minor → X.(Y+1).0  (new features)  
     3. major → (X+1).0.0  (breaking changes)

     Which bump?
     ```

3. **Check for uncommitted changes** — run `git status --porcelain`.
   - If dirty AND not `DRY_RUN`: commit or stash them automatically before proceeding.
   - If dirty AND `DRY_RUN`: record the dirty state (file count) for the preview block, but do NOT commit or stash.

4. **Run tests** — `npx tsx --test cli/src/**/*.test.ts` and `npx tsc --project cli/tsconfig.json --noEmit`. If they fail, stop and report. Otherwise continue silently. (Tests are still run in `DRY_RUN` — a preview is only meaningful if the release would actually succeed.)

5. **Bump version** in `package.json` — update the `version` field.
   - If `DRY_RUN`: COMPUTE the next version in memory only — do NOT write `package.json`.

6. **Update CHANGELOG.md** — insert a new section after `# Changelog`. Summarize recent commits using `git log --oneline v<previous>..HEAD`. Do NOT ask the user for changelog text — generate it yourself from the commits:
   ```markdown
   ## X.Y.Z (YYYY-MM-DD)

   ### Changed
   - <summarized from commits>
   ```
   - If `DRY_RUN`: COMPUTE the new changelog section text in memory only — do NOT write `CHANGELOG.md`.

7. **Commit, tag, and push** — branch on `DRY_RUN`:

   **If `DRY_RUN`:** print this preview block to chat and STOP. Do NOT run any git write commands.
   ```
   ═══ DRY RUN — no changes will be made ═══

   Current version: <X.Y.Z>
   Next version:    <X.Y.Z+1>   (<bump-type>)
   Tag:             v<X.Y.Z+1>

   Changelog section that would be inserted:
   ─────────────────────────────────────────
   ## <next> (<YYYY-MM-DD>)

   ### Changed
   - <bullets from git log v<prev>..HEAD>
   ─────────────────────────────────────────

   Working tree: clean | dirty (N files would be auto-committed)
   Tests:        passing

   DRY RUN complete — no changes made.
   Run `/release <bump-type>` (without --dry-run) to actually release.
   ```

   **Otherwise (real release):** do all of this in one go, no confirmation needed:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "release: vX.Y.Z"
   git tag vX.Y.Z
   git push
   git push --tags
   ```

8. **Report**:
   - If `DRY_RUN`: the preview block above already serves as the report — say nothing more.
   - Otherwise: "vX.Y.Z pushed. GitHub Actions will publish to npm."

## Important

- Only ask the user a question if the bump type is not provided as an argument
- Never skip tests
- The `v*` tag triggers `.github/workflows/publish.yml` which handles actual npm publish
- If `--dry-run` is in `$ARGUMENTS`, NEVER run `git add`, `git commit`, `git tag`, `git push`, or modify `package.json` / `CHANGELOG.md`. Print the preview block only.
- Tests are still run in dry-run mode — a preview is only meaningful if the release would actually succeed.

## Examples

- `/release patch` — bump patch, commit, tag, push
- `/release minor --dry-run` — preview a minor bump; no writes
- `/release --dry-run` — ask for bump type, then preview only
