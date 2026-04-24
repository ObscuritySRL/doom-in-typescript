# [ ] STEP 08-014: Wire Live Sound Music Triggers

## Goal

Implement the minimal product surface for wire live sound music triggers in the Bun-run playable parity path.

## Prerequisites

- 08-013

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json
- src/launcher/session.ts
- src/mainLoop.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/game-session-wiring/wireLiveSoundMusicTriggers.ts
- test/playable/game-session-wiring/wire-live-sound-music-triggers.test.ts

## Test Files

- test/playable/game-session-wiring/wire-live-sound-music-triggers.test.ts

## Verification

- `bun test test/playable/game-session-wiring/wire-live-sound-music-triggers.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The wire-live-sound-music-triggers behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 09-001
