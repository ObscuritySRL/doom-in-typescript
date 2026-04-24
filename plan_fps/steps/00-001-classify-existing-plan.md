# [ ] STEP 00-001: Classify Existing Plan

## Goal

Classify the old plan_engine/ work and record the result as durable playable-plan fact and decision data.

## Prerequisites

- none

## Read Only

- plan_engine/PROMPT.md
- plan_engine/README.md
- plan_engine/MASTER_CHECKLIST.md
- plan_engine/DECISION_LOG.md
- plan_engine/FACT_LOG.md
- plan_engine/HANDOFF_LOG.md
- plan_engine/REFERENCE_ORACLES.md
- plan_engine/SOURCE_CATALOG.md
- plan_engine/PACKAGE_CAPABILITY_MATRIX.md
- plan_engine/STEP_TEMPLATE.md
- package.json
- src/main.ts

## Consult Only If Blocked

- none

## Expected Changes

- plan_fps/manifests/existing-plan-classification.json
- test/plan_fps/existing-plan-classification.test.ts
- plan_fps/DECISION_LOG.md
- plan_fps/FACT_LOG.md
- plan_fps/HANDOFF_LOG.md

## Test Files

- test/plan_fps/existing-plan-classification.test.ts

## Verification

- `bun test test/plan_fps/existing-plan-classification.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## Completion Criteria

- The classify-existing-plan behavior is wired only through the Bun runtime path and remains compatible with deterministic replay.
- The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.

## Required Log Updates

- `FACT_LOG.md`: record the old plan classification and evidence paths
- `DECISION_LOG.md`: record the accepted mixed classification if it changes
- `REFERENCE_ORACLES.md`: none
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- 00-002
