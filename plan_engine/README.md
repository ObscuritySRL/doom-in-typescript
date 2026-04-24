# DOOM Codex Planning System

## Start Here

- Active workspace: `D:\Projects\bun-win32\doom_codex`
- Planning workspace: `D:\Projects\bun-win32\doom_codex\plans`
- Read-only reference bundle: `D:\Projects\bun-win32\doom\universal-doom`
- First eligible step in a fresh checkout: `00-001 pin-primary-target`
- Total planned implementation steps: `167`

## Ralph-Loop Workflow

1. Open `README.md`.
2. Open `MASTER_CHECKLIST.md`.
3. Pick the first unchecked step whose prerequisites are complete.
4. Open only that step file, `FACT_LOG.md`, and the exact files or docs named under `Read Only`.
5. Do not open related steps unless blocked.
6. Implement the step, run the listed verification commands in order, update the shared logs, mark the step complete, append a handoff entry, and stop.

## Shared Files

- `MASTER_CHECKLIST.md`: phase-grouped global queue; treat the first eligible unchecked item as the default next task.
- `DECISION_LOG.md`: durable record of target, runtime, and interface choices.
- `FACT_LOG.md`: durable memory for quirks, constants, and file-format findings; log them once and reuse them later.
- `HANDOFF_LOG.md`: append-only execution history for stop-and-resume work.
- `REFERENCE_ORACLES.md`: every capture, hash manifest, and oracle artifact with its trust level and consumers.
- `SOURCE_CATALOG.md`: authoritative source inventory; prefer local bundle and upstream source before community explanations.
- `PACKAGE_CAPABILITY_MATRIX.md`: repo package inventory and whether each package is in scope for C1.
- `STEP_TEMPLATE.md`: exact required shape for future step additions.

## Execution Rules

- Keep every implementation diff surgical.
- Keep all writable outputs inside `D:\Projects\bun-win32\doom_codex`.
- Do not write under `D:\Projects\bun-win32\doom\`.
- Do not mark a step `[x]` unless the focused test, `bun test`, and typecheck all pass.
- If a behavior is unclear, add a research or oracle-capture step instead of guessing.
