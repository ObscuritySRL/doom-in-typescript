# [ ] STEP 03-028: Route Input Through Responder Chain

## id

03-028

## lane

launch

## title

Route Input Through Responder Chain

## goal

Deliver the smallest verified increment for route input through responder chain while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 00-018

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- map lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/bootstrap/route-input-through-responder-chain.ts
- test/vanilla_parity/launch/route-input-through-responder-chain.test.ts

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

- src/bootstrap/route-input-through-responder-chain.ts
- test/vanilla_parity/launch/route-input-through-responder-chain.test.ts

## test files

- test/vanilla_parity/launch/route-input-through-responder-chain.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/launch/route-input-through-responder-chain.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 03-028 with test/vanilla_parity/launch/route-input-through-responder-chain.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
