# plan_vanilla_parity

## Mission

Build a full playable TypeScript/Bun DOOM that is indistinguishable from the released DOOM when this implementation and the selected local reference are launched cleanly and driven by the exact same inputs from launch. All quirks, timing, bugs, limits, menus, demos, save/load behavior, rendering, audio, input, and gameplay semantics must exist unless a missing proprietary asset makes that impossible.

## Active Control Center

- Active plan directory: `plan_vanilla_parity/`.
- Prior art only: `plan_engine/` and `plan_fps/`.
- Total steps: `398`.
- First eligible step: `00-001 establish-vanilla-parity-control-center`.
- Primary target: shareware DOOM 1.9 with local `DOOM1.WAD`.
- Later targets: user-supplied registered or Ultimate `DOOM.WAD`; no proprietary assets are redistributed.

## Current State Inventory

- `bun run doom.ts --help` fails with `Module not found "doom.ts"`.
- `package.json` only exposes `start: bun run src/main.ts`.
- `src/main.ts` is a simplified launcher, not the vanilla `D_DoomMain` launch path.
- `src/playable/` contains many contract or manifest-oriented modules, not a proven final side-by-side product path.
- `test/oracles/fixtures/capture-final-side-by-side-replay.json` still records `pending-unimplemented-side-by-side-surface`.
- `test/playable/acceptance/gate-final-side-by-side.test.ts` passes by locking manifest payloads, not by running final parity.
- `plan_fps` validation reports 223 steps; that is not acceptance evidence.
- Local hashes observed: `DOOMD.EXE` `9D321660...CFAE37B`, `DOOM.EXE` `5CA97717...8B8F1D2`, `DOOM1.WAD` `1D7D43BE...26CAC771`.

## Ralph Loop Rules

1. Read `AGENTS.md`, this README, `MASTER_CHECKLIST.md`, and the selected step file.
2. Choose the first unchecked step whose prerequisites are complete in the lane assigned by the Ralph-loop launcher. If no lane is supplied, the launcher acquires the first eligible unlocked lane.
3. Read only the selected step's listed read-only paths plus shared plan files.
4. Forward/no-audit loop agents must not read or update any `AUDIT_LOG.md`; audit logs are reserved for explicit audit-only workflows.
5. Touch only the selected step's write lock and expected changes, plus required plan control updates.
6. Add or update tests for every implementation change.
7. Run `bun run format`, focused `bun test <path>`, full `bun test`, and `bun x tsc --noEmit --project tsconfig.json` in order.
8. Commit and push directly with local git commands before marking a step complete.
9. Never use GitHub API, GitHub apps, PR workflow, npm, yarn, pnpm, npx, node, jest, vitest, mocha, ts-node, or tsx.

## Ralph Loop Scripts

- `RALPH_LOOP_CODEX.ps1`: lane-locked Codex Ralph loop for `plan_vanilla_parity`.
- `RALPH_LOOP_CODEX_NO_AUDIT.ps1`: same lane-locked forward loop without any audit pre-pass.
- `RALPH_LOOP_CLAUDE_CODE.ps1`: lane-locked Claude Code Ralph loop for `plan_vanilla_parity`.
- `RALPH_LOOP_CLAUDE_CODE_NO_AUDIT.ps1`: same lane-locked forward loop without any audit pre-pass.
- `lane-lock.ts`: Bun helper used by the PowerShell launchers for lane selection, atomic lock acquisition, heartbeat, stale-lock recovery, and release.
- `loop_logs/`: ignored local response and recovery logs.
- `lane_locks/`: ignored durable lane leases shared by parallel loop processes.

Use `-Lane <lane>` to pin a loop to one lane. Omit `-Lane` to let the launcher pick the first eligible lane that is not currently locked. Lane locks are lease-based and heartbeated while the agent is running. A normal exit releases the lock; a premature Ctrl-C or process loss leaves a lock file that expires and can be reclaimed after the lease. Long-running process status prints every 180 seconds by default; pass `-ProgressStatusSeconds 0` to suppress repeated status lines.

The immediate lane roots are `governance`, `inventory`, `oracle`, `launch`, `core`, and `wad`. If one of those lanes is locked, auto-selection must skip it and acquire the next eligible unlocked lane.

## Acceptance Standard

Intermediate gates may use sampled hashes. Final gates must run the implementation and reference from clean launch with the same deterministic input stream and compare deterministic state, framebuffer, audio, music events, menu transitions, level transitions, save/load bytes, demo playback, and full-playthrough completion. The default allowed difference is none.

## Validation

```sh
bun run format
bun test plan_vanilla_parity/validate-plan.test.ts
bun run plan_vanilla_parity/validate-plan.ts
bun test
bun x tsc --noEmit --project tsconfig.json
```
