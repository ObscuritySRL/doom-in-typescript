# [ ] STEP 12-024: Restore Post Load Render Audio Input State

## id

12-024

## lane

save

## title

Restore Post Load Render Audio Input State

## goal

Deliver the smallest verified increment for restore post load render audio input state while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 04-030
- 07-034

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/save/restore-post-load-render-audio-input-state.ts
- test/vanilla_parity/save/restore-post-load-render-audio-input-state.test.ts

## read-only paths

- src/save/
- src/config/
- doom/default.cfg
- doom/chocolate-doom.cfg
- test/save/
- test/config/

## research sources

- p_saveg.c
- m_misc.c
- m_config.c
- g_game.c

## expected changes

- src/save/restore-post-load-render-audio-input-state.ts
- test/vanilla_parity/save/restore-post-load-render-audio-input-state.test.ts

## test files

- test/vanilla_parity/save/restore-post-load-render-audio-input-state.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/save/restore-post-load-render-audio-input-state.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 12-024 with test/vanilla_parity/save/restore-post-load-render-audio-input-state.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
