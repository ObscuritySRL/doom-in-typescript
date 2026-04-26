# [ ] STEP 00-007: Ban Non Bun Runtime And Package Commands

## id

00-007

## lane

governance

## title

Ban Non Bun Runtime And Package Commands

## goal

Deliver the smallest verified increment for ban non bun runtime and package commands while preserving vanilla DOOM 1.9 behavior and avoiding unverified assumptions.

## prerequisites

- 00-006

## parallel-safe-with

- oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- launch lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- core lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged
- wad lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged

## write lock

- plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.md
- test/plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.test.ts

## read-only paths

- AGENTS.md
- CLAUDE.md
- plan_engine/
- plan_fps/
- package.json
- tsconfig.json

## research sources

- AGENTS.md
- CLAUDE.md
- plan_engine/
- plan_fps/

## expected changes

- plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.md
- test/plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.test.ts

## test files

- test/plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.test.ts

## verification commands

- `bun run format`
- `bun test test/plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.test.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- The focused test is meaningful, executable with bun:test, and covers the new behavior plus at least one failure mode when production behavior changes.
- The change is limited to the write lock and required plan control updates.
- Any behavior that cannot be verified is converted into an oracle-capture follow-up instead of guessed.
- The canonical verification commands pass in order.
- The verified change is committed and pushed directly with local git commands.

## final evidence

- A committed and pushed change set for 00-007 with test/plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.test.ts proving the new behavior or audit result.
- A handoff entry records verification commands, changed paths, reference sources, and downstream risks.
