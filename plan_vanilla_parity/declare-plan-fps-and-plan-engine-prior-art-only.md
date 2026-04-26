# Declare Plan Fps And Plan Engine Prior Art Only

This document classifies the legacy planning directories `plan_engine/` and `plan_fps/` as prior art only and prohibits forward Ralph-loop work in this repository from treating either of them as the active control center. The single active planning and execution control center for vanilla DOOM 1.9 parity is `plan_vanilla_parity/`. Forward Ralph-loop steps must not select work from `plan_engine/MASTER_CHECKLIST.md` or `plan_fps/MASTER_CHECKLIST.md`, must not append entries to `plan_engine/HANDOFF_LOG.md` or `plan_fps/HANDOFF_LOG.md`, and must not run the legacy validators `plan_engine/_build_plan.py` or `plan_fps/validate-plan.ts` as governance gates. Reading those directories for historical reference is allowed only when the selected `plan_vanilla_parity/steps/<step>.md` file lists a specific path under its read-only paths section. Any future change to this classification must update this document and its focused test in lockstep.

## active control center directory

plan_vanilla_parity/

## prior-art only directories

- plan_engine/
- plan_fps/

## prior-art classification

Prior-art only directories may be read for historical reference when explicitly listed under a selected step's read-only paths section. They must not be the source of the next eligible step, must not receive new step files, and must not have their checklists, handoff logs, audit logs, fact logs, decision logs, reference oracle ledgers, or step files modified by a forward Ralph-loop turn that selected its step from `plan_vanilla_parity/MASTER_CHECKLIST.md`. The active control center directory `plan_vanilla_parity/` is the only directory whose checklist drives lane selection, the only directory whose step files are write targets, and the only directory whose handoff log records new completion entries.

## prior-art forward-loop write prohibitions

- plan_engine/MASTER_CHECKLIST.md
- plan_engine/HANDOFF_LOG.md
- plan_engine/DECISION_LOG.md
- plan_engine/FACT_LOG.md
- plan_engine/REFERENCE_ORACLES.md
- plan_engine/SOURCE_CATALOG.md
- plan_engine/STEP_TEMPLATE.md
- plan_engine/PROMPT.md
- plan_engine/PRE_PROMPT.md
- plan_engine/README.md
- plan_engine/_build_plan.py
- plan_engine/manifests/
- plan_engine/phases/
- plan_engine/loop_logs/
- plan_fps/MASTER_CHECKLIST.md
- plan_fps/HANDOFF_LOG.md
- plan_fps/AUDIT_LOG.md
- plan_fps/DECISION_LOG.md
- plan_fps/FACT_LOG.md
- plan_fps/REFERENCE_ORACLES.md
- plan_fps/SOURCE_CATALOG.md
- plan_fps/STEP_TEMPLATE.md
- plan_fps/PROMPT.md
- plan_fps/PRE_PROMPT.md
- plan_fps/README.md
- plan_fps/validate-plan.ts
- plan_fps/validate-plan.test.ts
- plan_fps/manifests/
- plan_fps/steps/
- plan_fps/loop_logs/

## active control center selection sources

- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/PRE_PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/lane-lock.ts

## prior-art read-only allowance rule

A forward Ralph-loop turn may read a path under `plan_engine/` or `plan_fps/` only when the selected `plan_vanilla_parity/steps/<step>.md` file lists that exact path under its `read-only paths` section. The selection itself must come from `plan_vanilla_parity/MASTER_CHECKLIST.md`, never from `plan_engine/MASTER_CHECKLIST.md` or `plan_fps/MASTER_CHECKLIST.md`. Reading a prior-art path that is not listed under the selected step's read-only paths section is forbidden, and writing to any prior-art path during a forward Ralph-loop turn is forbidden regardless of the selected step.

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/establish-vanilla-parity-control-center.md
- plan_engine/README.md
- plan_fps/README.md

## acceptance phrasing

Prior art only: `plan_engine/` and `plan_fps/`.
