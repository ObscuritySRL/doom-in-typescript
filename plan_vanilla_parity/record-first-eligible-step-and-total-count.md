# Record First Eligible Step And Total Count

This document pins the canonical first eligible step identity and the canonical total step count that every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must agree with. It freezes the canonical first eligible step id `00-001`, the canonical first eligible step slug `establish-vanilla-parity-control-center`, the canonical first eligible step title `Establish Vanilla Parity Control Center`, the canonical first eligible step lane `governance`, the canonical first eligible step prerequisite `none`, the canonical first eligible step file path `plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md`, the canonical total step count `398` declared verbatim by `plan_vanilla_parity/MASTER_CHECKLIST.md`, the canonical runtime target `bun run doom.ts` declared verbatim by `plan_vanilla_parity/MASTER_CHECKLIST.md`, the canonical final gate step id `13-004`, the canonical final gate step slug `gate-full-final-side-by-side-proof`, the canonical final gate step lane `acceptance`, the canonical final gate step file path `plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md`, the three canonical pinned constants enforced by `plan_vanilla_parity/validate-plan.ts` (`EXPECTED_FIRST_STEP = '00-001'`, `EXPECTED_TOTAL_STEPS = 398`, `FINAL_GATE_STEP_ID = '13-004'`), the five canonical checklist summary diagnostics emitted by `validateChecklistSummary` when any of these invariants drifts (`Checklist must declare total steps 398.`, `Checklist must declare the first eligible vanilla parity step.`, `Checklist must declare the bun run doom.ts runtime target.`, `Checklist must contain 398 steps, got <count>.`, `First parsed step must be 00-001.`), the canonical four required-summary lines under the `# Master Checklist` heading of `plan_vanilla_parity/MASTER_CHECKLIST.md` (`- Total steps: 398`, ``- First eligible step: `00-001 establish-vanilla-parity-control-center` ``, ``- Runtime target: `bun run doom.ts` ``, `- Rule: choose the first unchecked step whose prerequisites are complete.`), the canonical three README anchors under `plan_vanilla_parity/README.md` (`- Total steps: \`398\`.`, ``- First eligible step: `00-001 establish-vanilla-parity-control-center`.``, ``- Active plan directory: `plan_vanilla_parity/`.``), and the canonical control-center anchors under `plan_vanilla_parity/establish-vanilla-parity-control-center.md` (the `total steps` section pinning `398`, the `first eligible step id` section pinning `00-001`, the `first eligible step slug` section pinning `establish-vanilla-parity-control-center`, the `first eligible step file path` section pinning `plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md`, the `final gate step id` section pinning `13-004`, the `final gate step slug` section pinning `gate-full-final-side-by-side-proof`, the `final gate step file path` section pinning `plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md`, the `runtime target` section pinning `bun run doom.ts`). Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 first eligible step and total count

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## first eligible step id

00-001

## first eligible step slug

establish-vanilla-parity-control-center

## first eligible step title

Establish Vanilla Parity Control Center

## first eligible step lane

governance

## first eligible step prerequisite

none

## first eligible step file path

plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md

## first eligible step heading

# [ ] STEP 00-001: Establish Vanilla Parity Control Center

## first eligible step checklist row

- [x] `00-001` `establish-vanilla-parity-control-center` | lane: `governance` | prereqs: `none` | file: `plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md`

## total step count

398

## final gate step id

13-004

## final gate step slug

gate-full-final-side-by-side-proof

## final gate step lane

acceptance

## final gate step file path

plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md

## final gate step heading

# [ ] STEP 13-004: Gate Full Final Side By Side Proof

## final gate step checklist row

- [ ] `13-004` `gate-full-final-side-by-side-proof` | lane: `acceptance` | prereqs: `02-035,03-036,04-030,05-028,06-032,07-034,08-032,09-038,10-028,11-031,12-028` | file: `plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md`

## runtime target

bun run doom.ts

## pinned constant count

3

## pinned constants

- EXPECTED_FIRST_STEP
- EXPECTED_TOTAL_STEPS
- FINAL_GATE_STEP_ID

## EXPECTED_FIRST_STEP value

'00-001'

## EXPECTED_TOTAL_STEPS value

398

## FINAL_GATE_STEP_ID value

'13-004'

## checklist summary diagnostic count

5

## checklist summary diagnostics

- Checklist must declare total steps 398.
- Checklist must declare the first eligible vanilla parity step.
- Checklist must declare the bun run doom.ts runtime target.
- Checklist must contain 398 steps, got <count>.
- First parsed step must be 00-001.

## master checklist required summary line count

4

## master checklist required summary lines

- - Total steps: 398
- - First eligible step: `00-001 establish-vanilla-parity-control-center`
- - Runtime target: `bun run doom.ts`
- - Rule: choose the first unchecked step whose prerequisites are complete.

## master checklist heading

# Master Checklist

## readme required anchor count

3

## readme required anchors

- - Active plan directory: `plan_vanilla_parity/`.
- - Total steps: `398`.
- - First eligible step: `00-001 establish-vanilla-parity-control-center`.

## control center anchor count

8

## control center anchors

- ## total steps
- ## first eligible step id
- ## first eligible step slug
- ## first eligible step file path
- ## final gate step id
- ## final gate step slug
- ## final gate step file path
- ## runtime target

## first eligible step rule

