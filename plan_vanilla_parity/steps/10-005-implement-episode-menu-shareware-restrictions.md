# [ ] STEP 10-005: Implement Episode Menu Shareware Restrictions

## id

10-005

## lane

ui

## title

Implement Episode Menu Shareware Restrictions

## goal

Deliver the smallest verified increment for implement episode menu shareware restrictions while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 03-036
- 05-028

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/ui/implement-episode-menu-shareware-restrictions.ts
- test/vanilla_parity/ui/implement-episode-menu-shareware-restrictions.test.ts

## read-only paths

- src/ui/
- src/bootstrap/titleLoop.ts
- src/input/
- doom/DOOM1.WAD

## research sources

- m_menu.c
- d_main.c
- st_stuff.c
- wi_stuff.c
- f_finale.c
- hu_stuff.c

## expected changes

- src/ui/implement-episode-menu-shareware-restrictions.ts
- test/vanilla_parity/ui/implement-episode-menu-shareware-restrictions.test.ts

## test files

- test/vanilla_parity/ui/implement-episode-menu-shareware-restrictions.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/ui/implement-episode-menu-shareware-restrictions.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 10-005 with test/vanilla_parity/ui/implement-episode-menu-shareware-restrictions.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
