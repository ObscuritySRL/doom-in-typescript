# [ ] STEP 13-002: Replay Demo1 Deterministically

## Goal

Implement the minimal product surface for replay demo1 deterministically in the Bun-run playable parity path.

## Prerequisites

- 13-001

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json
- src/demo/demoPlayback.ts
- src/oracles/inputScript.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/demo-replay/replayDemo1Deterministically.ts
- test/playable/demo-replay/replay-demo1-deterministically.test.ts

## Test Files

- test/playable/demo-replay/replay-demo1-deterministically.test.ts

## Verification

- `bun test test/playable/demo-replay/replay-demo1-deterministically.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The replay-demo1-deterministically behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 13-003
