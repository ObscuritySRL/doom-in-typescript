# [ ] STEP 07-030: Compare Scripted Pickup Oracle

## id

07-030

## lane

gameplay

## title

Compare Scripted Pickup Oracle

## goal

Deliver the smallest verified increment for compare scripted pickup oracle while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 04-030
- 06-032

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/player/compare-scripted-pickup-oracle.ts
- test/vanilla_parity/player/compare-scripted-pickup-oracle.test.ts

## read-only paths

- src/player/
- src/world/
- src/input/
- test/player/

## research sources

- p_user.c
- p_pspr.c
- p_inter.c
- p_mobj.c
- g_game.c

## expected changes

- src/player/compare-scripted-pickup-oracle.ts
- test/vanilla_parity/player/compare-scripted-pickup-oracle.test.ts

## test files

- test/vanilla_parity/player/compare-scripted-pickup-oracle.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/player/compare-scripted-pickup-oracle.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 07-030 with test/vanilla_parity/player/compare-scripted-pickup-oracle.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
