# [ ] STEP <ID>: <Short Title>

## Goal

<one sentence>

## Prerequisites

- <exact step IDs or none>

## Read Only

- <exact file/path>

## Consult Only If Blocked

- <related step IDs only>

## Expected Changes

- <exact writable path>

## Test Files

- <exact test path>

## Verification

- `bun test <exact test path>`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`
- <extra command only if needed>

## Completion Criteria

- <objective condition>
- <objective condition>
- Verified changes are committed and pushed directly with no pull request.

## Required Log Updates

- `FACT_LOG.md`: <what to add if learned, otherwise "none unless new reusable fact is discovered">
- `DECISION_LOG.md`: <what to add if decision changed, otherwise "none">
- `REFERENCE_ORACLES.md`: <what to add if oracle created/refreshed, otherwise "none">
- `HANDOFF_LOG.md`: append completion entry

## Later Steps That May Benefit

- <step IDs>
