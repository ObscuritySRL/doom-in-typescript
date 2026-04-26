# [ ] STEP 09-018: Implement Sprite Projection

## id

09-018

## lane

render

## title

Implement Sprite Projection

## goal

Deliver the smallest verified increment for implement sprite projection while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 05-028
- 06-032
- 07-034

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/render/implement-sprite-projection.ts
- test/vanilla_parity/render/implement-sprite-projection.test.ts

## read-only paths

- src/render/
- src/ui/statusBar.ts
- src/ui/automap.ts
- test/render/
- test/ui/

## research sources

- r_main.c
- r_bsp.c
- r_segs.c
- r_plane.c
- r_draw.c
- r_things.c
- st_stuff.c
- am_map.c

## expected changes

- src/render/implement-sprite-projection.ts
- test/vanilla_parity/render/implement-sprite-projection.test.ts

## test files

- test/vanilla_parity/render/implement-sprite-projection.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/render/implement-sprite-projection.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 09-018 with test/vanilla_parity/render/implement-sprite-projection.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
