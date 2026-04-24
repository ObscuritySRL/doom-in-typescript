# [ ] STEP 10-006: Connect Music System

## Goal

Implement the minimal product surface for connect music system in the Bun-run playable parity path.

## Prerequisites

- 10-005

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-011-audit-missing-live-audio.json
- src/audio/soundSystem.ts
- src/audio/musicSystem.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/audio-product-integration/connectMusicSystem.ts
- test/playable/audio-product-integration/connect-music-system.test.ts

## Test Files

- test/playable/audio-product-integration/connect-music-system.test.ts

## Verification

- `bun test test/playable/audio-product-integration/connect-music-system.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The connect-music-system behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 10-007
