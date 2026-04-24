# [ ] STEP 14-001: Lock Bun Run Doom Command

## Goal

Implement the minimal product surface for lock bun run doom command in the Bun-run playable parity path.

## Prerequisites

- 13-011

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/PACKAGE_CAPABILITY_MATRIX.md
- package.json
- src/main.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/bun-launch-local-distribution-boundary/lockBunRunDoomCommand.ts
- test/playable/bun-launch-local-distribution-boundary/lock-bun-run-doom-command.test.ts

## Test Files

- test/playable/bun-launch-local-distribution-boundary/lock-bun-run-doom-command.test.ts

## Verification

- `bun test test/playable/bun-launch-local-distribution-boundary/lock-bun-run-doom-command.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The lock-bun-run-doom-command behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 14-002
