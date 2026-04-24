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

After the step is verified and logs/checklist are updated, commit the step and push it before stopping.

Commit and push rules:
- Make repository changes, commits, and pushes as the configured human user only.
- Do not override `user.name`, `user.email`, commit author, commit committer, or publishing identity to an AI or agent identity.
- References to tools, models, or agents are allowed when technically relevant, but they are not authors or publishing identities for this repository.
- Stage files explicitly by path.
- Use a Conventional Commit message.
- Push the current branch directly.
- Do not open a pull request.
- Do not use GitHub apps, GitHub API tools, issue automation, release automation, or pull request workflows.
- If the push fails, report the blocker and do not mark the loop successful.

Stop after one step.
