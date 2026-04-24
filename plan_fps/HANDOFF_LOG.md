# Handoff Log

## 2026-04-24 - Playable plan system creation

- status: created
- summary: Created `plan_fps/` as the active playable parity control center with 223 step files, shared logs, a validator, and validator tests.
- next_step: `00-001 Classify Existing Plan`

## 2026-04-24 - 00-001 classify-existing-plan

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 00-001
- step_title: classify-existing-plan
- summary: Classified the old `plan_engine/` work as `mixed` and locked the classification as durable playable-plan data. Wrote `plan_fps/manifests/existing-plan-classification.json` (schema v1) pinning the mixed classification, decision link D-FPS-002, 167 completed steps across 18 phases with per-phase counts, evidence paths, and the playable-parity gap (required `bun run doom.ts` vs. current `bun run src/main.ts`, missing root `doom.ts`). Added focused test `test/plan_fps/existing-plan-classification.test.ts` (11 tests, 73 expects) that loads the manifest, locks schema version and classification, cross-checks per-phase counts against `plan_engine/MASTER_CHECKLIST.md`, verifies evidence paths exist on disk, verifies the `doom.ts` entry point does not exist, and verifies `package.json` start script matches the gap record.
- files_changed: plan_fps/manifests/existing-plan-classification.json; test/plan_fps/existing-plan-classification.test.ts; plan_fps/FACT_LOG.md; plan_fps/HANDOFF_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/validate-plan.ts
- recovery_edit: Widened `parseChecklist` regex in `plan_fps/validate-plan.ts` to match both `[ ]` and `[x]` checklist markers. Without this, flipping `00-001` to `[x]` in `MASTER_CHECKLIST.md` (required to advance the Ralph loop) dropped the parseable step count to 222 and broke both `plan_fps/validate-plan.test.ts` and `bun run plan_fps/validate-plan.ts`. Step file titles remain `[ ]` and the validator still enforces that; only the checklist row regex was relaxed.
- tests_run: bun run format (Formatted 3 files); bun test test/plan_fps/existing-plan-classification.test.ts (11 pass, 0 fail, 73 expects); bun test plan_fps/validate-plan.test.ts (2 pass, 0 fail); bun run plan_fps/validate-plan.ts (Validated 223 playable parity steps, First step: 00-001); bun test (6344 pass, 0 fail, 687728 expects across 172 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-006 (old plan classification and evidence paths)
- decision_changes: none (D-FPS-002 already accepts the mixed classification; no update needed)
- oracle_changes: none
- next_eligible_steps: 00-002 declare-plan-fps-control-center
- open_risks: none

## 2026-04-24 - 00-002 declare-plan-fps-control-center

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 00-002
- step_title: declare-plan-fps-control-center
- summary: Declared `plan_fps/` as the active playable parity control center and locked `plan_engine/` as prior art only. Wrote `plan_fps/manifests/00-002-declare-plan-fps-control-center.json` (schema v1) pinning decision D-FPS-001, the active control-center directory plus nine subpaths (README, MASTER_CHECKLIST, PROMPT, PRE_PROMPT, STEP_TEMPLATE, validator script/test, steps/, manifests/), the prior-art plan directory and its inherited `mixed` classification with link to 00-001's classification manifest, the `bun run doom.ts` runtime target, totalSteps=223, firstStepId=00-001 firstStepTitleSlug=classify-existing-plan, the final gate 15-010 gate-final-side-by-side, writableWorkspaceRoot `D:/Projects/doom-in-typescript`, the three read-only reference roots, the nine shared plan files, ralphLoopWorkflowStepCount=10, and the five canonical validation commands. Added focused test `test/plan_fps/00-002-declare-plan-fps-control-center.test.ts` (15 tests, 103 expects) that locks every manifest field by exact value, verifies every path exists on disk, cross-references MASTER_CHECKLIST.md and README.md header text for totals/first-step/runtime-target, cross-references the classification manifest for schema alignment, and verifies the D-FPS-001 decision cites the new manifest artifact as evidence.
- files_changed: plan_fps/manifests/00-002-declare-plan-fps-control-center.json; test/plan_fps/00-002-declare-plan-fps-control-center.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: First iteration of the focused test asserted `First eligible step: \`00-001\`` against MASTER_CHECKLIST.md, which failed because the checklist header reads `First eligible step: \`00-001 Classify Existing Plan\`` (id plus Title-Case slug). Widened the assertion to include the trailing `Classify Existing Plan` label so it matches both README.md and MASTER_CHECKLIST.md verbatim.
- tests_run: bun run format (Formatted 2 files, then No fixes applied on rerun); bun test test/plan_fps/00-002-declare-plan-fps-control-center.test.ts (15 pass, 0 fail, 103 expects); bun test (6363 pass, 0 fail, 687911 expects across 173 files); bun x tsc --noEmit --project tsconfig.json (clean); bun test plan_fps/validate-plan.test.ts (2 pass, 0 fail, 6 expects); bun run plan_fps/validate-plan.ts (Validated 223 playable parity steps, First step: 00-001)
- new_facts: none
- decision_changes: D-FPS-001 evidence extended to cite `plan_fps/manifests/00-002-declare-plan-fps-control-center.json`; status remains accepted
- oracle_changes: none
- next_eligible_steps: 00-003 pin-bun-run-doom-entrypoint
- open_risks: none

## 2026-04-24 - 00-003 pin-bun-run-doom-entrypoint

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 00-003
- step_title: pin-bun-run-doom-entrypoint
- summary: Pinned the C1 runtime command contract as exactly `bun run doom.ts` and decomposed it into program (`bun`), subcommand (`run`), and workspace-root entry file (`doom.ts`). Wrote `plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json` (schema v1) tying decision D-FPS-003, the literal runtimeCommand, the commandContract triple, the workspace-relative + absolute entry-point paths with `presentOnDisk=false`, the implementation owner step (03-002 wire-root-doom-ts-entrypoint), the current launcher (`package.json` `start` script value `bun run src/main.ts`, current entry `src/main.ts`, `matchesRuntimeCommand=false`), the cross-reference to the 00-002 control-center manifest, and an evidence-paths list. Added focused test `test/plan_fps/00-003-pin-bun-run-doom-entrypoint.test.ts` (16 tests, 91 expects) that locks every manifest field by exact value, asserts `runtimeCommand === program + " " + subcommand + " " + entryFile`, verifies `doom.ts` does not exist while `src/main.ts` does, cross-checks `package.json` scripts.start against the recorded scriptValue, cross-checks the 00-002 control-center manifest's runtimeTarget against this manifest's runtimeCommand, verifies README.md still pins `Final command: bun run doom.ts`, verifies MASTER_CHECKLIST.md still pins `Runtime target: bun run doom.ts`, and verifies the D-FPS-003 section in DECISION_LOG.md is accepted, pins the exact decision sentence, and now cites this manifest as evidence.
- files_changed: plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json; test/plan_fps/00-003-pin-bun-run-doom-entrypoint.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, No fixes applied); bun test test/plan_fps/00-003-pin-bun-run-doom-entrypoint.test.ts (16 pass, 0 fail, 91 expects); bun test plan_fps/validate-plan.test.ts (2 pass, 0 fail, 6 expects); bun run plan_fps/validate-plan.ts (Validated 223 playable parity steps, First step: 00-001); bun test (6384 pass, 0 fail, 688032 expects across 174 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: none
- decision_changes: D-FPS-003 evidence extended to cite `plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json`; status remains accepted
- oracle_changes: none
- next_eligible_steps: 00-004 reject-compiled-exe-target
- open_risks: none

## 2026-04-24 - 00-004 reject-compiled-exe-target

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 00-004
- step_title: reject-compiled-exe-target
- summary: Locked the governance rejection of compiled-binary delivery targets for the C1 playable parity product. Created decision D-FPS-005 ("Reject compiled-binary delivery targets for the C1 playable parity product. No compiled executable, wrapper executable, installer, or packaged binary."), affected_steps 00-004/03-001/03-002/15-010, evidence list citing README.md, the 00-003 and 00-004 manifests, package.json, and tsconfig.json. Wrote `plan_fps/manifests/00-004-reject-compiled-exe-target.json` (schema v1) pinning four rejectedTargets kinds (compiled-executable, wrapper-executable, installer, packaged-binary) with descriptions, forbiddenArtifactExtensions (.exe, .msi, .appimage, .app, .dmg), forbiddenBuildCommands (bun build --compile, pkg, nexe), forbiddenPackageJsonScriptNames (build-exe, build:exe, compile-exe, compile:exe, make-exe, dist-exe, package-exe, bundle-exe), requiredRuntimeTarget linking D-FPS-003 + the 00-003 manifest, currentWorkspace pinning package.json + tsconfig.json with tsconfigNoEmit=true and four forbiddenArtifactChecks at the workspace root (doom.exe, doom-launcher.exe, doom-setup.exe, doom-bundle.exe, all expectedPresentOnDisk=false), the controlCenterManifestPath cross-reference, the exact README.md rejection line, and eight evidencePaths. Added focused test `test/plan_fps/00-004-reject-compiled-exe-target.test.ts` (17 tests, 239 expects) that locks every manifest field by exact value, asserts forbiddenArtifactChecks paths are absent on disk today and each ends with a recorded forbiddenArtifactExtension, cross-checks tsconfig.json.compilerOptions.noEmit against the manifest, verifies package.json scripts do not contain any forbidden script name or forbidden build command substring, cross-references the 00-002 control-center and 00-003 entry-point manifests, verifies README.md contains the rejection line verbatim, verifies the D-FPS-005 section in DECISION_LOG.md is accepted, pins the exact rejection sentence, and cites this manifest as evidence, and globs the workspace root to assert no file ends in any forbiddenArtifactExtension.
- files_changed: plan_fps/manifests/00-004-reject-compiled-exe-target.json; test/plan_fps/00-004-reject-compiled-exe-target.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, No fixes applied); bun test test/plan_fps/00-004-reject-compiled-exe-target.test.ts (17 pass, 0 fail, 239 expects); bun test (6407 pass, 0 fail, 688286 expects across 175 files); bun x tsc --noEmit --project tsconfig.json (clean); bun test plan_fps/validate-plan.test.ts (2 pass, 0 fail, 6 expects); bun run plan_fps/validate-plan.ts (Validated 223 playable parity steps, First step: 00-001)
- new_facts: none
- decision_changes: added D-FPS-005 accepted, citing the new 00-004 manifest alongside README.md, the 00-003 manifest, package.json, and tsconfig.json as evidence
- oracle_changes: none
- next_eligible_steps: 00-005 pin-bun-runtime-and-package-manager
- open_risks: none

