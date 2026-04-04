# Contributing to work-kit

## Dev environment setup

```bash
git clone https://github.com/AbdullahSAhmad/work-kit.git
cd work-kit
npm install
```

## Running tests

```bash
npx tsx --test cli/src/**/*.test.ts
```

## Type-checking

```bash
npx tsc --project cli/tsconfig.json --noEmit
```

## Testing the CLI locally

```bash
npx tsx cli/src/index.ts <command>
```

For example:

```bash
npx tsx cli/src/index.ts doctor
npx tsx cli/src/index.ts status
npx tsx cli/src/index.ts init "add search feature"
```

## Code structure

### CLI (`cli/src/`)

| Directory | Purpose |
|-----------|---------|
| `commands/` | One file per CLI command (init, next, complete, etc.) |
| `state/` | State machine logic and file management (state.json + state.md) |
| `engine/` | Workflow engine, phase transitions, loop-back routing |
| `context/` | Context generation — builds Final sections for phase handoffs |
| `config/` | Configuration defaults, phase/sub-stage definitions |
| `index.ts` | CLI entry point (commander setup) |

### Skills (`skills/`)

Each phase has:
- `<phase>/SKILL.md` — phase runner following the Claude Code SKILL.md convention
- `<phase>/stages/` — one markdown file per sub-stage with instructions

Top-level orchestrators:
- `full-kit/SKILL.md` — strict sequential orchestrator
- `auto-kit/SKILL.md` — dynamic workflow orchestrator

## PR guidelines

- Run tests before submitting: `npx tsx --test cli/src/**/*.test.ts`
- Run type-check: `npx tsc --project cli/tsconfig.json --noEmit`
- Keep commits focused — one logical change per commit
- Follow existing code patterns and naming conventions
