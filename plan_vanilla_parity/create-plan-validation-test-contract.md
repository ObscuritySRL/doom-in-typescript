# Create Plan Validation Test Contract

This document pins the canonical plan validation test contract that the focused test at `plan_vanilla_parity/validate-plan.test.ts` must satisfy in the vanilla DOOM 1.9 parity rebuild. It freezes the canonical test file path `plan_vanilla_parity/validate-plan.test.ts`, the canonical test runner `bun:test`, the canonical focused test invocation `bun test plan_vanilla_parity/validate-plan.test.ts` declared verbatim by `plan_vanilla_parity/README.md` and `plan_vanilla_parity/PROMPT.md`, the canonical top-level describe block `vanilla parity plan validator`, the canonical nine test names in canonical declaration order (`accepts the generated vanilla parity plan`, `parses the generated checklist and locks the validation command`, `accepts a complete fixture through an explicit plan directory`, `reports missing required step fields`, `rejects banned verification commands`, `rejects write locks inside read-only reference roots`, `rejects final gate evidence that relies on deferred or manifest-only proof`, `rejects overlapping lane write scopes`, `returns CLI diagnostics for invalid fixtures`), the canonical imported source module path `./validate-plan.ts`, the canonical four imported public surfaces (`PLAN_VALIDATION_COMMAND`, `parseChecklist`, `runValidationCli`, `validatePlan`) imported as a single named-import statement ASCIIbetically sorted, the canonical three pinned constants (`expectedTotalSteps = 398`, `finalGateStepId = '13-004'`, `finalGateSlug = 'gate-full-final-side-by-side-proof'`), the canonical fixture root path prefix `.cache/plan-vanilla-parity-fixture-` rooted under `process.cwd()`, the canonical eight fixture helper functions (`createChecklistLine`, `createFixtureSteps`, `createMasterChecklist`, `createParallelWorkText`, `createRequiredPlanFiles`, `createStepText`, `withPlanFixture`, `writeFixtureFiles`), the canonical two internal interfaces (`FixtureOptions`, `FixtureStep`), the canonical two `node:` modules imported (`node:fs/promises` for `mkdir`/`mkdtemp`/`rm`/`writeFile`, `node:path` for `dirname`/`join`), the canonical three `bun:test` imports (`describe`, `expect`, `test`), the canonical twelve required fixture plan files mirrored from `REQUIRED_FILES` in `plan_vanilla_parity/validate-plan.ts`, the canonical fixture step generation rule (397 phase-00 steps with id `00-NNN` plus the final gate step `13-004` totalling exactly 398 steps where step `00-001` carries slug `establish-vanilla-parity-control-center` and title `Establish Vanilla Parity Control Center` and steps `00-002`..`00-397` carry slug `generated-step-NNN` and title `Generated Step NNN` with each chained prerequisite equal to the immediately prior id and the final gate step `13-004` carries slug `gate-full-final-side-by-side-proof`, title `Gate Full Final Side By Side Proof`, lane `acceptance`, and prerequisite `00-397`), the canonical fixture step text shape (every required-field section in canonical `REQUIRED_STEP_FIELDS` order with the `# [ ] STEP <id>: <title>` heading and the canonical four verification commands in canonical order), the canonical three fixture override hooks (`finalEvidence`, `verificationCommands`, `writeLock`), nine per-test contract sections (each pinning its verbatim test name, the helper(s) it invokes, the canonical assertion(s) it makes, and — for failure-mode tests — the canonical diagnostic it expects against the canonical file path), the canonical six failure modes covered by tests four through nine (missing required step fields, banned verification command, write lock inside read-only reference root, final gate evidence containing a rejected pattern, overlapping lane write scopes, CLI invocation against an invalid fixture), the canonical fixture isolation rule (every fixture-driven test runs against a unique `.cache/plan-vanilla-parity-fixture-*` directory created by `mkdtemp` so concurrent tests do not collide), the canonical fixture cleanup rule (`withPlanFixture` deletes the fixture root via `rm(fixtureRoot, { force: true, recursive: true })` in a `finally` block so the temporary tree never survives a test), and the canonical no-real-tree-mutation rule (the test never calls `Bun.write`, `node:fs/promises#writeFile`, or `mkdir` against any path outside the unique `.cache/plan-vanilla-parity-fixture-*` directory and never mutates the real `plan_vanilla_parity/` tree). Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 plan validation test contract

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## test file path

