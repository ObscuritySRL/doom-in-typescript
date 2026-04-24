# [ ] STEP 13-010: sky-semantics

## Goal

Implement sky semantics so it matches the canonical reference behavior and is locked by the listed test coverage.

## Prerequisites

- 13-009

## Read Only

- d:\Projects\bun-win32\doom_codex\plans\FACT_LOG.md
- d:\Projects\bun-win32\doom\universal-doom\DOOM1.WAD
- https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_bsp.c
- https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_plane.c

## Consult Only If Blocked

- 13-009
- 13-011

## Expected Changes

- d:\Projects\bun-win32\doom_codex\src\render\sky.ts

## Test Files

- d:\Projects\bun-win32\doom_codex\test\render\sky.test.ts

## Verification

- `bun test test/render/sky.test.ts`
- `bun test`
- `bun x tsc --noEmit --project d:\Projects\bun-win32\doom_codex\tsconfig.json`

## Completion Criteria

- The implementation files listed for this step match the listed reference behavior without widening the agreed interface or behavior surface.
- The targeted test file `test/render/sky.test.ts` covers the normal path and at least one parity-sensitive edge case, and every listed verification command passes.

## Required Log Updates

- `FACT_LOG.md`: add any newly discovered constants, quirks, or file-format facts with future step IDs before leaving the step.
- `DECISION_LOG.md`: update only if this step changes a chosen interface, host boundary, or parity rule.
- `REFERENCE_ORACLES.md`: add or update the oracle record if this step creates or refreshes a capture, manifest, or replay fixture.
- `HANDOFF_LOG.md`: append the completion summary, verification commands, results, next eligible steps, and open risks.

## Later Steps That May Benefit

- 13-011
- 17-010
