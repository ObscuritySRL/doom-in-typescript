# [ ] STEP 08-021: Implement Floor Specials

## id

08-021

## lane

ai

## title

Implement Floor Specials

## goal

Deliver the smallest verified increment for implement floor specials while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 07-034

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/specials/implement-floor-specials.ts
- test/vanilla_parity/ai/implement-floor-specials.test.ts

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

- src/specials/implement-floor-specials.ts
- test/vanilla_parity/ai/implement-floor-specials.test.ts

## test files

- test/vanilla_parity/ai/implement-floor-specials.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/ai/implement-floor-specials.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 08-021 with test/vanilla_parity/ai/implement-floor-specials.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
