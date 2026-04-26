# [ ] STEP 06-019: Implement Line Of Sight Semantics

## id

06-019

## lane

map

## title

Implement Line Of Sight Semantics

## goal

Deliver the smallest verified increment for implement line of sight semantics while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 04-030
- 05-028

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/map/implement-line-of-sight-semantics.ts
- test/vanilla_parity/map/implement-line-of-sight-semantics.test.ts

## read-only paths

- src/map/
- src/world/
- test/map/
- test/world/
- doom/DOOM1.WAD

## research sources

- p_setup.c
- p_map.c
- p_maputl.c
- p_sight.c
- p_mobj.c

## expected changes

- src/map/implement-line-of-sight-semantics.ts
- test/vanilla_parity/map/implement-line-of-sight-semantics.test.ts

## test files

- test/vanilla_parity/map/implement-line-of-sight-semantics.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/map/implement-line-of-sight-semantics.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 06-019 with test/vanilla_parity/map/implement-line-of-sight-semantics.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
