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
2. Choose the first unchecked step whose prerequisites are complete unless coordinating parallel lane work explicitly.
3. Read only the selected step's listed read-only paths plus shared plan files.
4. Touch only the selected step's write lock and expected changes, plus required plan control updates.
5. Add or update tests for every implementation change.
6. Run `bun run format`, focused `bun test <path>`, full `bun test`, and `bun x tsc --noEmit --project tsconfig.json` in order.
7. Commit and push directly with local git commands before marking a step complete.
8. Never use GitHub API, GitHub apps, PR workflow, npm, yarn, pnpm, npx, node, jest, vitest, mocha, ts-node, or tsx.

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
