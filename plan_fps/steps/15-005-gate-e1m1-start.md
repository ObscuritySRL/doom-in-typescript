# [ ] STEP 15-005: Gate E1M1 Start

## Goal

Implement the minimal product surface for gate e1m1 start in the Bun-run playable parity path.

## Prerequisites

- 15-004

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/REFERENCE_ORACLES.md
- plan_fps/MASTER_CHECKLIST.md

## Consult Only If Blocked

- none

## Expected Changes

- test/playable/acceptance/gate-e1m1-start.test.ts
- plan_fps/manifests/15-005-gate-e1m1-start.json

## Test Files

- test/playable/acceptance/gate-e1m1-start.test.ts

## Verification

- `bun test test/playable/acceptance/gate-e1m1-start.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The gate-e1m1-start behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: add or refresh the gate evidence for gate-e1m1-start if a new oracle artifact is produced
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 15-006
