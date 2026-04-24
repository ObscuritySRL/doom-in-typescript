# [ ] STEP 04-007: deterministic-rng-stream

## Goal

Implement deterministic rng stream so it matches the canonical reference behavior and is locked by the listed test coverage.

## Prerequisites

- 04-006

## Read Only

- d:\Projects\bun-win32\doom_codex\plans\FACT_LOG.md
- https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/doomdef.h
- https://github.com/chocolate-doom/chocolate-doom/blob/master/src/m_fixed.c
- https://github.com/chocolate-doom/chocolate-doom/blob/master/src/tables.c

## Consult Only If Blocked

- 04-006
- 04-008

## Expected Changes

- d:\Projects\bun-win32\doom_codex\src\core\rng.ts

## Test Files

- d:\Projects\bun-win32\doom_codex\test\core\rng.test.ts

## Verification

- `bun test test/core/rng.test.ts`
- `bun test`
- `bun x tsc --noEmit --project d:\Projects\bun-win32\doom_codex\tsconfig.json`

## Completion Criteria

- The implementation files listed for this step match the listed reference behavior without widening the agreed interface or behavior surface.
- The targeted test file `test/core/rng.test.ts` covers the normal path and at least one parity-sensitive edge case, and every listed verification command passes.

## Required Log Updates

- `FACT_LOG.md`: add any newly discovered constants, quirks, or file-format facts with future step IDs before leaving the step.
- `DECISION_LOG.md`: update only if this step changes a chosen interface, host boundary, or parity rule.
- `REFERENCE_ORACLES.md`: add or update the oracle record if this step creates or refreshes a capture, manifest, or replay fixture.
- `HANDOFF_LOG.md`: append the completion summary, verification commands, results, next eligible steps, and open risks.

## Later Steps That May Benefit

- 04-008
- 17-010
