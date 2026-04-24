# [ ] STEP 15-002: Gate Bun Launch Smoke

## Goal

Implement the minimal product surface for gate bun launch smoke in the Bun-run playable parity path.

## Prerequisites

- 15-001

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/REFERENCE_ORACLES.md
- plan_fps/MASTER_CHECKLIST.md

## Consult Only If Blocked

- none

## Expected Changes

- test/playable/acceptance/gate-bun-launch-smoke.test.ts
- plan_fps/manifests/15-002-gate-bun-launch-smoke.json

## Test Files

- test/playable/acceptance/gate-bun-launch-smoke.test.ts

## Verification

- `bun test test/playable/acceptance/gate-bun-launch-smoke.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The gate-bun-launch-smoke behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: add or refresh the gate evidence for gate-bun-launch-smoke if a new oracle artifact is produced
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 15-003
