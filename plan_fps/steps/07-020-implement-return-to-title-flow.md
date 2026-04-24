# [ ] STEP 07-020: Implement Return To Title Flow

## Goal

Implement the minimal product surface for implement return to title flow in the Bun-run playable parity path.

## Prerequisites

- 07-019

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-008-audit-missing-launch-to-menu.json
- src/ui/menus.ts
- src/ui/frontEndSequence.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/front-end-menus/implementReturnToTitleFlow.ts
- test/playable/front-end-menus/implement-return-to-title-flow.test.ts

## Test Files

- test/playable/front-end-menus/implement-return-to-title-flow.test.ts

## Verification

- `bun test test/playable/front-end-menus/implement-return-to-title-flow.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The implement-return-to-title-flow behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 08-001
