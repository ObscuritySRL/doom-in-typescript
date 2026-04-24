Audit pass for `D:\Projects\bun-win32\doom_codex`.

This turn is NOT a new step implementation. You will select 1 to 3 previously completed steps at random and perform a thorough correctness, performance, and improvement audit, then fix every issue you uncover.

Workspace boundaries:

- Treat `D:\Projects\bun-win32\doom_codex\` as the only active workspace.
- Do not write anywhere outside `D:\Projects\bun-win32\doom_codex\`.
- Do not write anything under `D:\Projects\bun-win32\doom\`.
- The only permitted interaction with `D:\Projects\bun-win32\doom\` is read-only access to `D:\Projects\bun-win32\doom\universal-doom`.
- Do NOT modify `D:\Projects\bun-win32\doom_codex\plans\MASTER_CHECKLIST.md`. This pass does not advance, add, or uncheck steps.
- Do NOT append to `D:\Projects\bun-win32\doom_codex\plans\HANDOFF_LOG.md`. Handoffs are for forward step completion, not audits.

Step selection:

- Open `D:\Projects\bun-win32\doom_codex\plans\MASTER_CHECKLIST.md`.
- Enumerate every step marked `[x]`.
- Pick 1 to 3 of them uniformly at random. Prefer a spread across different phases when possible.
- Record the exact selected step IDs and titles at the very top of your response before doing any work.

For each selected step, perform the full audit below. Do not skip any subsection.

1. Correctness audit
   - Open the step file under `D:\Projects\bun-win32\doom_codex\plans\phases\` for the selected step ID.
   - Re-read every file listed in its `Expected Changes` and every file listed in its `Read Only` section.
   - Confirm that the implementation still satisfies every bullet of `Expected Changes`.
   - Confirm the test file listed for the step exists, is meaningful, and is not skipped, `.only`-scoped, commented out, or trivially passing.
   - Perform a mandatory nullable / undefined / negative / zero / empty-buffer audit at every boundary touched by the step.
   - Confirm inputs are validated only at real system boundaries; internal trust is fine.
   - Confirm error handling does not silently swallow failures or mask bugs.
   - Confirm endianness, wrap-around, saturation, and sign-extension behavior match the reference where applicable.

2. Performance audit
   - Identify allocations in hot paths (per-frame, per-tick, per-sample, per-pixel, per-lump).
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
   - `AI.md` drift: generic template must remain generic (only class/package/dll names substituted; `SomeFunctionW` etc. kept intact).
   - Section comment blocks that violate the `/** @inheritdoc */`-only policy.

4. Fix pass
   - Apply every correctness fix you identified.
   - Apply every performance improvement you identified.
   - Apply every clarity / dead-code / test-gap improvement that lies inside the audited step's original scope.
   - Do NOT widen scope into unrelated steps.
   - Do NOT modify plan files beyond `FACT_LOG.md` and `DECISION_LOG.md` (see below).
   - Do NOT introduce backwards-compatibility shims, renamed `_vars`, or `// removed` markers for deleted code.

5. Re-verify after every fix
   - If you changed any file during this audit pass, run `bun x prettier --write D:\Projects\bun-win32\doom_codex` before the verification sequence below.
   - If you make any additional edits while recovering from a failed verification command, rerun `bun x prettier --write D:\Projects\bun-win32\doom_codex` before rerunning the verification sequence.
   - Run the focused test command listed on that step in `MASTER_CHECKLIST.md`.
   - Run `bun test` from `D:\Projects\bun-win32\doom_codex`.
   - Run `bun x tsc --noEmit --project D:\Projects\bun-win32\doom_codex\tsconfig.json`.
   - Do not declare a fix complete while any of those commands fail. Iterate until green.

Shared-log behavior:

- If the audit surfaces a reusable new fact about the reference, the runtime, or the codebase, append it to `D:\Projects\bun-win32\doom_codex\plans\FACT_LOG.md`.
- If the audit changes a prior decision, update `D:\Projects\bun-win32\doom_codex\plans\DECISION_LOG.md`.
- If the audit refreshes an oracle artifact, update `D:\Projects\bun-win32\doom_codex\plans\REFERENCE_ORACLES.md`.
- Do NOT append to `HANDOFF_LOG.md`. Do NOT modify `MASTER_CHECKLIST.md`.

Output requirements:

- At the very top of your response, print the randomly selected step IDs and titles and a one-line reason each was selected (for example, "picked at random from phase 07").
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

RLP_STATUS: COMPLETED|BLOCKED|LIMIT_REACHED
RLP_AUDITED_STEPS: <semicolon-separated step ids or NONE>
RLP_FILES_CHANGED: <semicolon-separated absolute paths or NONE>
RLP_TEST_COMMANDS: <semicolon-separated commands or NONE>
RLP_REASON: <one-line reason>

Special limit rule:

- If you believe you are unable to continue because of context, output, or model-limit pressure, stop immediately and use `RLP_STATUS: LIMIT_REACHED`.
- Do not start another audit in that case.

Do not ask for permission. Do not plan. Begin the random selection and audit now.