## 2026-04-24 - 00-005 pin-bun-runtime-and-package-manager

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 00-005
- step_title: pin-bun-runtime-and-package-manager
- summary: Locked Bun as the only runtime, package manager, script runner, and test runner for the C1 playable parity product. Created decision D-FPS-006 ("Bun is the only runtime, package manager, script runner, and test runner for the C1 playable parity product. No Node.js runtime, no `npm`, `yarn`, or `pnpm` package managers, no `npx`, `ts-node`, or `tsx` script runners, and no `vitest`, `jest`, or `mocha` test runners."), affected_steps 00-005/00-006/03-006, evidence list citing AGENTS.md, plan_fps/README.md, the 00-002/00-003/00-004/00-005 manifests, package.json, and bun.lock. Wrote `plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json` (schema v1) pinning six bunRoles (runtime=`bun`, package-manager=`bun install`, package-adder=`bun add`, script-runner=`bun run`, test-runner=`bun test`, builder=`bun build`) in canonical order, forbiddenRuntimePrograms (node), forbiddenPackageManagers (npm, yarn, pnpm), forbiddenScriptRunners (npx, ts-node, tsx), forbiddenTestRunners (vitest, jest, mocha), allowedLockfile (bun.lock, expectedPresentOnDisk=true), forbiddenLockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml, all expectedPresentOnDisk=false), requiredRuntimeTarget linking D-FPS-003 + the 00-003 manifest, currentWorkspace pinning package.json script names (format, start) each starting with the `bun run` script-runner prefix and everyScriptUsesBun=true, controlCenterManifestPath + rejectCompiledExeManifestPath cross-references, and ten evidencePaths. Added focused test `test/plan_fps/00-005-pin-bun-runtime-and-package-manager.test.ts` (22 tests, 235 expects) that locks schemaVersion/decisionId, bunRoles length/order/per-role commandPrefix, uniqueness across bunRoles fields, commandPrefix-starts-with-bun invariant, forbidden-list equality and uniqueness for each role, lockfile presence (bun.lock present, forbidden lockfiles absent) and path-collision check, requiredRuntimeTarget cross-check against 00-003 manifest plus runtime/script-runner prefix invariant, currentWorkspace cross-check against live package.json scripts, a "no script value starts with a forbidden token" invariant, a "no dependency name equals any forbidden tool" invariant, control-center and reject-compiled-exe manifest cross-references, evidencePaths shape/existence/no-duplicates/outside-read-only-roots, rationale key-token presence, DECISION_LOG.md D-FPS-006 section assertions (accepted status, exact Bun-only sentence, cites this manifest), and AGENTS.md presence of every forbidden-alternative token.
- files_changed: plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json; test/plan_fps/00-005-pin-bun-runtime-and-package-manager.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 1 file); bun test test/plan_fps/00-005-pin-bun-runtime-and-package-manager.test.ts (22 pass, 0 fail, 235 expects); bun test (6434 pass, 0 fail, 688555 expects across 176 files); bun x tsc --noEmit --project tsconfig.json (clean); bun test plan_fps/validate-plan.test.ts (2 pass, 0 fail, 6 expects); bun run plan_fps/validate-plan.ts (Validated 223 playable parity steps, First step: 00-001)
- new_facts: none
- decision_changes: added D-FPS-006 accepted, citing the new 00-005 manifest alongside AGENTS.md, plan_fps/README.md, the 00-002/00-003/00-004 manifests, package.json, and bun.lock as evidence
- oracle_changes: none
- next_eligible_steps: 00-006 record-bun-native-api-preference
- open_risks: none
