# [ ] STEP 11-001: Implement Save Slot Ui

## Goal

Implement the minimal product surface for implement save slot ui in the Bun-run playable parity path.

## Prerequisites

- 10-014

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-013-audit-missing-save-load-ui.json
- src/save/loadgame.ts
- src/save/saveHeader.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/save-load-playability/implementSaveSlotUi.ts
- test/playable/save-load-playability/implement-save-slot-ui.test.ts

## Test Files

- test/playable/save-load-playability/implement-save-slot-ui.test.ts

## Verification

- `bun test test/playable/save-load-playability/implement-save-slot-ui.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The implement-save-slot-ui behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 11-002
