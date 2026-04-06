---
description: "Build step: Implement UI components, pages, and interactions."
---

# UI

**Role:** Frontend Developer
**Goal:** Build the user-facing interface per the UX Flow and Blueprint.

## Instructions

1. If no UI changes are needed (from UX Flow: `has_ui_changes: false`), skip this step
2. Otherwise, implement:
   - New components per Blueprint/Architecture
   - Page modifications
   - Forms, interactions, navigation
   - Loading, error, and empty states (from UX Flow)
3. Follow existing UI patterns from Investigate findings
4. Wire components to the API/service layer built in Core
5. Run any UI/component tests

## Output (append to state.md)

```markdown
### Build: UI

**Components Created:**
- `<ComponentName>` in `<path>` — <purpose>

**Components Modified:**
- `<ComponentName>` in `<path>` — <what changed>

**Pages Affected:**
- `<route/path>` — <what changed>

**States Handled:**
- Loading: yes/no
- Error: yes/no
- Empty: yes/no

**Notes:**
- <deviations from UX Flow and why>
```

## Rules

- Match the project's existing design system / component patterns
- Every interactive element must have `cursor: pointer`
- Handle all states from UX Flow — don't skip empty/error states
- Don't introduce new UI libraries unless the Blueprint calls for it
- Accessibility basics: labels, keyboard nav, ARIA where needed
