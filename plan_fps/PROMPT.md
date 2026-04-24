# Ralph Loop Prompt

Continue the Ralph loop for this repository.

Use `plan_fps` as the only planning and execution control center.

Do not use `plan_engine/` as the active control center. `plan_engine/` is prior art only unless a selected step explicitly lists it under Read Only.

Determine the next step strictly from `plan_fps/MASTER_CHECKLIST.md`.

Scan from the top.

Choose the first unchecked step whose prerequisites are complete.

Work on exactly one step.

Use the execution metadata supplied at the top of this prompt. Do not infer or rewrite it. If no execution metadata is supplied, record `unknown` for agent, model, and effort.

Read only:
- `plan_fps/README.md`
- `plan_fps/MASTER_CHECKLIST.md`
- `plan_fps/FACT_LOG.md`
- `plan_fps/HANDOFF_LOG.md`
- any existing `plan_fps/loop_logs/step_<step-id>_progress.txt` for the selected step
- the selected step file
- exact files listed in that step file's Read Only section

Do not open related steps unless blocked.

Implement only files listed in Expected Changes. The only standing exceptions are the required control updates to `plan_fps/MASTER_CHECKLIST.md`, `plan_fps/FACT_LOG.md`, `plan_fps/DECISION_LOG.md`, `plan_fps/REFERENCE_ORACLES.md`, `plan_fps/HANDOFF_LOG.md`, and the active step progress log at `plan_fps/loop_logs/step_<step-id>_progress.txt`.

Active step progress log behavior:
- Before changing product or plan files, create or update `plan_fps/loop_logs/step_<step-id>_progress.txt` for the selected step.
- Keep that file current throughout the step. It must include the step id and title, completed work, touched files, verification commands and results, blockers or risks, the next exact action for a future agent, and the remaining planned work required to complete the step.
- Update the file after each meaningful change, before long verification commands, after each verification result, and before any point where interruption, context pressure, or usage limits could stop the loop.
- Do not stage, commit, or push the active step progress log; it is local recovery state under `plan_fps/loop_logs/`.
- Delete only that step's progress log after the step is marked complete, all required verification passes, and the verified commit has been pushed.
- If verification fails, publishing fails, the task is blocked, or you must stop with `RLP_STATUS: LIMIT_REACHED`, leave the progress log in place and make its remaining-work section accurate.

Run verification in order:
1. `bun run format`
2. focused test command
3. `bun test`
4. `bun x tsc --noEmit --project tsconfig.json`
5. extra commands listed by the step

Biome is the formatter. If the step changes files, run `bun run format` before verification and before publishing. If formatting changes files or any recovery edit is made, rerun `bun run format` before rerunning verification.

Do not mark the step complete unless all required verification passes.

Append `HANDOFF_LOG.md`.

Each `HANDOFF_LOG.md` completion entry must include:
- `agent`: exact execution metadata agent value
- `model`: exact execution metadata model value
- `effort`: exact execution metadata effort value

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

End your response with exactly one machine-readable status block:

RLP_STATUS: COMPLETED|BLOCKED|NO_ELIGIBLE_STEP|LIMIT_REACHED
RLP_STEP_ID: <step id or NONE>
RLP_STEP_TITLE: <title or NONE>
RLP_AGENT: <execution metadata agent or unknown>
RLP_MODEL: <execution metadata model or unknown>
RLP_EFFORT: <execution metadata effort or unknown>
RLP_FILES_CHANGED: <semicolon-separated absolute paths or NONE>
RLP_TEST_COMMANDS: <semicolon-separated commands or NONE>
RLP_CHECKLIST_UPDATED: YES|NO
RLP_HANDOFF_UPDATED: YES|NO
RLP_PROGRESS_LOG: KEPT|DELETED|NONE
RLP_NEXT_STEP: <next eligible step id/title or NONE>
RLP_REASON: <one-line reason>
