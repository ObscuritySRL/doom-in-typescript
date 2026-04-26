# [ ] STEP 05-006: Parse Patch Picture Format

## id

05-006

## lane

wad

## title

Parse Patch Picture Format

## goal

Deliver the smallest verified increment for parse patch picture format while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 00-018

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- map lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/assets/parse-patch-picture-format.ts
- test/vanilla_parity/wad/parse-patch-picture-format.test.ts

## read-only paths

- doom/DOOM1.WAD
- iwad/DOOM1.WAD
- src/wad/
- src/assets/
- reference/manifests/wad-map-summary.json

## research sources

- local IWAD directory
- r_data.c
- w_wad.c
- p_setup.c

## expected changes

- src/assets/parse-patch-picture-format.ts
- test/vanilla_parity/wad/parse-patch-picture-format.test.ts

## test files

- test/vanilla_parity/wad/parse-patch-picture-format.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/wad/parse-patch-picture-format.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 05-006 with test/vanilla_parity/wad/parse-patch-picture-format.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
