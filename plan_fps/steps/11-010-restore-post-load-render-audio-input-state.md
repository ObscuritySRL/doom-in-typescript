# [ ] STEP 11-010: Restore Post Load Render Audio Input State

## Goal

Implement the minimal product surface for restore post load render audio input state in the Bun-run playable parity path.

## Prerequisites

- 11-009

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-013-audit-missing-save-load-ui.json
- src/save/loadgame.ts
- src/save/saveHeader.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/save-load-playability/restorePostLoadRenderAudioInputState.ts
- test/playable/save-load-playability/restore-post-load-render-audio-input-state.test.ts

## Test Files

- test/playable/save-load-playability/restore-post-load-render-audio-input-state.test.ts

## Verification

- `bun test test/playable/save-load-playability/restore-post-load-render-audio-input-state.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The restore-post-load-render-audio-input-state behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 11-011
