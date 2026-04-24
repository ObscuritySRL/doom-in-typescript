# [ ] STEP 00-002: Declare Plan Fps Control Center

## Goal

Implement the minimal product surface for declare plan fps control center in the Bun-run playable parity path.

## Prerequisites

- 00-001

## Read Only

- plan_fps/README.md
- plan_fps/FACT_LOG.md
- plan_fps/DECISION_LOG.md
- package.json
- tsconfig.json

## Consult Only If Blocked

- none

## Expected Changes

- plan_fps/manifests/00-002-declare-plan-fps-control-center.json
- test/plan_fps/00-002-declare-plan-fps-control-center.test.ts

## Test Files

- test/plan_fps/00-002-declare-plan-fps-control-center.test.ts

## Verification

- `bun test test/plan_fps/00-002-declare-plan-fps-control-center.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The declare-plan-fps-control-center behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: record or update the governance decision for declare-plan-fps-control-center
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 00-003
