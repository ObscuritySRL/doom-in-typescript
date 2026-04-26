# [ ] STEP 03-008: Implement D DoomMain Init Order Skeleton

## id

03-008

## lane

launch

## title

Implement D DoomMain Init Order Skeleton

## goal

Deliver the smallest verified increment for implement d doommain init order skeleton while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 00-018

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- map lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/bootstrap/implement-d-doommain-init-order-skeleton.ts
- test/vanilla_parity/launch/implement-d-doommain-init-order-skeleton.test.ts

## read-only paths

- src/main.ts
- src/launcher/
- src/bootstrap/
- src/host/
- src/input/
- doom/default.cfg
- doom/chocolate-doom.cfg

## research sources

- d_main.c
- g_game.c
- i_timer.c
- i_video.c
- m_menu.c

## expected changes

- src/bootstrap/implement-d-doommain-init-order-skeleton.ts
- test/vanilla_parity/launch/implement-d-doommain-init-order-skeleton.test.ts

## test files

- test/vanilla_parity/launch/implement-d-doommain-init-order-skeleton.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/launch/implement-d-doommain-init-order-skeleton.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 03-008 with test/vanilla_parity/launch/implement-d-doommain-init-order-skeleton.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
