# [ ] STEP 00-014: Test Plan Validation Script

## Goal

Implement the minimal product surface for test plan validation script in the Bun-run playable parity path.

## Prerequisites

- 00-013

## Read Only

- plan_fps/README.md
- plan_fps/FACT_LOG.md
- plan_fps/DECISION_LOG.md
- package.json
- tsconfig.json

## Consult Only If Blocked

- none

## Expected Changes

- plan_fps/validate-plan.test.ts

## Test Files

- plan_fps/validate-plan.test.ts

## Verification

- `bun test plan_fps/validate-plan.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The test-plan-validation-script behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: record or update the governance decision for test-plan-validation-script
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 01-001
