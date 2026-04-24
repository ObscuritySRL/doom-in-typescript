# [ ] STEP 04-005: Define Aspect Correction Policy

## Goal

Implement the minimal product surface for define aspect correction policy in the Bun-run playable parity path.

## Prerequisites

- 04-004

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-006-audit-playable-host-surface.json
- src/launcher/win32.ts
- src/host/windowPolicy.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/window-host/defineAspectCorrectionPolicy.ts
- test/playable/window-host/define-aspect-correction-policy.test.ts

## Test Files

- test/playable/window-host/define-aspect-correction-policy.test.ts

## Verification

- `bun test test/playable/window-host/define-aspect-correction-policy.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The define-aspect-correction-policy behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 04-006
