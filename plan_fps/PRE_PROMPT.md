Audit pass for `D:\Projects\doom-in-typescript`.

This turn is NOT a new step implementation. Select 1 to 3 previously completed steps that this execution agent has not already audited, perform a thorough correctness, performance, and improvement audit, then fix every issue you uncover inside the audited step scope.

Use the execution metadata supplied at the top of this prompt. Do not infer or rewrite it. If no execution metadata is supplied, record `unknown` for agent, model, and effort in the final status block.

Workspace boundaries:

- Treat `D:\Projects\doom-in-typescript\` as the only active workspace.
- Treat `D:\Projects\doom-in-typescript\plan_fps\` as the only active planning and execution control center.
- Treat `D:\Projects\doom-in-typescript\plan_engine\` as prior art only.
- Do not write anywhere outside `D:\Projects\doom-in-typescript\`.
- Do not write anything under `D:\Projects\doom-in-typescript\doom\`, `D:\Projects\doom-in-typescript\iwad\`, or `D:\Projects\doom-in-typescript\reference\`.
- Do NOT modify `D:\Projects\doom-in-typescript\plan_fps\MASTER_CHECKLIST.md`. This audit pass does not advance, add, or uncheck steps.
- Do NOT append to `D:\Projects\doom-in-typescript\plan_fps\HANDOFF_LOG.md`. Handoffs are for forward step completion, not audits.
- Append audit results to `D:\Projects\doom-in-typescript\plan_fps\AUDIT_LOG.md`.

Step selection:

- Open `D:\Projects\doom-in-typescript\plan_fps\MASTER_CHECKLIST.md`.
- Open `D:\Projects\doom-in-typescript\plan_fps\AUDIT_LOG.md`.
- Enumerate every step marked `[x]`.
- Determine the current execution agent from the execution metadata. Use exactly `Codex`, `Claude Code`, or `unknown`.
- A completed step is ineligible only when `AUDIT_LOG.md` already contains an entry for the same `step_id` and the same `agent`.
- A completed step audited by another agent remains eligible for this execution agent. Before auditing it, read the other agent's prior audit entry and carry forward whether it succeeded, what it found, what corrective action it took, what tests it ran, and any follow-up.
- If the launcher supplies an `Audit target supplied by the audit-only launcher` block, audit exactly those selected steps and do not select any additional steps.
- If the launcher does not supply selected steps, pick 1 to 3 eligible completed steps uniformly at random. Prefer a spread across different phases when possible.
- If no step is marked `[x]`, stop and report `RLP_STATUS: BLOCKED` with `RLP_AUDITED_STEPS: NONE`.
- If completed steps exist but every completed step already has an audit entry for this execution agent, stop and report `RLP_STATUS: NO_ELIGIBLE_STEP` with `RLP_AUDITED_STEPS: NONE`.
- Record the exact selected step IDs and titles at the very top of your response before doing any work.

For each selected step, perform the full audit below. Do not skip any subsection.

1. Correctness audit
   - Open the selected step file under `D:\Projects\doom-in-typescript\plan_fps\steps\`.
   - Re-read every file listed in its `Expected Changes` and every file listed in its `Read Only` section.
   - Confirm that the implementation still satisfies every bullet of `Expected Changes`.
   - Confirm the test file listed for the step exists, is meaningful, and is not skipped, `.only`-scoped, commented out, or trivially passing.
   - Perform a mandatory nullable / undefined / negative / zero / empty-buffer audit at every boundary touched by the step.
   - Confirm inputs are validated only at real system boundaries; internal trust is fine.
   - Confirm error handling does not silently swallow failures or mask bugs.
   - Confirm endianness, wrap-around, saturation, and sign-extension behavior match the reference where applicable.

2. Performance audit
   - Identify allocations in hot paths: per-frame, per-tick, per-sample, per-pixel, per-lump.
   - Identify redundant work, duplicated parsing, repeated lookups, and accidental `O(n^2)` loops.
   - Identify object churn, closures created inside loops, and boxing/unboxing of fixed-point or angle values.
   - Identify blocking sync I/O or buffered reads that should stream.
   - Identify property access on hot values that should be pulled into locals.
   - Flag anything where a tighter algorithm, typed array, or reused scratch buffer is clearly warranted.

3. Improvement audit
   - Clearer naming, dead code, unused exports, stale comments.
   - Duplicated logic that belongs in a shared helper already introduced by this step.
   - Missing edge-case tests: empty input, max-size input, wrap-around, zero, negative, endianness, off-by-one, unaligned offsets.
   - Flaky, order-dependent, or non-deterministic test patterns.

4. Fix pass
   - Apply every correctness fix you identified.
   - Apply every performance improvement you identified.
   - Apply every clarity / dead-code / test-gap improvement that lies inside the audited step's original scope.
   - Do NOT widen scope into unrelated steps.
   - Do NOT modify plan files beyond `FACT_LOG.md`, `DECISION_LOG.md`, and `REFERENCE_ORACLES.md`.
   - Do NOT introduce backwards-compatibility shims, renamed `_vars`, or `// removed` markers for deleted code.

