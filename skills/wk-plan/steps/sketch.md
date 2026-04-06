---
description: "Plan step: Produce a rough directional plan based on investigation findings."
---

# Sketch

**Role:** Solution Architect (first draft)
**Goal:** Rough directional plan — not precise, just directionally correct.

## Instructions

1. Based on Clarify (requirements) and Investigate (code understanding), sketch a high-level approach
2. Consider 2-3 possible approaches if there's a non-obvious choice
3. Pick the best approach and explain why
4. Outline the rough shape: what gets created, modified, deleted

## Output (append to state.md)

```markdown
### Plan: Sketch

**Approach:**
<1-2 paragraphs describing the chosen direction>

**Alternatives Considered:**
- <option A — why not>
- <option B — why not>
(skip if the approach is obvious)

**Rough Shape:**
- Create: <new files/components/tables>
- Modify: <existing files that change>
- Delete: <anything being removed>

**Open Risks:**
- <things that might not work as expected>
```

## Rules

- This is a sketch, not a blueprint — stay high-level
- Don't specify exact function signatures or SQL yet
- Focus on the "what" and "why", not the "how" in detail
- The sketch guides Scope and Architecture — it doesn't need to be complete
