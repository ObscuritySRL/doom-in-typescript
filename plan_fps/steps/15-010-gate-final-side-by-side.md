# [ ] STEP 15-010: Gate Final Side By Side

## Goal

Verify final side-by-side parity using bun run doom.ts, the same input script, sampled framebuffer/state/audio/music traces, and no unlogged intentional differences except windowed presentation.

## Prerequisites

- 15-009

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/REFERENCE_ORACLES.md
- plan_fps/MASTER_CHECKLIST.md

## Consult Only If Blocked

- none

## Expected Changes

- test/playable/acceptance/gate-final-side-by-side.test.ts
- plan_fps/manifests/15-010-gate-final-side-by-side.json

## Test Files

- test/playable/acceptance/gate-final-side-by-side.test.ts

## Verification

- `bun test test/playable/acceptance/gate-final-side-by-side.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The final gate proves reference and implementation start clean, use the same input script and tick count, reach the same menu/E1M1 transitions, and match sampled hashes/traces while launching with bun run doom.ts.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: add or refresh the gate evidence for gate-final-side-by-side if a new oracle artifact is produced
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- none
