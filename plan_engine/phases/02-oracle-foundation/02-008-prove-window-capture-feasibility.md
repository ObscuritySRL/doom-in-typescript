# [ ] STEP 02-008: prove-window-capture-feasibility

## Goal

Implement prove window capture feasibility so it matches the canonical reference behavior and is locked by the listed test coverage.

## Prerequisites

- 02-007

## Read Only

- d:\Projects\bun-win32\doom_codex\plans\FACT_LOG.md
- d:\Projects\bun-win32\doom_codex\plans\REFERENCE_ORACLES.md
- d:\Projects\bun-win32\doom\universal-doom\DOOM.EXE
- d:\Projects\bun-win32\doom\universal-doom\chocolate-doom.cfg

## Consult Only If Blocked

- 02-007
- 02-009

## Expected Changes

- d:\Projects\bun-win32\doom_codex\tools\reference\windowCaptureProbe.ts

## Test Files

- d:\Projects\bun-win32\doom_codex\test\oracles\window-capture-feasibility.test.ts

## Verification

- `bun test test/oracles/window-capture-feasibility.test.ts`
- `bun test`
- `bun x tsc --noEmit --project d:\Projects\bun-win32\doom_codex\tsconfig.json`

## Completion Criteria

- The derived artifact or tooling described for this step is reproducible from the listed reference material and remains confined to doom_codex.
- The targeted test file `test/oracles/window-capture-feasibility.test.ts` covers the normal path and at least one parity-sensitive edge case, and every listed verification command passes.

## Required Log Updates

- `FACT_LOG.md`: add any newly discovered constants, quirks, or file-format facts with future step IDs before leaving the step.
- `DECISION_LOG.md`: update only if this step changes a chosen interface, host boundary, or parity rule.
- `REFERENCE_ORACLES.md`: add or update the oracle record if this step creates or refreshes a capture, manifest, or replay fixture.
- `HANDOFF_LOG.md`: append the completion summary, verification commands, results, next eligible steps, and open risks.

## Later Steps That May Benefit

- 02-009
- 17-010
