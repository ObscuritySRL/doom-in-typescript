# [ ] STEP 01-001: Inventory Root Scripts And Missing Doom Ts

## id

01-001

## lane

inventory

## title

Inventory Root Scripts And Missing Doom Ts

## goal

Deliver the smallest verified increment for inventory root scripts and missing doom ts while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 00-018

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- plan_vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.json
- test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts

## read-only paths

- src/
- test/
- tools/
- plan_engine/
- plan_fps/
- reference/manifests/
- package.json

## research sources

- local repository audit
- prior plan artifacts
- current tests and manifests

## expected changes

- plan_vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.json
- test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts

## test files

- test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts

## verification commands

- `bun run format`
- `bun test test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 01-001 with test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