plan_vanilla_parity/validate-plan.test.ts

## test runner

bun:test

## focused test invocation

bun test plan_vanilla_parity/validate-plan.test.ts

## top-level describe block

vanilla parity plan validator

## total test count

9

## test names

- accepts the generated vanilla parity plan
- parses the generated checklist and locks the validation command
- accepts a complete fixture through an explicit plan directory
- reports missing required step fields
- rejects banned verification commands
- rejects write locks inside read-only reference roots
- rejects final gate evidence that relies on deferred or manifest-only proof
- rejects overlapping lane write scopes
- returns CLI diagnostics for invalid fixtures

## imported source path

./validate-plan.ts

## imported public surface count

4

## imported public surfaces

- PLAN_VALIDATION_COMMAND
- parseChecklist
- runValidationCli
- validatePlan

## pinned constant count

3

## pinned constants

- expectedTotalSteps
- finalGateStepId
- finalGateSlug

## expectedTotalSteps value

398

## finalGateStepId value

13-004

## finalGateSlug value

gate-full-final-side-by-side-proof

## fixture root path prefix

The canonical fixture root path prefix `.cache/plan-vanilla-parity-fixture-` is rooted under `process.cwd()` and instantiated by `mkdtemp(join(process.cwd(), '.cache', 'plan-vanilla-parity-fixture-'))` in `withPlanFixture`. Every fixture-driven test runs against a unique directory whose suffix is generated by `mkdtemp` so concurrent tests do not collide. The `.cache/` directory is the canonical writable scratch root used across the repository for ephemeral test artifacts; the real `plan_vanilla_parity/` tree is never mutated by the test.

## fixture helper count

8

## fixture helpers

- createChecklistLine
- createFixtureSteps
- createMasterChecklist
- createParallelWorkText
- createRequiredPlanFiles
- createStepText
- withPlanFixture
- writeFixtureFiles

## internal interface count

2

## internal interfaces

- FixtureOptions
- FixtureStep

## node module count

2

## node modules

- node:fs/promises
- node:path

## node:fs/promises imported names

- mkdir
- mkdtemp
- rm
- writeFile

## node:path imported names

- dirname
- join

## bun:test import count

3

## bun:test imports

- describe
- expect
- test

## required fixture plan file count

12

## required fixture plan files

- plan_vanilla_parity/DEPENDENCY_GRAPH.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PRE_PROMPT.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/REFERENCE_ORACLES.md
- plan_vanilla_parity/RISK_REGISTER.md
- plan_vanilla_parity/SOURCE_CATALOG.md
- plan_vanilla_parity/STEP_TEMPLATE.md
- plan_vanilla_parity/validate-plan.test.ts
- plan_vanilla_parity/validate-plan.ts

## fixture step generation rule

The `createFixtureSteps` helper returns exactly `expectedTotalSteps` (398) `FixtureStep` records: 397 phase-00 steps with id `00-NNN` (zero-padded three-digit sequence number), followed by the canonical final gate step `13-004`. Step `00-001` carries slug `establish-vanilla-parity-control-center`, title `Establish Vanilla Parity Control Center`, lane `governance`, and prerequisite `none`. Steps `00-002`..`00-397` carry slug `generated-step-NNN` (where `NNN` is the zero-padded three-digit sequence number), title `Generated Step NNN`, lane `governance`, and prerequisite equal to the immediately prior id. The final step carries id `13-004`, slug `gate-full-final-side-by-side-proof`, title `Gate Full Final Side By Side Proof`, lane `acceptance`, and prerequisite `00-397`. The chained prerequisite topology guarantees `parsePrerequisites` and the prior-step-id check inside `validateStepText` accept the fixture without diagnostics.

## fixture step text shape

