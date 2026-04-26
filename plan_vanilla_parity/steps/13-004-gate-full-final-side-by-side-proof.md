# [ ] STEP 13-004: Gate Full Final Side By Side Proof

## id

13-004

## lane

acceptance

## title

Gate Full Final Side By Side Proof

## goal

Deliver the smallest verified increment for gate full final side by side proof while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 02-035
- 03-036
- 04-030
- 05-028
- 06-032
- 07-034
- 08-032
- 09-038
- 10-028
- 11-031
- 12-028

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- test/vanilla_parity/acceptance/gate-full-final-side-by-side-proof.json
- test/vanilla_parity/acceptance/gate-full-final-side-by-side-proof.test.ts

## read-only paths

- test/oracles/fixtures/
- test/parity/
- src/oracles/
- plan_fps/manifests/

## research sources

- local reference binaries
- all source authority families
- captured oracle reports

## expected changes

- test/vanilla_parity/acceptance/gate-full-final-side-by-side-proof.json
- test/vanilla_parity/acceptance/gate-full-final-side-by-side-proof.test.ts

## test files

- test/vanilla_parity/acceptance/gate-full-final-side-by-side-proof.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/acceptance/gate-full-final-side-by-side-proof.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A machine-generated final side-by-side report from clean launch that runs bun run doom.ts and the selected local reference with the same deterministic input stream.
- The report compares deterministic state, framebuffer, audio, music events, menu transitions, level transitions, save/load bytes, demo playback, and full-playthrough completion with zero default differences.
- The evidence includes command lines, local reference hashes, input stream hash, output artifact hashes, and the exact commit pushed for the completed gate.
