# [ ] STEP 08-026: Implement Animated Flats And Textures

## id

08-026

## lane

ai

## title

Implement Animated Flats And Textures

## goal

Deliver the smallest verified increment for implement animated flats and textures while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 07-034

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/ai/implement-animated-flats-and-textures.ts
- test/vanilla_parity/ai/implement-animated-flats-and-textures.test.ts

## read-only paths

- src/ai/
- src/specials/
- src/world/
- test/ai/
- test/specials/

## research sources

- p_enemy.c
- p_spec.c
- p_doors.c
- p_floor.c
- p_ceilng.c
- p_plats.c

## expected changes

- src/ai/implement-animated-flats-and-textures.ts
- test/vanilla_parity/ai/implement-animated-flats-and-textures.test.ts

## test files

- test/vanilla_parity/ai/implement-animated-flats-and-textures.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/ai/implement-animated-flats-and-textures.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 08-026 with test/vanilla_parity/ai/implement-animated-flats-and-textures.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
