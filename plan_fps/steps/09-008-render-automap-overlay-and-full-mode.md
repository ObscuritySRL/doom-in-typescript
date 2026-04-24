# [ ] STEP 09-008: Render Automap Overlay And Full Mode

## Goal

Implement the minimal product surface for render automap overlay and full mode in the Bun-run playable parity path.

## Prerequisites

- 09-007

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-012-audit-missing-live-rendering.json
- src/launcher/gameplayRenderer.ts
- src/render/projection.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/rendering-product-integration/renderAutomapOverlayAndFullMode.ts
- test/playable/rendering-product-integration/render-automap-overlay-and-full-mode.test.ts

## Test Files

- test/playable/rendering-product-integration/render-automap-overlay-and-full-mode.test.ts

## Verification

- `bun test test/playable/rendering-product-integration/render-automap-overlay-and-full-mode.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The render-automap-overlay-and-full-mode behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 09-009
