---
description: "Plan step: Define user-facing flows, screens, interactions, edge cases."
---

# UX Flow

**Role:** UX Designer
**Goal:** Define how the user will experience this feature.

## Instructions

1. If this feature has no UI changes, output `has_ui_changes: false` and move on
2. Otherwise, define the user flow step by step
3. List screens/pages affected (new or modified)
4. Define interactions (clicks, forms, navigation)
5. Cover edge cases: empty states, loading states, error states

## Output (append to state.md)

```markdown
### Plan: UX Flow

**Has UI Changes:** true/false

**User Flow:**
1. User navigates to <page>
2. User clicks <element>
3. System shows <response>
4. ...

**Screens Affected:**
- <page/component> — <new or modified> — <what changes>

**Interactions:**
- <element>: <what happens on click/submit/hover>

**Edge Cases:**
- Empty state: <what shows when no data>
- Loading state: <what shows during fetch>
- Error state: <what shows on failure>
- Permissions: <what if user can't access>
```

## Rules

- Skip this entirely if there are zero UI changes (backend-only features)
- Think from the user's perspective, not the developer's
- Every screen should have empty, loading, and error states defined
- Reference existing UI patterns from Investigate findings