The `createStepText` helper builds each fixture step file as Markdown with the canonical heading `# [ ] STEP <id>: <title>` followed by every entry in `REQUIRED_STEP_FIELDS` as a `## ` section in canonical order (`id`, `lane`, `title`, `goal`, `prerequisites`, `parallel-safe-with`, `write lock`, `read-only paths`, `research sources`, `expected changes`, `test files`, `verification commands`, `completion criteria`, `final evidence`). The default `write lock` lists `test/vanilla_parity/<slug>.json` and `test/vanilla_parity/<slug>.test.ts`. The default `verification commands` are the canonical four (`bun run format`, `bun test test/vanilla_parity/<slug>.test.ts`, `bun test`, `bun x tsc --noEmit --project tsconfig.json`) wrapped in backticks. The default `final evidence` is `- A machine-generated final side-by-side report from clean launch that runs bun run doom.ts and the selected local reference with the same deterministic input stream.\n- The report compares deterministic state, framebuffer, audio, music events, menu transitions, level transitions, save/load bytes, demo playback, and full-playthrough completion with zero default differences.` for the final gate step `13-004` (so the canonical twelve `REQUIRED_FINAL_GATE_PHRASES` and zero `REJECTED_FINAL_EVIDENCE_PATTERNS` are satisfied) and `- Focused evidence is committed and pushed.` for every other step. The shape guarantees the unmodified fixture passes `validateStepText` and `validateFinalGate` with zero diagnostics.

## fixture override hook count

3

## fixture override hooks

- finalEvidence
- verificationCommands
- writeLock

## test 1 accepts the generated vanilla parity plan

The first canonical test `accepts the generated vanilla parity plan` calls `validatePlan()` with no arguments so the validator defaults to `DEFAULT_PLAN_DIRECTORY = import.meta.dir` (the real `plan_vanilla_parity/` tree). It asserts `result.errors` equals the empty array `[]`, `result.firstStep` equals the canonical first step id `00-001`, and `result.totalSteps` equals the canonical total step count `expectedTotalSteps` (398). This test proves the real plan tree is well-formed under the validator and is the canonical happy-path acceptance test.

## test 2 parses the generated checklist and locks the validation command

The second canonical test `parses the generated checklist and locks the validation command` reads `plan_vanilla_parity/MASTER_CHECKLIST.md` via `Bun.file(...).text()`, calls `parseChecklist(checklistText)`, asserts the parsed step count equals `expectedTotalSteps` (398), asserts the first parsed step id equals `00-001`, asserts the last parsed step id equals `finalGateStepId` (`13-004`), and asserts the imported `PLAN_VALIDATION_COMMAND` constant equals the canonical CLI invocation `bun run plan_vanilla_parity/validate-plan.ts`. This test proves the canonical regular expression `CHECKLIST_LINE_PATTERN` matches every checklist row in the real `MASTER_CHECKLIST.md` and that the canonical CLI invocation export name and value have not drifted.

## test 3 accepts a complete fixture through an explicit plan directory

The third canonical test `accepts a complete fixture through an explicit plan directory` invokes `withPlanFixture({}, async (planDirectory) => { ... })` and calls `validatePlan(planDirectory)` with the explicit fixture plan directory argument. It asserts the entire result equals `{ errors: [], firstStep: '00-001', totalSteps: expectedTotalSteps }`. This test proves the validator accepts an arbitrarily rooted fixture without depending on `import.meta.dir` and that the fixture generators (`createFixtureSteps`, `createMasterChecklist`, `createParallelWorkText`, `createRequiredPlanFiles`, `createStepText`) collectively build a plan that the validator accepts with zero diagnostics.

## test 4 reports missing required step fields

The fourth canonical test `reports missing required step fields` overrides the first fixture step file with `createStepText(firstStep)` minus the `## final evidence` section body (the trailing `\n## final evidence\n\n- Focused evidence is committed and pushed.` block is removed via `String.replace`). It calls `validatePlan(planDirectory)` and asserts the returned `result.errors` array contains the canonical diagnostic `{ file: 'plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md', message: 'Step fields must exactly match: id, lane, title, goal, prerequisites, parallel-safe-with, write lock, read-only paths, research sources, expected changes, test files, verification commands, completion criteria, final evidence.' }`. This test proves `validateStepText` enforces the canonical fourteen `REQUIRED_STEP_FIELDS` heading sequence as a single concatenated equality check and emits the verbatim diagnostic when a required heading is missing.

## test 5 rejects banned verification commands

The fifth canonical test `rejects banned verification commands` overrides the first fixture step file via `createStepText(firstStep, { verificationCommands: [...] })` with a verification list whose third entry is `npm test` and asserts the returned `result.errors` array contains the canonical diagnostic `{ file: 'plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md', message: 'Verification command uses a banned tool: npm test.' }`. This test proves `usesBannedCommand` detects `npm` (one of the canonical ten `BANNED_COMMANDS`) when it appears as the first whitespace-delimited token of any verification command and that `validateStepText` emits the verbatim diagnostic with the offending command verbatim.

