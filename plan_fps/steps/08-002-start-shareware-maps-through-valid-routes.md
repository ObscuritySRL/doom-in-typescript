# [ ] STEP 08-002: Start Shareware Maps Through Valid Routes

## Goal

Implement the minimal product surface for start shareware maps through valid routes in the Bun-run playable parity path.

## Prerequisites

- 08-001

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json
- src/launcher/session.ts
- src/mainLoop.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/game-session-wiring/startSharewareMapsThroughValidRoutes.ts
- test/playable/game-session-wiring/start-shareware-maps-through-valid-routes.test.ts

## Test Files

- test/playable/game-session-wiring/start-shareware-maps-through-valid-routes.test.ts

## Verification

- `bun test test/playable/game-session-wiring/start-shareware-maps-through-valid-routes.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The start-shareware-maps-through-valid-routes behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 08-003
