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

## 2026-04-24 - 00-006 record-bun-native-api-preference

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 00-006
- step_title: record-bun-native-api-preference
- summary: Recorded the Bun-native API preference for the C1 playable parity product and the import group order that follows from it. Created decision D-FPS-007 ("Prefer Bun-native APIs (`Bun.file`, `Bun.write`, `Bun.serve`, `Bun.argv`, `Bun.env`, `Bun.sleep`, `Bun.spawn`, `bun:test`, `bun:ffi`, `bun:sqlite`) over their Node standard-library equivalents whenever both exist, and enforce the import group order `bun:*` → `node:*` → third-party → relative with a blank line between groups."), affected_steps 00-006/03-004/03-005/03-006, evidence list citing AGENTS.md, plan_fps/README.md, the 00-002/00-003/00-005/00-006 manifests, package.json, and tsconfig.json. Wrote `plan_fps/manifests/00-006-record-bun-native-api-preference.json` (schema v1) pinning ten preferredBunApis in canonical order (`Bun.file`, `Bun.write`, `Bun.serve`, `Bun.argv`, `Bun.env`, `Bun.sleep`, `Bun.spawn`, `bun:test`, `bun:ffi`, `bun:sqlite`) each with `kind` (`global-namespace` for `Bun.*`, `builtin-module` for `bun:*`), `purpose`, and `nodeAlternatives`, four `importGroupOrder` entries (`bun`/`bun:`, `node`/`node:`, `third-party`/``, `relative`/``) with ordinals 1..4, `forbiddenNodeOnlyDependencies` (`ffi-napi`, `node-ffi`, `node-addon-api`, `better-sqlite3`, `sqlite3`), `requiredRuntimeTarget` linking D-FPS-003 + the 00-003 manifest, `bunOnlyManifestPath` linking the 00-005 manifest, `controlCenterManifestPath` linking the 00-002 manifest, `currentWorkspace` pinning `tsconfig.json` with `compilerOptionsTypes: ["bun"]` and `package.json` FFI provider scope `@bun-win32` with five scoped dependencies (`@bun-win32/core`, `@bun-win32/gdi32`, `@bun-win32/kernel32`, `@bun-win32/user32`, `@bun-win32/winmm`), and ten evidencePaths. Added focused test `test/plan_fps/00-006-record-bun-native-api-preference.test.ts` (17 tests, 416 expects) that locks schemaVersion/decisionId, preferredBunApis length/order/uniqueness/shape, the kind-to-name prefix invariant (`global-namespace` → `Bun.`, `builtin-module` → `bun:`), importGroupOrder length/order/ordinals 1..4/unique groups/unique descriptions plus the non-empty-prefix pair (`bun:`, `node:`), forbiddenNodeOnlyDependencies equality and uniqueness, a "no preferredBunApis name collides with any forbiddenNodeOnlyDependency or nodeAlternative" invariant, a live package.json cross-check that no forbiddenNodeOnlyDependency is a declared dependency, requiredRuntimeTarget cross-check against 00-003, bunOnlyManifestPath cross-check against 00-005 including decisionId D-FPS-006, controlCenterManifestPath cross-check against 00-002, a live tsconfig.json and package.json cross-check that `compilerOptions.types` equals `["bun"]` and every `@bun-win32` scoped dependency is declared, evidencePaths shape/existence/no-duplicates/outside-read-only-roots with required path presence, rationale key-phrase presence (Bun-native, `bun:*`, `node:*`, third-party, relative, `bun run doom.ts`, D-FPS-003, D-FPS-006, `@bun-win32`), DECISION_LOG.md D-FPS-007 section assertions (accepted status, exact "Prefer Bun-native APIs" phrase, exact import-order sentence, cites this manifest), and AGENTS.md Runtime section verbatim presence of every preferredBunApis name plus both canonical import-scheme prefixes (`bun:*`, `node:*`).
- files_changed: plan_fps/manifests/00-006-record-bun-native-api-preference.json; test/plan_fps/00-006-record-bun-native-api-preference.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: First iteration of the focused test asserted unique `prefix` values across all four importGroupOrder entries, which failed because `third-party` and `relative` both carry an empty-string prefix by design. Narrowed the uniqueness invariant to `group` and `description`, and added a dedicated assertion that the non-empty prefixes are exactly `["bun:", "node:"]` in order. No manifest change was required.
- tests_run: bun run format (Formatted 2 files, No fixes applied); bun test test/plan_fps/00-006-record-bun-native-api-preference.test.ts (17 pass, 0 fail, 416 expects); bun test (6452 pass, 0 fail, 688986 expects across 177 files); bun x tsc --noEmit --project tsconfig.json (clean); bun test plan_fps/validate-plan.test.ts (2 pass, 0 fail, 6 expects); bun run plan_fps/validate-plan.ts (Validated 223 playable parity steps, First step: 00-001)
- new_facts: none
- decision_changes: added D-FPS-007 accepted, citing the new 00-006 manifest alongside AGENTS.md, plan_fps/README.md, the 00-002/00-003/00-005 manifests, package.json, and tsconfig.json as evidence
- oracle_changes: none
- next_eligible_steps: 00-007 pin-writable-workspace-boundaries
- open_risks: none

