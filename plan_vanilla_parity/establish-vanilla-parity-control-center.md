# Establish Vanilla Parity Control Center

This document declares `plan_vanilla_parity/` as the active planning and execution control center for the vanilla DOOM 1.9 parity rebuild, and pins the runtime, governance, and acceptance invariants every later step must agree with. It locks the prior-art-only classification of `plan_engine/` and `plan_fps/`, the canonical Bun runtime entrypoint, the writable workspace boundary, the read-only reference roots, the total step count, and the first and final eligible steps. Any future change to these invariants must update this document and its focused test in lockstep.

## active control center directory

plan_vanilla_parity/

## prior-art only directories

- plan_engine/
- plan_fps/

## writable workspace root

D:/Projects/doom-in-typescript

## runtime target

bun run doom.ts

## total steps

398

## first eligible step id

00-001

## first eligible step slug

establish-vanilla-parity-control-center

## first eligible step file path

plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md

## final gate step id

13-004

## final gate step slug

gate-full-final-side-by-side-proof

## final gate step file path

plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md

## read-only reference roots

- doom/
- iwad/
- reference/

## shared plan files

- plan_vanilla_parity/AUDIT_LOG.md
- plan_vanilla_parity/DEPENDENCY_GRAPH.md
- plan_vanilla_parity/HANDOFF_LOG.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PRE_PROMPT.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/REFERENCE_ORACLES.md
- plan_vanilla_parity/RISK_REGISTER.md
- plan_vanilla_parity/SOURCE_CATALOG.md
- plan_vanilla_parity/STEP_TEMPLATE.md

## validation commands

- `bun run format`
- `bun test plan_vanilla_parity/validate-plan.test.ts`
- `bun run plan_vanilla_parity/validate-plan.ts`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## acceptance standard

Final gates must run the implementation under `bun run doom.ts` and the selected local reference from clean launch with the same deterministic input stream and compare deterministic state, framebuffer, audio, music events, menu transitions, level transitions, save/load bytes, demo playback, and full-playthrough completion. The default allowed difference is none, so the final side-by-side gate accepts only zero default differences.
