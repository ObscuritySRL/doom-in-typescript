# [ ] STEP 11-008: Implement Mixer Sample Stepping

## id

11-008

## lane

audio

## title

Implement Mixer Sample Stepping

## goal

Deliver the smallest verified increment for implement mixer sample stepping while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 03-036
- 05-028

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- src/audio/implement-mixer-sample-stepping.ts
- test/vanilla_parity/audio/implement-mixer-sample-stepping.test.ts

## read-only paths

- src/audio/
- src/assets/mus.ts
- doom/DOOM1.WAD
- doom/chocolate-doom.cfg

## research sources

- s_sound.c
- i_sound.c
- i_music.c
- sounds.c
- Chocolate Doom 2.2.1 DMX behavior

## expected changes

- src/audio/implement-mixer-sample-stepping.ts
- test/vanilla_parity/audio/implement-mixer-sample-stepping.test.ts

## test files

- test/vanilla_parity/audio/implement-mixer-sample-stepping.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/audio/implement-mixer-sample-stepping.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 11-008 with test/vanilla_parity/audio/implement-mixer-sample-stepping.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
