---
description: "Bump version, update changelog, tag, and push to trigger npm publish via GitHub Actions."
argument-hint: "[patch|minor|major]"
---

# Release

You are releasing a new version of work-kit to npm. Be fast and non-interactive — only ask the user a question if you genuinely cannot proceed without their input.

## Steps

1. **Read current version** from `package.json` at repo root

2. **Determine bump type** from the argument ($ARGUMENTS):
   - If argument is `patch`, `minor`, or `major` — use it
   - If no argument — ask the user (this is the ONE question you ask):
     ```
     Current version: X.Y.Z

     1. patch → X.Y.(Z+1)  (bug fixes)
     2. minor → X.(Y+1).0  (new features)  
     3. major → (X+1).0.0  (breaking changes)

     Which bump?
     ```

3. **Check for uncommitted changes** — run `git status --porcelain`. If dirty, commit or stash them automatically before proceeding.

4. **Run tests** — `npx tsx --test cli/src/**/*.test.ts` and `npx tsc --project cli/tsconfig.json --noEmit`. If they fail, stop and report. Otherwise continue silently.

5. **Bump version** in `package.json` — update the `version` field

6. **Update CHANGELOG.md** — insert a new section after `# Changelog`. Summarize recent commits using `git log --oneline v<previous>..HEAD`. Do NOT ask the user for changelog text — generate it yourself from the commits:
   ```markdown
   ## X.Y.Z (YYYY-MM-DD)

   ### Changed
   - <summarized from commits>
   ```

7. **Commit, tag, and push** — do all of this in one go, no confirmation needed:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "release: vX.Y.Z"
   git tag vX.Y.Z
   git push
   git push --tags
   ```

8. **Report** — "vX.Y.Z pushed. GitHub Actions will publish to npm."

## Important

- Only ask the user a question if the bump type is not provided as an argument
- Never skip tests
- The `v*` tag triggers `.github/workflows/publish.yml` which handles actual npm publish
