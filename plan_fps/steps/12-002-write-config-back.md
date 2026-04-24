# [ ] STEP 12-002: Write Config Back

## Goal

Implement the minimal product surface for write config back in the Bun-run playable parity path.

## Prerequisites

- 12-001

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-014-audit-missing-config-persistence.json
- src/config/defaultCfg.ts
- src/config/hostConfig.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/config-persistence/writeConfigBack.ts
- test/playable/config-persistence/write-config-back.test.ts

## Test Files

- test/playable/config-persistence/write-config-back.test.ts

## Verification

- `bun test test/playable/config-persistence/write-config-back.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The write-config-back behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 12-003
