# [ ] STEP 08-001: Start E1M1 From Menu

## Goal

Implement the minimal product surface for start e1m1 from menu in the Bun-run playable parity path.

## Prerequisites

- 07-020

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json
- src/launcher/session.ts
- src/mainLoop.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/game-session-wiring/startE1m1FromMenu.ts
- test/playable/game-session-wiring/start-e1m1-from-menu.test.ts

## Test Files

- test/playable/game-session-wiring/start-e1m1-from-menu.test.ts

## Verification

- `bun test test/playable/game-session-wiring/start-e1m1-from-menu.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The start-e1m1-from-menu behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 08-002
