# [ ] STEP 02-007: Capture Default Cfg Baseline

## id

02-007

## lane

oracle

## title

Capture Default Cfg Baseline

## goal

Deliver the smallest verified increment for capture default cfg baseline while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 01-024

## parallel-safe-with

- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- map lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- test/vanilla_parity/oracles/capture-default-cfg-baseline.json
- test/vanilla_parity/oracles/capture-default-cfg-baseline.test.ts

## read-only paths

- doom/
- iwad/
- reference/manifests/
- tools/reference/
- test/oracles/

## research sources

- doom/DOOMD.EXE
- doom/DOOM.EXE
- doom/DOOM1.WAD
- doom/default.cfg
- doom/chocolate-doom.cfg

## expected changes

- test/vanilla_parity/oracles/capture-default-cfg-baseline.json
- test/vanilla_parity/oracles/capture-default-cfg-baseline.test.ts

## test files

- test/vanilla_parity/oracles/capture-default-cfg-baseline.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/oracles/capture-default-cfg-baseline.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 02-007 with test/vanilla_parity/oracles/capture-default-cfg-baseline.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