## test 6 rejects write locks inside read-only reference roots

The sixth canonical test `rejects write locks inside read-only reference roots` overrides the first fixture step file via `createStepText(firstStep, { writeLock: ['doom/DOOM1.WAD', 'test/vanilla_parity/<slug>.test.ts'] })` and asserts the returned `result.errors` array contains the canonical diagnostic `{ file: 'plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md', message: 'Write lock is inside read-only reference root: doom/DOOM1.WAD.' }`. This test proves `validateWritablePath` rejects every write-lock entry that begins with a canonical `READ_ONLY_ROOTS` prefix (`doom/`, `iwad/`, `reference/`) and that `validateStepText` emits the verbatim diagnostic with the offending path verbatim (preserving original casing in the error message even though the prefix check is case-insensitive).

## test 7 rejects final gate evidence that relies on deferred or manifest-only proof

The seventh canonical test `rejects final gate evidence that relies on deferred or manifest-only proof` overrides the final gate fixture step `13-004` via `createStepText(finalGateStep, { finalEvidence: '- A pending manifest-only sampled-only declared intent report.' })` and asserts the returned `result.errors` array contains the canonical diagnostic `{ file: 'plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md', message: 'Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.' }`. This test proves `validateFinalGate` checks every entry in `REJECTED_FINAL_EVIDENCE_PATTERNS` against the `## final evidence` section body and emits the verbatim diagnostic when any rejected pattern matches.

## test 8 rejects overlapping lane write scopes

The eighth canonical test `rejects overlapping lane write scopes` overrides `plan_vanilla_parity/PARALLEL_WORK.md` in the fixture with a two-row table whose `core` lane owns `src/core/` and whose `timing` lane owns `src/core/fixed.ts`, then asserts the returned `result.errors` array contains the canonical diagnostic `{ file: 'plan_vanilla_parity/PARALLEL_WORK.md', message: 'Lane write scopes overlap: core owns src/core/ and timing owns src/core/fixed.ts.' }`. This test proves `parseLaneWriteScopes` parses lane rows from the Markdown table, `pathsConflict` detects a directory prefix overlap, and `validateParallelWork` emits the verbatim diagnostic naming both lanes and both roots.

## test 9 returns CLI diagnostics for invalid fixtures

The ninth canonical test `returns CLI diagnostics for invalid fixtures` overrides the first fixture step file via `createStepText(firstStep, { verificationCommands: [..., 'node doom.ts', ...] })` and invokes `runValidationCli(planDirectory, stdoutCapture, stderrCapture)` with explicit stdout and stderr collector callbacks. It asserts the returned exit code equals `1`, the captured stdout array equals the empty array `[]`, and the captured stderr array contains the canonical diagnostic line `plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md: Verification command uses a banned tool: node doom.ts.`. This test proves `runValidationCli` returns the canonical failure exit code `1`, never writes to stdout when errors exist, and writes one `<error.file>: <error.message>` line per error to the stderr writer.

## failure mode count

6

## failure modes

- missing required step fields produces the canonical step-fields diagnostic
- banned verification command produces the canonical banned-tool diagnostic
- write lock inside read-only reference root produces the canonical read-only-root diagnostic
- final gate evidence containing a rejected pattern produces the canonical rejected-pattern diagnostic
- overlapping lane write scopes produces the canonical scope-overlap diagnostic
- CLI invocation against an invalid fixture surfaces stderr diagnostics and returns exit code 1

## fixture isolation rule

Every fixture-driven test (tests 3 through 9) runs against a unique `.cache/plan-vanilla-parity-fixture-*` directory created by `mkdtemp` and named with a randomised suffix so concurrent tests never collide. The fixture root is rooted at `process.cwd()` so the path resolves consistently regardless of where the test runner is invoked. The fixture is built by `withPlanFixture(options, run)`, which constructs the canonical twelve required plan files plus 398 step files via `createRequiredPlanFiles(steps)` and `createStepText(step)`, applies any per-test `options.overrides` map keyed by `plan_vanilla_parity/*` relative paths, writes every file via `writeFixtureFiles(fixtureRoot, files)`, awaits the supplied `run(planDirectory, steps)` callback with the fixture's `plan_vanilla_parity/` directory as the explicit `planDirectory` argument, and ultimately deletes the fixture root in a `finally` block.

## fixture cleanup rule

