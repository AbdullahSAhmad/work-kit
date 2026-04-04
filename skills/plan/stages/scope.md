---
description: "Plan sub-stage: Define in/out scope, estimate complexity, refine criteria."
---

# Scope

**Role:** Scope Manager
**Goal:** Draw clear boundaries around what gets built now vs. later.

## Instructions

1. Based on the Sketch, define what's in scope and what's explicitly out
2. Estimate complexity (small / medium / large / x-large)
3. Review and refine acceptance criteria from Clarify — add any new ones discovered during investigation
4. Identify prerequisites (things that must exist before this work starts)
5. Flag anything that should be a separate work item

## Output (append to state.md)

```markdown
### Plan: Scope

**In Scope:**
- <what will be built in this work item>

**Out of Scope:**
- <what will NOT be built — and why>

**Complexity:** <small | medium | large | x-large>

**Updated Criteria:**
(update the main ## Criteria section if new criteria were discovered)

**Prerequisites:**
- <things that must be true before build starts>

**Separate Work Items:**
- <anything that should be split out — empty if none>
```

## Rules

- Be ruthless about scope — feature creep kills velocity
- If Clarify criteria are too vague, sharpen them now
- "Out of scope" is a decision, not a deferral — explain why
- Complexity estimate should factor in blast radius from Investigate