5. Re-verify after every fix
   - If you changed any file during this audit pass, run `bun run format` before the verification sequence below.
   - Biome is the formatter. If you make any additional edits while recovering from a failed verification command, rerun `bun run format` before rerunning verification.
   - Run the focused test command listed on that step in `MASTER_CHECKLIST.md`.
   - Run `bun test` from `D:\Projects\doom-in-typescript`.
   - Run `bun x tsc --noEmit --project D:\Projects\doom-in-typescript\tsconfig.json`.
   - Do not declare a fix complete while any of those commands fail. Iterate until green.

Shared-log behavior:

- Append one entry per audited step to `D:\Projects\doom-in-typescript\plan_fps\AUDIT_LOG.md`.
- Each `AUDIT_LOG.md` entry must include: `status`, `agent`, `model`, `effort`, `step_id`, `step_title`, `prior_audits`, `correctness_findings`, `performance_findings`, `improvement_findings`, `corrective_action`, `files_changed`, `tests_run`, and `follow_up`.
- Use `status: completed` when the audit and required verification completed, even if findings were `none`.
- Use `status: blocked` only when the audit cannot be completed or verified.
- If the audit surfaces a reusable new fact about the reference, the runtime, or the codebase, append it to `D:\Projects\doom-in-typescript\plan_fps\FACT_LOG.md`.
- If the audit changes a prior decision, update `D:\Projects\doom-in-typescript\plan_fps\DECISION_LOG.md`.
- If the audit refreshes an oracle artifact, update `D:\Projects\doom-in-typescript\plan_fps\REFERENCE_ORACLES.md`.
- Do NOT append to `HANDOFF_LOG.md`. Do NOT modify `MASTER_CHECKLIST.md`.

Publishing behavior:

- Because every completed audit appends to `AUDIT_LOG.md`, every completed audit pass changes files and must commit and push before reporting `RLP_STATUS: COMPLETED`.
- If the audit pass cannot append `AUDIT_LOG.md`, cannot verify, cannot commit, or cannot push, report `RLP_STATUS: BLOCKED`.
- Make repository changes, commits, and pushes as the configured human user only.
- Do not override `user.name`, `user.email`, commit author, commit committer, or publishing identity to an AI or agent identity.
- References to tools, models, or agents are allowed when technically relevant, but they are not authors or publishing identities for this repository.
- Stage files explicitly by path.
- Use a Conventional Commit message.
- Push the current branch directly.
- Do not open a pull request.
- Do not use GitHub apps, GitHub API tools, issue automation, release automation, or pull request workflows.
- If the push fails, report `RLP_STATUS: BLOCKED` and make the push failure the `RLP_REASON`.

Output requirements:

- At the very top of your response, print the randomly selected step IDs and titles and a one-line reason each was selected.
- For each audited step, print a short findings block containing: correctness findings, performance findings, improvement findings, and a summary of what you changed.
- The final lines of your response must be the machine-readable `RLP_*` status block.
- Do not omit any `RLP_*` line.
- Do not wrap the status block in backticks or Markdown fences.
- Do not place any prose after the status block.
- If you write a prose summary above it, repeat the full `RLP_*` block verbatim as the last lines of the response.
- Put exactly one `RLP_*` field on each line. Never place `RLP_AUDITED_STEPS` or any other key on the same line as `RLP_STATUS`.
- `RLP_STATUS` must be exactly one of the uppercase enum values shown below. Do not use variants such as `complete`, `ok`, `done`, `success`, lowercase values, or any other token after `RLP_STATUS:`.
- If the audit pass completed successfully, the only valid success token is `COMPLETED`.
- At the end, print exactly one machine-readable status block in this format:

RLP_STATUS: COMPLETED|BLOCKED|NO_ELIGIBLE_STEP|LIMIT_REACHED
RLP_AUDITED_STEPS: <semicolon-separated step ids or NONE>
RLP_AGENT: <execution metadata agent or unknown>
RLP_MODEL: <execution metadata model or unknown>
RLP_EFFORT: <execution metadata effort or unknown>
RLP_FILES_CHANGED: <semicolon-separated absolute paths or NONE>
RLP_TEST_COMMANDS: <semicolon-separated commands or NONE>
RLP_AUDIT_LOG_UPDATED: YES|NO
RLP_FINDINGS: <one-line correctness/performance/improvement findings summary or NONE>
RLP_CORRECTIVE_ACTION: <one-line corrective action summary or NONE>
RLP_REASON: <one-line reason>

Special limit rule:

- If you believe you are unable to continue because of context, output, or model-limit pressure, stop immediately and use `RLP_STATUS: LIMIT_REACHED`.
- Do not start another audit in that case.

Do not ask for permission. Do not plan. Begin the random selection and audit now.
