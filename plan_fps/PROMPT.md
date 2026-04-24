# Ralph Loop Prompt

Continue the Ralph loop for this repository.

Use `plan_fps` as the only planning and execution control center.

Do not use `plan_engine/` as the active control center. `plan_engine/` is prior art only unless a selected step explicitly lists it under Read Only.

Determine the next step strictly from `plan_fps/MASTER_CHECKLIST.md`.

Scan from the top.

Choose the first unchecked step whose prerequisites are complete.

Work on exactly one step.

Read only:
- `plan_fps/README.md`
- `plan_fps/MASTER_CHECKLIST.md`
- `plan_fps/FACT_LOG.md`
- `plan_fps/HANDOFF_LOG.md`
- the selected step file
- exact files listed in that step file's Read Only section

Do not open related steps unless blocked.

Implement only files listed in Expected Changes. The only standing exceptions are the required control updates to `plan_fps/MASTER_CHECKLIST.md`, `plan_fps/FACT_LOG.md`, `plan_fps/DECISION_LOG.md`, `plan_fps/REFERENCE_ORACLES.md`, and `plan_fps/HANDOFF_LOG.md`.

Run verification in order:
1. focused test command
2. `bun test`
3. `bun x tsc --noEmit --project tsconfig.json`
4. extra commands listed by the step

If the step changes files and the repo has a formatter command, run it before verification.

Do not mark the step complete unless all required verification passes.

Append `HANDOFF_LOG.md`.

Stop after one step.
