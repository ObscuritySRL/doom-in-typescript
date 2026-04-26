# [ ] STEP 04-005: Audit Trig Lookup Tables

## id

04-005

## lane

core

## title

Audit Trig Lookup Tables

## goal

Deliver the smallest verified increment for audit trig lookup tables while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 00-018

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- map lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/core/audit-trig-lookup-tables.ts
- test/vanilla_parity/core/audit-trig-lookup-tables.test.ts

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

- src/core/audit-trig-lookup-tables.ts
- test/vanilla_parity/core/audit-trig-lookup-tables.test.ts

## test files

- test/vanilla_parity/core/audit-trig-lookup-tables.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/core/audit-trig-lookup-tables.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 04-005 with test/vanilla_parity/core/audit-trig-lookup-tables.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
