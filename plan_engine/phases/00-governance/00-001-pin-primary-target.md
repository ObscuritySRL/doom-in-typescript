# [x] STEP 00-001: pin-primary-target

## Goal

Implement pin primary target so it matches the canonical reference behavior and is locked by the listed test coverage.

## Prerequisites

- None.

## Read Only

- d:\Projects\bun-win32\doom_codex\plans\README.md
- d:\Projects\bun-win32\doom_codex\plans\FACT_LOG.md
- d:\Projects\bun-win32\doom\universal-doom\README.md
- d:\Projects\bun-win32\doom\universal-doom\stdout.txt

## Consult Only If Blocked

- 00-002

## Expected Changes

- d:\Projects\bun-win32\doom_codex\src\reference\target.ts

## Test Files

- d:\Projects\bun-win32\doom_codex\test\reference\target.test.ts

## Verification

- `bun test test/reference/target.test.ts`
- `bun test`
- `bun x tsc --noEmit --project d:\Projects\bun-win32\doom_codex\tsconfig.json`

## Completion Criteria

- The implementation files listed for this step match the listed reference behavior without widening the agreed interface or behavior surface.
- The targeted test file `test/reference/target.test.ts` covers the normal path and at least one parity-sensitive edge case, and every listed verification command passes.

## Required Log Updates

- `FACT_LOG.md`: add any newly discovered constants, quirks, or file-format facts with future step IDs before leaving the step.
- `DECISION_LOG.md`: update only if this step changes a chosen interface, host boundary, or parity rule.
- `REFERENCE_ORACLES.md`: add or update the oracle record if this step creates or refreshes a capture, manifest, or replay fixture.
- `HANDOFF_LOG.md`: append the completion summary, verification commands, results, next eligible steps, and open risks.

## Later Steps That May Benefit

- 00-002
- 17-010
