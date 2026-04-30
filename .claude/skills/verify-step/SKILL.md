---
name: verify-step
description: Run the canonical 3-command verification sequence from tools/verify.ts — focused test, full suite, typecheck — in that exact frozen order. Use after any code change, at the end of any Ralph-loop step, or before committing. Stops on first failure and reports which command failed.
tools: Bash, Read
---

# Verify Step

Run the canonical verification sequence locked in `tools/verify.ts`. The sequence is **frozen**: focused test → full suite → typecheck. Do not reorder, skip, combine, or add commands. Do not substitute any of these with `npm`, `yarn`, `node`, `ts-node`, `tsx`, `vitest`, `jest`, or `mocha` — all banned per `AGENTS.md`.

## Inputs

The caller provides a focused test path (e.g., `test/core/fixed.constants.test.ts`). If missing, ask:

> Which test file is the focused verification for this change?

For a Ralph-loop step, read the current step file under `plan_fps/steps/` and use the test path it declares. If the step file does not declare one, ask the user.

## Commands — run in this exact order, one Bash call each

1. `bun test <focused-path>` — the focused test for the change
2. `bun test` — the full suite
3. `bun x tsc --noEmit --project tsconfig.json` — typecheck

## Rules

- Run sequentially. Each command must complete before the next starts.
- On any non-zero exit, **stop**. Do not proceed to the next command.
- Report which command failed, paste the last ~20 lines of its output, and return control to the caller.
- Report success only when all three pass.

## Output format

**Pass:**

```
✓ focused: bun test <path>
✓ full:    bun test
✓ types:   bun x tsc --noEmit --project tsconfig.json
```

**Fail:**

```
✓ focused: bun test <path>
✗ full:    bun test
<last ~20 lines of failing output>
```

Then stop. Do not run the remaining commands.
