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
- `plan_fps/loop_logs/step_<step-id>_progress.txt` is the standing local recovery exception; update it while the step is active and delete it only after completion, verification, commit, and push.

## Test Files

- <exact test path>

## Verification

- `bun run format`
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
- `loop_logs/step_<step-id>_progress.txt`: keep completed work and remaining planned work current until the verified step is pushed
- `HANDOFF_LOG.md`: append completion entry with exact `agent`, `model`, and `effort` execution metadata

## Later Steps That May Benefit

- <step IDs>
