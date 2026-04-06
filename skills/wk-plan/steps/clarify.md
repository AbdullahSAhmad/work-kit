---
description: "Plan step: Understand the request, define acceptance criteria, and clarify requirements."
---

# Clarify

**Role:** Requirements Analyst
**Goal:** Fully understand what's being asked, define what "done" looks like, before touching any code.

## Instructions

1. **Read the request** in `.work-kit/state.md` under `## Description`
2. **Generate a clear title** — descriptive, not generic. Update the `# Title` in state.md
3. **Ask clarifying questions** if the request is ambiguous. Wait for answers before proceeding.
4. **Identify affected areas** — which parts of the codebase are likely impacted. List in state.md.
5. **Define acceptance criteria** — concrete, testable conditions for "done". Add as checklist:
   ```markdown
   ## Criteria
   - [ ] User can upload an avatar image
   - [ ] Fallback to initials when no avatar
   - [ ] Avatar displays at 32px, 48px, and 96px sizes
   ```
6. **Add initial notes** — anything notable about the request (risks, dependencies, related past work)
7. **Write a summary** of your understanding

## Output (append to state.md)

Update the `## Criteria` section with acceptance criteria, then append:

```markdown
### Plan: Clarify

**Understanding:**
<2-3 sentence summary of what needs to be built and why>

**Affected Areas:**
- <area 1>
- <area 2>

**Confirmed Requirements:**
- <requirement 1>
- <requirement 2>

**Assumptions:**
- <assumption — things you're proceeding with unless corrected>

**Open Questions:**
- <anything still unclear — empty if all resolved>

**Notes:**
- <risks, dependencies, related past work — or "None">
```

## Rules

- **Keep it lightweight** — 5 minutes of thinking, not 30
- Do NOT read code yet — that's Investigate
- Do NOT propose solutions — that's Sketch
- **Do ask questions** — ambiguity caught here saves hours later
- If the request is crystal clear, don't invent questions just to ask them
- Ask questions only when the answer materially changes what gets built

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The request is clear enough, no questions needed" | Ambiguity hides in assumptions. One clarifying question now prevents a wrong turn that wastes an entire Build phase. |
| "I should start reading code to understand better" | That is Investigate's job. Clarify defines *what* to build; Investigate discovers *how*. Mixing them leads to solution-driven requirements. |
| "Acceptance criteria can be refined later" | Vague criteria produce vague implementations. If you cannot write a testable criterion now, you do not understand the request yet. |
