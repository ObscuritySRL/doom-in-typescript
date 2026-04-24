# [ ] STEP 05-009: Reject Visible Interpolation

## Goal

Implement the minimal product surface for reject visible interpolation in the Bun-run playable parity path.

## Prerequisites

- 05-008

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-006-audit-playable-host-surface.json
- src/mainLoop.ts
- src/host/ticAccumulator.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/real-time-main-loop/rejectVisibleInterpolation.ts
- test/playable/real-time-main-loop/reject-visible-interpolation.test.ts

## Test Files

- test/playable/real-time-main-loop/reject-visible-interpolation.test.ts

## Verification

- `bun test test/playable/real-time-main-loop/reject-visible-interpolation.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The reject-visible-interpolation behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 05-010
