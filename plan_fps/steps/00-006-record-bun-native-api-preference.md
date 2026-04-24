# [ ] STEP 00-006: Record Bun Native Api Preference

## Goal

Implement the minimal product surface for record bun native api preference in the Bun-run playable parity path.

## Prerequisites

- 00-005

## Read Only

- plan_fps/README.md
- plan_fps/FACT_LOG.md
- plan_fps/DECISION_LOG.md
- package.json
- tsconfig.json

## Consult Only If Blocked

- none

## Expected Changes

- plan_fps/manifests/00-006-record-bun-native-api-preference.json
- test/plan_fps/00-006-record-bun-native-api-preference.test.ts

## Test Files

- test/plan_fps/00-006-record-bun-native-api-preference.test.ts

## Verification

- `bun test test/plan_fps/00-006-record-bun-native-api-preference.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The record-bun-native-api-preference behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: record or update the governance decision for record-bun-native-api-preference
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 00-007
