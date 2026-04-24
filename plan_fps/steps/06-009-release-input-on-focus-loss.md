# [ ] STEP 06-009: Release Input On Focus Loss

## Goal

Implement the minimal product surface for release input on focus loss in the Bun-run playable parity path.

## Prerequisites

- 06-008

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-010-audit-missing-live-input.json
- src/input/ticcmd.ts
- src/input/keyboard.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/input/releaseInputOnFocusLoss.ts
- test/playable/input/release-input-on-focus-loss.test.ts

## Test Files

- test/playable/input/release-input-on-focus-loss.test.ts

## Verification

- `bun test test/playable/input/release-input-on-focus-loss.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The release-input-on-focus-loss behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 06-010
