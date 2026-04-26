# Gate Plan Structure Validation

This document pins the canonical plan-structure-validation gate (`G0 plan validation` in `plan_vanilla_parity/PARALLEL_WORK.md`) that every later Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must clear before it may begin. It freezes the canonical gate id `00-018`, the canonical gate slug `gate-plan-structure-validation`, the canonical gate title `Gate Plan Structure Validation`, the canonical gate lane `governance`, the canonical gate phase `Phase 00: Governance / Plan Foundation`, the canonical gate prerequisite `00-017`, the canonical gate file path `plan_vanilla_parity/steps/00-018-gate-plan-structure-validation.md`, the canonical gate checklist heading `# [ ] STEP 00-018: Gate Plan Structure Validation`, the canonical merge-checkpoint label `G0` and its source `plan_vanilla_parity/PARALLEL_WORK.md`, the canonical plan validation script path `plan_vanilla_parity/validate-plan.ts` and its CLI invocation `bun run plan_vanilla_parity/validate-plan.ts`, the canonical plan validation focused test path `plan_vanilla_parity/validate-plan.test.ts` and its focused command `bun test plan_vanilla_parity/validate-plan.test.ts`, the canonical four pre-gate verification commands in fixed order (`bun run format`, `bun test plan_vanilla_parity/validate-plan.test.ts`, `bun run plan_vanilla_parity/validate-plan.ts`, `bun test`, `bun x tsc --noEmit --project tsconfig.json`), the canonical CLI success exit code `0`, the canonical CLI failure exit code `1`, the canonical CLI success stdout line `Validated 398 vanilla parity steps. First step: 00-001.`, the canonical CLI failure stderr line shape `<file>: <message>`, the canonical zero-error invariant `result.errors.length === 0`, the canonical first parsed step id `00-001`, the canonical total parsed step count `398`, the canonical full `validatePlan()` result `{ errors: [], firstStep: '00-001', totalSteps: 398 }`, the canonical gate-passing rule (the gate is cleared only when all five canonical commands run from clean repository state and all five exit with status `0` and the validator emits the canonical success stdout line), the canonical gate-blocking rule (any non-zero exit, any stderr diagnostic from the validator, or any drift in the canonical `validatePlan()` result fails the gate), the canonical no-skip rule (no later step in `plan_vanilla_parity/MASTER_CHECKLIST.md` whose prerequisites column references `00-018` may be picked by the Ralph-loop launcher until `00-018` is marked `[x]`), the canonical downstream dependent count `114` (the number of `prereqs: \`00-018\`` checklist rows in `plan_vanilla_parity/MASTER_CHECKLIST.md`), and the canonical merge-checkpoint sequence `G0 plan validation, G1 real clean launch, G2 title/menu parity, G3 E1M1 entry parity, G4 demo-sync parity, G5 save/load parity, G6 full final side-by-side proof` declared verbatim by the bottom line of `plan_vanilla_parity/PARALLEL_WORK.md`. Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 plan structure validation gate

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## gate id

00-018

## gate slug

gate-plan-structure-validation

## gate title

Gate Plan Structure Validation

## gate lane

governance

## gate phase

Phase 00: Governance / Plan Foundation

## gate prerequisite

00-017

## gate file path

plan_vanilla_parity/steps/00-018-gate-plan-structure-validation.md

## gate heading

# [ ] STEP 00-018: Gate Plan Structure Validation

## gate checklist row pending

- [ ] `00-018` `gate-plan-structure-validation` | lane: `governance` | prereqs: `00-017` | file: `plan_vanilla_parity/steps/00-018-gate-plan-structure-validation.md`

## gate checklist row completed

- [x] `00-018` `gate-plan-structure-validation` | lane: `governance` | prereqs: `00-017` | file: `plan_vanilla_parity/steps/00-018-gate-plan-structure-validation.md`

## merge checkpoint label

G0

## merge checkpoint description

plan validation

## merge checkpoint source

plan_vanilla_parity/PARALLEL_WORK.md

## merge checkpoint sequence

G0 plan validation, G1 real clean launch, G2 title/menu parity, G3 E1M1 entry parity, G4 demo-sync parity, G5 save/load parity, G6 full final side-by-side proof.

## plan validation script path

plan_vanilla_parity/validate-plan.ts

## plan validation script command

bun run plan_vanilla_parity/validate-plan.ts

## plan validation focused test path

plan_vanilla_parity/validate-plan.test.ts

## plan validation focused test command

bun test plan_vanilla_parity/validate-plan.test.ts

## pre-gate verification command count

5

## pre-gate verification commands

- `bun run format`
- `bun test plan_vanilla_parity/validate-plan.test.ts`
- `bun run plan_vanilla_parity/validate-plan.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## cli success exit code

0

## cli failure exit code

1

## cli success stdout line

Validated 398 vanilla parity steps. First step: 00-001.

## cli failure stderr line shape

<file>: <message>

## zero error invariant

result.errors.length === 0

## first parsed step id

00-001

## total parsed step count

398

## expected validate plan result

{ errors: [], firstStep: '00-001', totalSteps: 398 }

## gate passing rule

The gate is cleared only when, from clean repository state and the production `plan_vanilla_parity/` tree, all five canonical pre-gate verification commands exit with status `0` in the fixed order pinned under `## pre-gate verification commands` (`bun run format`, `bun test plan_vanilla_parity/validate-plan.test.ts`, `bun run plan_vanilla_parity/validate-plan.ts`, `bun test`, `bun x tsc --noEmit --project tsconfig.json`), the validator script `plan_vanilla_parity/validate-plan.ts` emits the canonical success stdout line `Validated 398 vanilla parity steps. First step: 00-001.` to standard output and writes nothing to standard error, and the `validatePlan()` public surface from `plan_vanilla_parity/validate-plan.ts` returns the canonical result `{ errors: [], firstStep: '00-001', totalSteps: 398 }`. Every condition must hold simultaneously; any partial pass fails the gate.

