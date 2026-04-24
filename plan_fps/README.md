# DOOM Playable Parity Plan

## Mission

Convert the existing deterministic DOOM engine work into a Bun-run, windowed, playable, side-by-side-verifiable DOOM product while preserving vanilla/reference behavior exactly except for fullscreen-vs-windowed presentation.

## Runtime Target

- Final command: `bun run doom.ts`
- Runtime: Bun only
- Package manager, script runner, and test runner: Bun only
- Final target is not a compiled executable, wrapper executable, installer, or packaged binary.

## Active Control Center

- Active plan directory: `plan_fps/`
- Prior-art plan directory: `plan_engine/`
- First eligible step: `00-001 Classify Existing Plan`
- Total playable-plan steps: `223`

The requested total is exactly 223 step files. This plan keeps that total and preserves coverage for every required phase and final acceptance behavior.

## Old Plan Classification

The old `plan_engine/` work is classified as `mixed`: it includes deterministic engine modules plus host, input, UI, audio, save, demo, and parity-gate work. It is not the active control center for this playable plan.

## Ralph-Loop Workflow

1. Open `plan_fps/README.md`.
2. Open `plan_fps/MASTER_CHECKLIST.md`.
3. Scan from the top and choose the first unchecked step whose prerequisites are complete.
4. Read any existing `plan_fps/loop_logs/step_<step-id>_progress.txt`, then read only the selected step file, the shared logs, and exact paths listed in the selected step's Read Only section.
5. Create or update `plan_fps/loop_logs/step_<step-id>_progress.txt` before changing product or plan files. Keep it current with completed work, test results, touched files, blockers, the next exact action, and the remaining planned work required to finish the step.
6. Change only files listed in Expected Changes, plus required control-log/checklist updates and the active step progress log.
7. Run `bun run format` with Biome, then run verification in the listed order.
8. Mark the selected step complete only after verification passes.
9. Append `plan_fps/HANDOFF_LOG.md`, including the exact agent, model, and effort metadata supplied by the Ralph-loop launcher.
10. Commit the verified step and push the current branch directly.
11. Delete only that step's `plan_fps/loop_logs/step_<step-id>_progress.txt` after the step is marked complete, all required verification passes, and the verified commit has been pushed. Do not delete it on blocked, failed, interrupted, or limit-reached work.
12. Stop after one step.

## Publishing Rules

- Every completed Ralph-loop step requires a commit and push before it is considered complete.
- Every audit pass that changes files requires a commit and push before it is considered complete.
- Make repository changes, commits, and pushes as the configured human user only.
- Do not override `user.name`, `user.email`, commit author, commit committer, or publishing identity to an AI or agent identity.
- References to tools, models, or agents are allowed when technically relevant, but they are not authors or publishing identities for this repository.
- Stage files explicitly by path.
- Do not open pull requests.
- Do not use GitHub apps, GitHub API tools, issue automation, release automation, or pull request workflows.

## Shared Files

- `MASTER_CHECKLIST.md`: phase-grouped queue and prerequisite summary.
- `DECISION_LOG.md`: durable decisions.
- `FACT_LOG.md`: durable facts.
- `HANDOFF_LOG.md`: append-only execution history.
- `loop_logs/step_<step-id>_progress.txt`: ignored active-step recovery log with completed work and remaining planned work.
- `PRE_PROMPT.md`: audit-pass prompt used by the audited Ralph-loop script.
- `REFERENCE_ORACLES.md`: oracle artifacts and authority.
- `SOURCE_CATALOG.md`: source authority.
- `PACKAGE_CAPABILITY_MATRIX.md`: package/runtime scope.
- `STEP_TEMPLATE.md`: required step-file shape.

## Ralph-Loop Scripts

- `RALPH_LOOP_CLAUDE_CODE.ps1`: runs an audit pass from `PRE_PROMPT.md`, then a forward step from `PROMPT.md`.
- `RALPH_LOOP_CLAUDE_CODE_NO_AUDIT.ps1`: runs only the forward step from `PROMPT.md`.
- `RALPH_LOOP_CODEX.ps1`: runs an audit pass from `PRE_PROMPT.md`, then a forward step from `PROMPT.md` through `codex exec`.
- `RALPH_LOOP_CODEX_NO_AUDIT.ps1`: runs only the forward step from `PROMPT.md` through `codex exec`.
- Both scripts default to `D:\Projects\doom-in-typescript` as the working directory and write loop output under `plan_fps/loop_logs/`.
- The Codex scripts require the Codex CLI terminal command on `PATH`, or `-CodexCommand <full CLI path>`.
- Handoff entries must record `agent`, `model`, and `effort`. Codex launchers default to `gpt-5.5`; pass `-Model` to override the exact Codex model.

## Boundaries

- Writable workspace root: `D:/Projects/doom-in-typescript`
- Read-only reference roots: `doom/`, `iwad/`, and `reference/`
- Oracle artifacts must be generated under writable project paths such as `test/oracles/fixtures/` or `plan_fps/manifests/`.
- Do not write inside `doom/`, `iwad/`, or `reference/`.
- Do not redistribute proprietary DOOM assets.

## Validation

Run:

```sh
bun run format
bun test plan_fps/validate-plan.test.ts
bun run plan_fps/validate-plan.ts
bun test
bun x tsc --noEmit --project tsconfig.json
```
