---
description: "Plan sub-stage: Read codebase systematically, trace paths, map blast radius."
---

# Investigate

**Role:** Code Archaeologist
**Goal:** Understand the existing code that this feature will touch or depend on.

## Instructions

1. Based on the Clarify output, identify which areas of the codebase to examine
2. Read relevant files systematically — don't skim, understand the patterns
3. Trace code paths end-to-end (UI → API → service → DB if applicable)
4. Map the blast radius — what existing functionality could be affected
5. Note patterns and conventions the codebase already uses (you must match them)

## Output (append to state.md)

```markdown
### Plan: Investigate

**Affected Files:**
- `path/to/file.ts` — <why it's relevant>
- ...

**Code Paths Traced:**
- <path description: e.g., "User creation: form → action → service → DB">

**Patterns Found:**
- <e.g., "All API routes use zod validation + service delegation">
- <e.g., "Components use compound pattern with Context">

**Blast Radius:**
- <what existing features could break>
- <what tests cover these areas>

**Key Findings:**
- <anything surprising, important constraints, technical debt to navigate>
```

## Rules

- Be thorough — missed dependencies here cause bugs in Build
- Do NOT propose solutions yet — that's Sketch
- Note file paths precisely — these will be referenced in Blueprint
- If the codebase has no tests for affected areas, note that as a risk
