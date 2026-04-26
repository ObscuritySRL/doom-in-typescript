# [ ] STEP 04-013: Implement NetUpdate No Network Single Player Path

## id

04-013

## lane

core

## title

Implement NetUpdate No Network Single Player Path

## goal

Deliver the smallest verified increment for implement netupdate no network single player path while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 00-018

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- map lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/core/implement-netupdate-no-network-single-player-path.ts
- test/vanilla_parity/core/implement-netupdate-no-network-single-player-path.test.ts

## read-only paths

- src/core/
- src/demo/
- src/mainLoop.ts
- test/core/
- test/demo/

## research sources

- m_fixed.c
- tables.c
- d_main.c
- g_game.c

## expected changes

- src/core/implement-netupdate-no-network-single-player-path.ts
- test/vanilla_parity/core/implement-netupdate-no-network-single-player-path.test.ts

## test files

- test/vanilla_parity/core/implement-netupdate-no-network-single-player-path.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/core/implement-netupdate-no-network-single-player-path.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 04-013 with test/vanilla_parity/core/implement-netupdate-no-network-single-player-path.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