## gate blocking rule

Any non-zero exit code from any of the five canonical pre-gate verification commands, any stderr diagnostic from the validator script, any non-empty `result.errors` array returned by `validatePlan()`, any drift in `result.firstStep` away from the canonical first parsed step id `00-001`, any drift in `result.totalSteps` away from the canonical total parsed step count `398`, or any drift in the validator's success stdout line away from the canonical line `Validated 398 vanilla parity steps. First step: 00-001.` blocks the gate. While the gate is blocked, the Ralph-loop launcher must not mark `00-018` as `[x]` in `plan_vanilla_parity/MASTER_CHECKLIST.md` and the no-skip rule below applies to every dependent step.

## no skip rule

While `00-018` remains unchecked in `plan_vanilla_parity/MASTER_CHECKLIST.md`, the Ralph-loop launcher must not select any later step whose `prereqs` column lists `00-018`. The lane-selection logic in `plan_vanilla_parity/PROMPT.md` walks the checklist top-to-bottom and stops at the first unchecked `- [ ]` row whose prereqs column is `none` or all-`[x]`; while `00-018` is unchecked, no row whose prereqs column references `00-018` can satisfy the all-`[x]` condition. Forward Ralph-loop agents must therefore complete `00-018` before any inventory, oracle, launch, core, wad, map, gameplay, ai, render, ui, audio, save, or acceptance lane row that depends on it can become eligible.

## downstream dependent count

114

## downstream dependent rule

The canonical downstream dependent count `114` equals the number of checklist rows in `plan_vanilla_parity/MASTER_CHECKLIST.md` whose prereqs column reads exactly `\`00-018\`` (a single literal prereq pointing at this gate). The count is intentionally pinned because it is the load-bearing scope of the gate: when this gate clears, exactly `114` downstream rows become reachable from a single-prereq path. Adding or removing a row that lists `00-018` as its sole prereq must update this number in lockstep with the checklist.

## validate plan helper exports

- PLAN_VALIDATION_COMMAND
- parseChecklist
- runValidationCli
- validatePlan

## validate plan helper export count

4

## validate plan result fields

- errors
- firstStep
- totalSteps

## validate plan result field count

3

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/establish-vanilla-parity-control-center.md
- plan_vanilla_parity/record-first-eligible-step-and-total-count.md
- plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md
- plan_vanilla_parity/steps/00-018-gate-plan-structure-validation.md
- plan_vanilla_parity/validate-plan.ts
- plan_vanilla_parity/validate-plan.test.ts

## acceptance phrasing

The vanilla DOOM 1.9 parity rebuild's plan-structure-validation gate is the canonical governance step `00-018 gate-plan-structure-validation` (lane `governance`, phase `Phase 00: Governance / Plan Foundation`, prerequisite `00-017`, file `plan_vanilla_parity/steps/00-018-gate-plan-structure-validation.md`, heading `# [ ] STEP 00-018: Gate Plan Structure Validation`). It is the canonical merge checkpoint `G0 plan validation` declared verbatim by the bottom line of `plan_vanilla_parity/PARALLEL_WORK.md` (`Merge checkpoints: G0 plan validation, G1 real clean launch, G2 title/menu parity, G3 E1M1 entry parity, G4 demo-sync parity, G5 save/load parity, G6 full final side-by-side proof.`). The gate is cleared only when, from clean repository state and the production `plan_vanilla_parity/` tree, the canonical five pre-gate verification commands `bun run format`, `bun test plan_vanilla_parity/validate-plan.test.ts`, `bun run plan_vanilla_parity/validate-plan.ts`, `bun test`, and `bun x tsc --noEmit --project tsconfig.json` all exit with status `0` in fixed order, the validator script `plan_vanilla_parity/validate-plan.ts` emits the canonical success stdout line `Validated 398 vanilla parity steps. First step: 00-001.` and writes nothing to standard error, and the `validatePlan()` public surface (one of the canonical four exports `PLAN_VALIDATION_COMMAND`, `parseChecklist`, `runValidationCli`, `validatePlan` from `plan_vanilla_parity/validate-plan.ts`) returns the canonical result `{ errors: [], firstStep: '00-001', totalSteps: 398 }` with the canonical three result fields `errors`, `firstStep`, and `totalSteps`. Any non-zero exit, any stderr diagnostic from the validator, any non-empty `result.errors`, any drift in `result.firstStep` away from `00-001`, any drift in `result.totalSteps` away from `398`, or any drift in the canonical success stdout line blocks the gate. While `00-018` remains unchecked in `plan_vanilla_parity/MASTER_CHECKLIST.md`, the Ralph-loop launcher must not select any of the canonical `114` downstream rows whose prereqs column reads exactly `\`00-018\``. The CLI exits with status `0` on success and writes the canonical success stdout line, and exits with status `1` on failure and writes one `<file>: <message>` line per error to standard error.