`withPlanFixture` wraps every fixture-driven invocation in a `try { ... } finally { await rm(fixtureRoot, { force: true, recursive: true }); }` block. The `force: true` flag suppresses errors if the directory is already gone, and `recursive: true` removes the entire tree. The cleanup runs even if the supplied `run` callback throws, so a failing test never leaks a partially constructed fixture into `.cache/`. The test never calls `Bun.write`, `node:fs/promises#writeFile`, or `mkdir` against any path outside the unique `.cache/plan-vanilla-parity-fixture-*` directory and never mutates the real `plan_vanilla_parity/` tree.

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/STEP_TEMPLATE.md
- plan_vanilla_parity/create-plan-validation-script-contract.md
- plan_vanilla_parity/define-final-acceptance-standard.md
- plan_vanilla_parity/define-lane-write-lock-contract.md
- plan_vanilla_parity/define-step-file-required-fields.md
- plan_vanilla_parity/establish-vanilla-parity-control-center.md
- plan_vanilla_parity/steps/00-016-create-plan-validation-test-contract.md
- plan_vanilla_parity/validate-plan.test.ts
- plan_vanilla_parity/validate-plan.ts

## acceptance phrasing

The canonical plan validation test in the vanilla DOOM 1.9 parity rebuild is the focused `bun:test` module at `plan_vanilla_parity/validate-plan.test.ts`, invoked via the canonical focused test command `bun test plan_vanilla_parity/validate-plan.test.ts`. The test imports the canonical four public surfaces `PLAN_VALIDATION_COMMAND`, `parseChecklist`, `runValidationCli`, and `validatePlan` from the canonical source path `./validate-plan.ts` as a single named-import statement ASCIIbetically sorted. The test pins the canonical three constants `expectedTotalSteps = 398`, `finalGateStepId = '13-004'`, and `finalGateSlug = 'gate-full-final-side-by-side-proof'`. The test declares one canonical top-level describe block named `vanilla parity plan validator` that contains the canonical nine tests in canonical declaration order (`accepts the generated vanilla parity plan`, `parses the generated checklist and locks the validation command`, `accepts a complete fixture through an explicit plan directory`, `reports missing required step fields`, `rejects banned verification commands`, `rejects write locks inside read-only reference roots`, `rejects final gate evidence that relies on deferred or manifest-only proof`, `rejects overlapping lane write scopes`, `returns CLI diagnostics for invalid fixtures`). The test defines the canonical eight fixture helper functions `createChecklistLine`, `createFixtureSteps`, `createMasterChecklist`, `createParallelWorkText`, `createRequiredPlanFiles`, `createStepText`, `withPlanFixture`, and `writeFixtureFiles`, plus the canonical two internal interfaces `FixtureOptions` and `FixtureStep`. The test imports `mkdir`, `mkdtemp`, `rm`, and `writeFile` from `node:fs/promises`, `dirname` and `join` from `node:path`, and `describe`, `expect`, and `test` from `bun:test`. The fixture writes the canonical twelve required plan files mirrored from `REQUIRED_FILES` in `plan_vanilla_parity/validate-plan.ts` (`DEPENDENCY_GRAPH.md`, `MASTER_CHECKLIST.md`, `PARALLEL_WORK.md`, `PRE_PROMPT.md`, `PROMPT.md`, `README.md`, `REFERENCE_ORACLES.md`, `RISK_REGISTER.md`, `SOURCE_CATALOG.md`, `STEP_TEMPLATE.md`, `validate-plan.test.ts`, `validate-plan.ts`). The fixture builds 397 phase-00 step files (`00-001`..`00-397`) plus the canonical final gate step `13-004` totalling exactly 398 steps. The fixture root is created by `mkdtemp(join(process.cwd(), '.cache', 'plan-vanilla-parity-fixture-'))` and deleted by `rm(fixtureRoot, { force: true, recursive: true })` in a `finally` block so the temporary tree never survives a test and the real `plan_vanilla_parity/` tree is never mutated. The canonical three fixture override hooks `finalEvidence`, `verificationCommands`, and `writeLock` let failure-mode tests rewrite a single field in a single step file without disturbing the rest of the fixture. The canonical six failure modes covered by tests four through nine are missing required step fields, banned verification command, write lock inside read-only reference root, final gate evidence containing a rejected pattern, overlapping lane write scopes, and CLI invocation against an invalid fixture.
