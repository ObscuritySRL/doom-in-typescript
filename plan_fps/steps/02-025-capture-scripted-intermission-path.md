# [ ] STEP 02-025: Capture Scripted Intermission Path

## Goal

Create one oracle artifact for capture scripted intermission path without writing inside reference directories.

## Prerequisites

- 02-024

## Read Only

- plan_fps/SOURCE_CATALOG.md
- plan_fps/REFERENCE_ORACLES.md
- plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json

## Consult Only If Blocked

- none

## Expected Changes

- test/oracles/fixtures/capture-scripted-intermission-path.json
- test/oracles/capture-scripted-intermission-path.test.ts

## Test Files

- test/oracles/capture-scripted-intermission-path.test.ts

## Verification

- `bun test test/oracles/capture-scripted-intermission-path.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The oracle fixture for capture-scripted-intermission-path records source authority, capture command, tick/frame window, and exact expected hashes or traces.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: none unless new reusable fact is discovered
- `DECISION_LOG.md`: none
- `REFERENCE_ORACLES.md`: add the capture-scripted-intermission-path oracle artifact path, authority, and refresh command
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 02-026
