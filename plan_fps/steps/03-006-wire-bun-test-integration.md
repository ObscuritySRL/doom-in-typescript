# [ ] STEP 03-006: Wire Bun Test Integration

## Goal

Implement the minimal product surface for wire bun test integration in the Bun-run playable parity path.

## Prerequisites

- 03-005

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json
- src/main.ts
- package.json

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/bun-runtime-entry-point/wireBunTestIntegration.ts
- test/playable/bun-runtime-entry-point/wire-bun-test-integration.test.ts

## Test Files

- test/playable/bun-runtime-entry-point/wire-bun-test-integration.test.ts

## Verification

- `bun test test/playable/bun-runtime-entry-point/wire-bun-test-integration.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The wire-bun-test-integration behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 03-007
