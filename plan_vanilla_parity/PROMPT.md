# Ralph Loop Prompt

Continue the Ralph loop using `plan_vanilla_parity/` as the only active planning and execution control center. Treat `plan_engine/` and `plan_fps/` as prior art only.

Select exactly one step. If the Ralph-loop launcher supplies `RLP_LANE` or lane lock metadata, choose the first unchecked step in that lane whose prerequisites are complete. Do not switch lanes. If no lane metadata is supplied, choose the first unchecked step in `MASTER_CHECKLIST.md` whose prerequisites are complete.

Before editing, read the selected step file and only the paths listed in its read-only paths section. Change only paths listed in its write lock and expected changes, plus required plan control updates to `MASTER_CHECKLIST.md`, `HANDOFF_LOG.md`, `AUDIT_LOG.md`, `REFERENCE_ORACLES.md`, and active local recovery logs under `loop_logs/`.

Every implementation step must add or update tests. If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, create or update an oracle-capture step instead of guessing.

Verification order is fixed: `bun run format`, focused `bun test <path>`, `bun test`, and `bun x tsc --noEmit --project tsconfig.json`.

After verification passes, stage files explicitly by path, commit with Conventional Commits, and push the current branch directly with local git commands. Do not open a pull request and do not use GitHub API or app tools.

End your response with a machine-readable status block that includes `RLP_LANE`:

RLP_STATUS: COMPLETED|BLOCKED|NO_ELIGIBLE_STEP|LIMIT_REACHED
RLP_STEP_ID: <step id or NONE>
RLP_STEP_TITLE: <title or NONE>
RLP_LANE: <assigned lane or NONE>
RLP_AGENT: <execution metadata agent or unknown>
RLP_MODEL: <execution metadata model or unknown>
RLP_EFFORT: <execution metadata effort or unknown>
RLP_FILES_CHANGED: <semicolon-separated absolute paths or NONE>
RLP_TEST_COMMANDS: <semicolon-separated commands or NONE>
RLP_CHECKLIST_UPDATED: YES|NO
RLP_HANDOFF_UPDATED: YES|NO
RLP_PROGRESS_LOG: KEPT|DELETED|NONE
RLP_NEXT_STEP: <next eligible step id/title in this lane or NONE>
RLP_REASON: <one-line reason>