## 2026-04-24 - 00-007 pin-writable-workspace-boundaries

- status: completed
- agent: Codex
- model: codex-cli-default-unspecified
- effort: xhigh
- step_id: 00-007
- step_title: pin-writable-workspace-boundaries
- summary: Pinned the writable workspace boundary for the playable parity effort to exactly `D:/Projects/doom-in-typescript` and forbade writes outside that root. Added decision D-FPS-008 and wrote `plan_fps/manifests/00-007-pin-writable-workspace-boundaries.json` (schema v1) locking the exact workspace root path, canonical path formatting, workspace markers (`package.json`, `tsconfig.json`, `plan_fps/README.md`), README boundary lines for the workspace root and oracle artifact placement, write-policy flags plus scope, relative writable-artifact examples, and the `bun run doom.ts` runtime-target cross-reference. Added focused test `test/plan_fps/00-007-pin-writable-workspace-boundaries.test.ts` (14 tests, 55 expects) that locks every manifest field by exact value, cross-checks the live workspace root on disk, requires all marker and evidence paths to stay inside the workspace root, verifies the README boundary lines verbatim, cross-checks root-anchored `package.json` and `tsconfig.json`, and verifies D-FPS-008 is recorded in `DECISION_LOG.md`.
- files_changed: plan_fps/manifests/00-007-pin-writable-workspace-boundaries.json; test/plan_fps/00-007-pin-writable-workspace-boundaries.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: The first append patch for D-FPS-008 matched the first `- supersedes: none` line in `DECISION_LOG.md`, which inserted the new decision after `D-FPS-001`. Moved the entry to the end of the file so decision ids remain ordered.
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/00-007-pin-writable-workspace-boundaries.test.ts (14 pass, 0 fail, 55 expects); bun test (6470 pass, 0 fail, 689546 expects across 178 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: none
- decision_changes: added D-FPS-008 accepted, citing `plan_fps/README.md`, `plan_fps/manifests/00-007-pin-writable-workspace-boundaries.json`, `package.json`, and `tsconfig.json` as evidence
- oracle_changes: none
- next_eligible_steps: 00-008 pin-read-only-reference-boundaries
- open_risks: none

## 2026-04-24 - 00-008 pin-read-only-reference-boundaries

- status: completed
- agent: Codex
- model: codex-cli-default-unspecified
- effort: xhigh
- step_id: 00-008
- step_title: pin-read-only-reference-boundaries
- summary: Pinned the only in-workspace read-only reference roots for the playable parity effort to exactly `D:/Projects/doom-in-typescript/doom`, `D:/Projects/doom-in-typescript/iwad`, and `D:/Projects/doom-in-typescript/reference`, and forbade create/delete/modify operations under those roots. Added decision D-FPS-009 and wrote `plan_fps/manifests/00-008-pin-read-only-reference-boundaries.json` (schema v1) locking the exact root ids and absolute paths, runtime target `bun run doom.ts`, deterministic replay compatibility, write-policy flags, writable oracle/manifest output examples, README boundary lines, tooling scope from `package.json` and `tsconfig.json`, and evidence paths. Added focused test `test/plan_fps/00-008-pin-read-only-reference-boundaries.test.ts` (10 tests, 44 expects) that locks the manifest by exact value, cross-checks the live workspace root and root directories on disk, verifies writable artifact examples stay outside the read-only roots, verifies the README boundary lines verbatim, verifies the live package scripts and TypeScript include scope, verifies evidence paths exist, and verifies the D-FPS-009 section in `DECISION_LOG.md` by exact text.
- files_changed: plan_fps/manifests/00-008-pin-read-only-reference-boundaries.json; test/plan_fps/00-008-pin-read-only-reference-boundaries.test.ts; plan_fps/FACT_LOG.md; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun run format (rerun, Formatted 2 files, No fixes applied); bun test test/plan_fps/00-008-pin-read-only-reference-boundaries.test.ts (10 pass, 0 fail, 44 expects); bun test (6480 pass, 0 fail, 689590 expects across 179 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-008 (three top-level in-workspace reference roots exist at `doom/`, `iwad/`, and `reference/`)
- decision_changes: added D-FPS-009 accepted, citing `doom`, `iwad`, `plan_fps/README.md`, `plan_fps/manifests/00-008-pin-read-only-reference-boundaries.json`, `reference`, `package.json`, and `tsconfig.json` as evidence
- oracle_changes: none
- next_eligible_steps: 00-009 pin-asset-license-boundaries
- open_risks: none

## 2026-04-24 - 00-009 pin-asset-license-boundaries

- status: completed
- agent: Codex
- model: codex-cli-default-unspecified
- effort: xhigh
- step_id: 00-009
- step_title: pin-asset-license-boundaries
- summary: Pinned the local-reference-only license boundary for DOOM assets used by the playable parity effort. Added decision D-FPS-010 and wrote `plan_fps/manifests/00-009-pin-asset-license-boundaries.json` (schema v1) locking the Bun-only runtime target, deterministic replay compatibility, decision and fact dependencies, the three read-only reference roots, the protected local reference asset inventory (`doom/DOOM.EXE`, `doom/DOOMD.EXE`, `doom/DOOM1.WAD`, `doom/default.cfg`, `doom/chocolate-doom.cfg`), the explicit redistribution-forbidden policy, allowed local oracle-output examples under writable workspace paths, and the package/TypeScript distribution restrictions (`package.json` `private: true`, `tsconfig.json` `noEmit: true`). Added focused test `test/plan_fps/00-009-pin-asset-license-boundaries.test.ts` (9 tests, 36 expects) that deep-locks the manifest, verifies the protected inventory exists and stays under the declared read-only roots, verifies writable oracle examples stay inside the workspace and outside those roots, verifies the README redistribution line and FACT_LOG facts verbatim, cross-checks the live `package.json` and `tsconfig.json` restrictions, verifies every evidence path exists, and verifies the exact D-FPS-010 block in `DECISION_LOG.md`.
- files_changed: plan_fps/manifests/00-009-pin-asset-license-boundaries.json; test/plan_fps/00-009-pin-asset-license-boundaries.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun run format (rerun, Formatted 2 files, No fixes applied); bun test test/plan_fps/00-009-pin-asset-license-boundaries.test.ts (9 pass, 0 fail, 36 expects); bun test (6489 pass, 0 fail, 689626 expects across 180 files); bun x tsc --noEmit --project tsconfig.json (clean); bun run format (final publish pass, Formatted 2 files, No fixes applied); bun test test/plan_fps/00-009-pin-asset-license-boundaries.test.ts (final publish pass, 9 pass, 0 fail, 36 expects); bun test (final publish pass, 6489 pass, 0 fail, 689626 expects across 180 files); bun x tsc --noEmit --project tsconfig.json (final publish pass, clean)
- new_facts: none
- decision_changes: added D-FPS-010 accepted, citing `plan_fps/FACT_LOG.md`, `plan_fps/README.md`, `plan_fps/manifests/00-009-pin-asset-license-boundaries.json`, `package.json`, and `tsconfig.json` as evidence
- oracle_changes: none
- next_eligible_steps: 00-010 pin-windowed-only-difference
- open_risks: none
