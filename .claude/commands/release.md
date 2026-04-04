---
description: "Bump version, update changelog, tag, and push to trigger npm publish via GitHub Actions."
argument-hint: "[patch|minor|major]"
---

# Release

You are releasing a new version of work-kit to npm.

## Steps

1. **Read current version** from `package.json` at repo root

2. **Determine bump type** from the argument ($ARGUMENTS):
   - If argument is `patch`, `minor`, or `major` — use it
   - If no argument — ask the user:
     ```
     Current version: X.Y.Z

     1. patch → X.Y.(Z+1)  (bug fixes)
     2. minor → X.(Y+1).0  (new features)  
     3. major → (X+1).0.0  (breaking changes)

     Which bump?
     ```

3. **Check for uncommitted changes** — run `git status --porcelain`. If dirty, warn the user and ask to confirm

4. **Run tests** — `npx tsx --test cli/src/**/*.test.ts` and `npx tsc --project cli/tsconfig.json --noEmit`. If they fail, stop and report

5. **Bump version** in `package.json` — update the `version` field

6. **Update CHANGELOG.md** — insert a new section after `# Changelog`:
   ```markdown
   ## X.Y.Z (YYYY-MM-DD)

   ### Changed
   - <ask user for changelog entry, or summarize recent commits with `git log --oneline v<previous>..HEAD`>
   ```

7. **Show the user** what will be committed and tagged. Ask for confirmation

8. **Commit and tag**:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "release: vX.Y.Z"
   git tag vX.Y.Z
   ```

9. **Push** — ask the user "Push to remote? This will trigger npm publish via GitHub Actions."
   ```bash
   git push
   git push --tags
   ```

10. **Report** — "vX.Y.Z pushed. GitHub Actions will run tests and publish to npm."

## Important

- Never push without user confirmation
- Never skip tests
- The `v*` tag triggers `.github/workflows/publish.yml` which handles actual npm publish
- You need `NPM_TOKEN` secret set in GitHub repo settings for the workflow to work
