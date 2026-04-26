# [ ] STEP 13-002: Gate Registered Doom User Supplied Iwad Scope

## id

13-002

## lane

acceptance

## title

Gate Registered Doom User Supplied Iwad Scope

## goal

Deliver the smallest verified increment for gate registered doom user supplied iwad scope while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

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

- test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.json
- test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.test.ts

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

- test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.json
- test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.test.ts

## test files

- test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 13-002 with test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
