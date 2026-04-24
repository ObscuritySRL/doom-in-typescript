# [ ] STEP 17-002: bundled-demo-sync

## Goal

Implement bundled demo sync so it matches the canonical reference behavior and is locked by the listed test coverage.

## Prerequisites

- 17-001

## Read Only

- d:\Projects\bun-win32\doom_codex\plans\FACT_LOG.md
- d:\Projects\bun-win32\doom_codex\plans\REFERENCE_ORACLES.md
- d:\Projects\bun-win32\doom\universal-doom\DOOM.EXE
- d:\Projects\bun-win32\doom\universal-doom\DOOMD.EXE

## Consult Only If Blocked

- 17-001
- 17-003

## Expected Changes

- d:\Projects\bun-win32\doom_codex\test\parity\fixtures\demoSync.json

## Test Files

- d:\Projects\bun-win32\doom_codex\test\parity\bundled-demo-sync.test.ts

## Verification

- `bun test test/parity/bundled-demo-sync.test.ts`
- `bun test`
- `bun x tsc --noEmit --project d:\Projects\bun-win32\doom_codex\tsconfig.json`

## Completion Criteria

- The derived artifact or tooling described for this step is reproducible from the listed reference material and remains confined to doom_codex.
- The targeted test file `test/parity/bundled-demo-sync.test.ts` covers the normal path and at least one parity-sensitive edge case, and every listed verification command passes.

## Required Log Updates

- `FACT_LOG.md`: add any newly discovered constants, quirks, or file-format facts with future step IDs before leaving the step.
- `DECISION_LOG.md`: update only if this step changes a chosen interface, host boundary, or parity rule.
- `REFERENCE_ORACLES.md`: add or update the oracle record if this step creates or refreshes a capture, manifest, or replay fixture.
- `HANDOFF_LOG.md`: append the completion summary, verification commands, results, next eligible steps, and open risks.

## Later Steps That May Benefit

- 17-003
- 17-010