The first eligible step at any moment is the first unchecked checklist row whose prerequisites are all marked complete. At plan creation time the absolute first eligible step is `00-001 establish-vanilla-parity-control-center` because it has prerequisite `none` and is the first row under `## Phase 00: Governance / Plan Foundation`. The Ralph-loop launcher and the `plan_vanilla_parity/PROMPT.md` lane-selection rule both honor this ordering by walking `plan_vanilla_parity/MASTER_CHECKLIST.md` top-to-bottom and stopping at the first `- [ ]` row whose prereqs column is `none` or all-`[x]`.

## total step count rule

The canonical total step count `398` equals the number of `- [ ]`/`- [x]` rows in `plan_vanilla_parity/MASTER_CHECKLIST.md` that match the canonical `CHECKLIST_LINE_PATTERN` regular expression in `plan_vanilla_parity/validate-plan.ts`. The count is enforced verbatim in three places: the `# Master Checklist` summary line `- Total steps: 398`, the `plan_vanilla_parity/README.md` Active Control Center bullet `- Total steps: \`398\`.`, and the `EXPECTED_TOTAL_STEPS = 398` constant in `plan_vanilla_parity/validate-plan.ts`. When any of these three drifts, `validateChecklistSummary` emits one of the five canonical checklist summary diagnostics. The count is intentionally frozen at plan creation time so adding or removing a step file requires updating all three anchors plus this document plus its focused test in lockstep.

## final gate step rule

The canonical final gate step id `13-004` matches the `FINAL_GATE_STEP_ID = '13-004'` constant in `plan_vanilla_parity/validate-plan.ts` and the last row of `plan_vanilla_parity/MASTER_CHECKLIST.md` under `## Phase 13: Final Proof / Handoff`. The final gate step lane is `acceptance` because the gate consumes the runtime lanes (`oracle`, `launch`, `core`, `wad`, `map`, `gameplay`, `ai`, `render`, `ui`, `audio`, `save`) under the merge checkpoint G6 declared by `plan_vanilla_parity/PARALLEL_WORK.md`. The final gate step's prerequisites column lists every prior phase gate (`02-035`, `03-036`, `04-030`, `05-028`, `06-032`, `07-034`, `08-032`, `09-038`, `10-028`, `11-031`, `12-028`) so the final side-by-side proof never fires before every runtime lane has converged.

## runtime target rule

The canonical runtime target `bun run doom.ts` is the only acceptable command for the final playable product. It is enforced verbatim in three places: the `# Master Checklist` summary line ``- Runtime target: `bun run doom.ts` `` inside `plan_vanilla_parity/MASTER_CHECKLIST.md`, the `plan_vanilla_parity/establish-vanilla-parity-control-center.md` `## runtime target` section, and the `Checklist must declare the bun run doom.ts runtime target.` diagnostic emitted by `validateChecklistSummary` in `plan_vanilla_parity/validate-plan.ts` when the master checklist drops the runtime target line. Per `plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.md`, no other runtime command (`npm`, `yarn`, `pnpm`, `npx`, `node`, `ts-node`, `tsx`, `vitest`, `jest`, `mocha`) may replace it.

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/establish-vanilla-parity-control-center.md
- plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md
- plan_vanilla_parity/steps/00-017-record-first-eligible-step-and-total-count.md
- plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md
- plan_vanilla_parity/validate-plan.ts
- plan_vanilla_parity/validate-plan.test.ts

## acceptance phrasing

The vanilla DOOM 1.9 parity rebuild's first eligible step at plan creation time is `00-001 establish-vanilla-parity-control-center` (lane `governance`, prerequisite `none`, file `plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md`) and the canonical total step count is `398`. The canonical final gate step is `13-004 gate-full-final-side-by-side-proof` (lane `acceptance`, file `plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md`). The canonical runtime target is `bun run doom.ts`. These four facts are pinned by the three constants `EXPECTED_FIRST_STEP = '00-001'`, `EXPECTED_TOTAL_STEPS = 398`, and `FINAL_GATE_STEP_ID = '13-004'` in `plan_vanilla_parity/validate-plan.ts`, by the three anchors `- Active plan directory: \`plan_vanilla_parity/\`.`, `- Total steps: \`398\`.`, and `- First eligible step: \`00-001 establish-vanilla-parity-control-center\`.` in `plan_vanilla_parity/README.md`, by the four required summary lines `- Total steps: 398`, ``- First eligible step: `00-001 establish-vanilla-parity-control-center` ``, ``- Runtime target: `bun run doom.ts` ``, and `- Rule: choose the first unchecked step whose prerequisites are complete.` under the `# Master Checklist` heading of `plan_vanilla_parity/MASTER_CHECKLIST.md`, and by the eight control-center anchors (`## total steps`, `## first eligible step id`, `## first eligible step slug`, `## first eligible step file path`, `## final gate step id`, `## final gate step slug`, `## final gate step file path`, `## runtime target`) in `plan_vanilla_parity/establish-vanilla-parity-control-center.md`. The five canonical checklist summary diagnostics `Checklist must declare total steps 398.`, `Checklist must declare the first eligible vanilla parity step.`, `Checklist must declare the bun run doom.ts runtime target.`, `Checklist must contain 398 steps, got <count>.`, and `First parsed step must be 00-001.` emitted by `validateChecklistSummary` in `plan_vanilla_parity/validate-plan.ts` enforce these invariants for every Ralph-loop step.
