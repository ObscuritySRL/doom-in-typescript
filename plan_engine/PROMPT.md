Continue the Ralph loop for `D:\Projects\bun-win32\doom_codex`.

Follow `D:\Projects\bun-win32\AGENTS.md` exactly.

Workspace boundaries:

- Treat `D:\Projects\bun-win32\doom_codex\` as the only active workspace.
- Treat `D:\Projects\bun-win32\doom_codex\plans\` as the planning and execution control center.
- Do not write anywhere outside `D:\Projects\bun-win32\doom_codex\`.
- Do not write anything under `D:\Projects\bun-win32\doom\`.
- The only permitted interaction with `D:\Projects\bun-win32\doom\` is read-only access to `D:\Projects\bun-win32\doom\universal-doom`.

Step selection:

- Determine the next step strictly from `D:\Projects\bun-win32\doom_codex\plans\MASTER_CHECKLIST.md`.
- Scan from the top.
- Choose the first `[ ]` step whose listed prerequisites are already completed.
- If multiple steps are eligible, choose the earliest one in file order.
- If no steps are eligible, stop and report that explicitly.

Read boundaries for this turn:

- Read only:
  - `D:\Projects\bun-win32\doom_codex\plans\README.md`
  - `D:\Projects\bun-win32\doom_codex\plans\MASTER_CHECKLIST.md`
  - `D:\Projects\bun-win32\doom_codex\plans\FACT_LOG.md`
  - `D:\Projects\bun-win32\doom_codex\plans\HANDOFF_LOG.md`
  - the single selected step file
  - the exact files listed in that step file’s `Read Only` section
- Do not open related steps unless blocked.

Execution rules:

- Work on exactly one step in this turn.
- Do not batch steps.
- Implement only the files listed in that step’s `Expected Changes`.
- Add or update at least the test file(s) listed in that step.
- Do not modify plan files except the required shared logs and `MASTER_CHECKLIST.md`.
- Do not widen scope beyond the selected step.

Verification rules:

- If you changed any file during this turn, run `bun x prettier --write D:\Projects\bun-win32\doom_codex` before the verification sequence below.
- If you make any additional edits while recovering from a failed verification command, rerun `bun x prettier --write D:\Projects\bun-win32\doom_codex` before rerunning the verification sequence.
- Run verification in this order unless the step explicitly requires an additional command:
  1. the focused test command from the step
  2. `bun test`
  3. `bun x tsc --noEmit --project D:\Projects\bun-win32\doom_codex\tsconfig.json`
  4. any extra verification command listed in the step
- If a verification command fails, fix the issue if it is within the selected step’s scope and rerun verification.
- Do not move to another step while trying to recover.

Completion promise:

- You must persist until this selected step is fully handled end-to-end in this turn.
- Do not stop at analysis, partial implementation, or a failing intermediate state.
- Continue until one of these is true:
  1. the selected step is fully implemented,
  2. its required verification commands pass,
  3. the required shared logs are updated,
  4. the step is marked `[x]` in `D:\Projects\bun-win32\doom_codex\plans\MASTER_CHECKLIST.md`,
  5. a handoff entry is appended to `D:\Projects\bun-win32\doom_codex\plans\HANDOFF_LOG.md`,
     OR
  6. you hit a real blocker that cannot be resolved from the repository and current environment.
- If blocked, do not move to another step.
- If blocked, report the blocker precisely, including what you tried, what failed, and the exact file path or command involved.
- Do not leave the workspace in a half-finished state if the issue is something you can fix yourself.

Definition of done for the selected step:

- every file listed in `Expected Changes` is in its intended final state for this step
- the listed test file exists or is updated as required
- if any files changed, `bun x prettier --write D:\Projects\bun-win32\doom_codex` has been run after the final edit
- all verification commands for the step pass in order
- required shared logs are updated
- `MASTER_CHECKLIST.md` marks that step `[x]`
- `HANDOFF_LOG.md` has a completion entry
- no additional step is started

Required shared-log behavior:

- Update `FACT_LOG.md` with any reusable new facts learned during this step.
- Update `DECISION_LOG.md` only if this step changes a decision.
- Update `REFERENCE_ORACLES.md` if this step creates or refreshes an oracle artifact.
- Append a concise entry to `HANDOFF_LOG.md` before stopping.

Output requirements:

- At the start, state:
  - selected step ID
  - selected step title
  - why it is the next eligible step
- The final lines of your response must be the machine-readable `RLP_*` status block.
- Do not omit any `RLP_*` line.
- Do not wrap the status block in backticks or Markdown fences.
- Do not place any prose after the status block.
- If you write a prose summary above it, repeat the full `RLP_*` block verbatim as the last lines of the response.
- Put exactly one `RLP_*` field on each line. Never place `RLP_STEP_ID` or any other key on the same line as `RLP_STATUS`.
- Do not use alternate keys such as `step:`, `name:`, `phase:`, `files_touched:`, `tests_run:`, `blockers:`, or YAML-style lists in place of the required `RLP_*` lines.
- Use the exact `RLP_*` field names shown below, exactly once each where applicable.
- `RLP_STATUS` must be exactly one of the uppercase enum values shown below. Do not use variants such as `complete`, `ok`, `done`, `success`, lowercase values, or any other token after `RLP_STATUS:`.
- If the step finished successfully, the only valid success token is `COMPLETED`.
- If no eligible step remains, the only valid terminal token is `NO_ELIGIBLE_STEP`.
- At the end, print exactly one machine-readable status block in this format:

RLP_STATUS: COMPLETED|BLOCKED|NO_ELIGIBLE_STEP|LIMIT_REACHED
RLP_STEP_ID: <step id or NONE>
RLP_STEP_TITLE: <title or NONE>
RLP_FILES_CHANGED: <semicolon-separated absolute paths or NONE>
RLP_TEST_COMMANDS: <semicolon-separated commands or NONE>
RLP_CHECKLIST_UPDATED: YES|NO
RLP_HANDOFF_UPDATED: YES|NO
RLP_NEXT_STEP: <next eligible step id/title or NONE>
RLP_REASON: <one-line reason>

Special limit rule:

- If you believe you are unable to continue because of context, output, or model-limit pressure, stop immediately and use:
  - `RLP_STATUS: LIMIT_REACHED`
- Do not start another step in that case.

Do not ask for permission. Do not plan multiple steps. Start the next eligible step now.
