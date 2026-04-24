# [ ] STEP 09-002: Render Viewport Borders

## Goal

Implement the minimal product surface for render viewport borders in the Bun-run playable parity path.

## Prerequisites

- 09-001

## Read Only

- plan_fps/FACT_LOG.md
- plan_fps/manifests/01-012-audit-missing-live-rendering.json
- src/launcher/gameplayRenderer.ts
- src/render/projection.ts

## Consult Only If Blocked

- none

## Expected Changes

- src/playable/rendering-product-integration/renderViewportBorders.ts
- test/playable/rendering-product-integration/render-viewport-borders.test.ts

## Test Files

- test/playable/rendering-product-integration/render-viewport-borders.test.ts

## Verification

- `bun test test/playable/rendering-product-integration/render-viewport-borders.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The render-viewport-borders behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 09-003
