# [ ] STEP 01-010: Audit Missing Live Input

## Goal

Create a machine-readable manifest that answers audit missing live input for the playable parity effort.

## Prerequisites

- 01-009

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/SOURCE_CATALOG.md
- package.json
- tsconfig.json
- src/main.ts

## Consult Only If Blocked

- none

## Expected Changes

- plan_fps/manifests/01-010-audit-missing-live-input.json
- test/plan_fps/01-010-audit-missing-live-input.test.ts

## Test Files

- test/plan_fps/01-010-audit-missing-live-input.test.ts

## Verification

- `bun test test/plan_fps/01-010-audit-missing-live-input.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The manifest for audit-missing-live-input is sorted, machine-readable, and contains exact paths or explicit nulls for missing surfaces.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: record reusable findings from audit-missing-live-input
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 01-011
