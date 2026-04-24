# [ ] STEP 06-005: Preserve Key Repeat Behavior

## Goal

Implement the minimal product surface for preserve key repeat behavior in the Bun-run playable parity path.

## Prerequisites

- 06-004

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-010-audit-missing-live-input.json
- src/input/ticcmd.ts
- src/input/keyboard.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/input/preserveKeyRepeatBehavior.ts
- test/playable/input/preserve-key-repeat-behavior.test.ts

## Test Files

- test/playable/input/preserve-key-repeat-behavior.test.ts

## Verification

- `bun test test/playable/input/preserve-key-repeat-behavior.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The preserve-key-repeat-behavior behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 06-006
