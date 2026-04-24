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

## 2026-04-24 - 00-010 pin-windowed-only-difference

- status: completed
- agent: Codex
- model: codex-cli-default-unspecified
- effort: xhigh
- step_id: 00-010
- step_title: pin-windowed-only-difference
- summary: Pinned the only intentional observable difference from the reference target to windowed launch instead of fullscreen launch, and restricted that difference to the Bun runtime presentation path. Wrote `plan_fps/manifests/00-010-pin-windowed-only-difference.json` (schema v1) locking the README mission sentence, the Bun runtime metadata (`bun run doom.ts`, `package.json` private/module settings, `tsconfig.json` Bun/noEmit settings), the singular fullscreen-to-windowed presentation change, deterministic replay compatibility, and the parity-critical surface list that must remain unchanged. Added focused test `test/plan_fps/00-010-pin-windowed-only-difference.test.ts` (7 tests, 22 expects) that deep-locks the manifest payload and cross-checks README.md, DECISION_LOG.md, package.json, tsconfig.json, and evidence-path existence on disk.
- files_changed: plan_fps/manifests/00-010-pin-windowed-only-difference.json; test/plan_fps/00-010-pin-windowed-only-difference.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/00-010-pin-windowed-only-difference.test.ts (7 pass, 0 fail, 22 expect() calls); bun test (6496 pass, 0 fail, 689648 expect() calls across 181 files); bun x tsc --noEmit --project tsconfig.json (clean); bun run format (final publish pass, Formatted 2 files, No fixes applied); bun test test/plan_fps/00-010-pin-windowed-only-difference.test.ts (final publish pass, 7 pass, 0 fail, 22 expect() calls); bun test (final publish pass, 6496 pass, 0 fail, 689648 expect() calls across 181 files); bun x tsc --noEmit --project tsconfig.json (final publish pass, clean)
- new_facts: none
- decision_changes: updated D-FPS-004 evidence to cite `plan_fps/README.md` and `plan_fps/manifests/00-010-pin-windowed-only-difference.json`; accepted decision text and rationale remain unchanged
- oracle_changes: none
- next_eligible_steps: 00-011 define-side-by-side-acceptance-standard
- open_risks: none

## 2026-04-24 - 00-011 define-side-by-side-acceptance-standard

- status: completed
- agent: Codex
- model: codex-cli-default-unspecified
- effort: xhigh
- step_id: 00-011
- step_title: define-side-by-side-acceptance-standard
- summary: Defined the exact side-by-side acceptance standard for the playable parity plan. Added decision D-FPS-011 and wrote `plan_fps/manifests/00-011-define-side-by-side-acceptance-standard.json` (schema v1) locking the Bun-only runtime target, the allowed windowed-versus-fullscreen launch envelope, the ordered comparison pipeline, the final gate step `15-010`, and the eight exact-match evidence families that later oracle and gate steps must satisfy. Added focused test `test/plan_fps/00-011-define-side-by-side-acceptance-standard.test.ts` to lock the parsed manifest payload exactly, assert the ordered comparison pipeline and evidence-family standards, cross-check the README mission sentence plus live Bun/no-emit workspace settings, verify the exact D-FPS-011 decision block, and require every evidence path to exist on disk.
- files_changed: plan_fps/manifests/00-011-define-side-by-side-acceptance-standard.json; test/plan_fps/00-011-define-side-by-side-acceptance-standard.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: Replaced the initial raw manifest-text assertion in the focused test with an exact parsed-payload assertion after Biome reformatted several JSON arrays onto single lines.
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/00-011-define-side-by-side-acceptance-standard.test.ts (initial run failed on the formatting-sensitive raw-text assertion); bun run format (rerun after recovery edit, No fixes applied); bun test test/plan_fps/00-011-define-side-by-side-acceptance-standard.test.ts (rerun, 5 pass, 0 fail, 15 expect() calls); bun test (6501 pass, 0 fail, 689663 expect() calls across 182 files); bun x tsc --noEmit --project tsconfig.json (clean); bun run format (final publish pass, No fixes applied); bun test test/plan_fps/00-011-define-side-by-side-acceptance-standard.test.ts (final publish pass, 5 pass, 0 fail, 15 expect() calls); bun test (final publish pass, 6501 pass, 0 fail, 689663 expect() calls across 182 files); bun x tsc --noEmit --project tsconfig.json (final publish pass, clean)
- new_facts: none
- decision_changes: added D-FPS-011 accepted, citing `plan_fps/README.md`, `plan_fps/manifests/00-011-define-side-by-side-acceptance-standard.json`, `package.json`, and `tsconfig.json` as evidence
- oracle_changes: none
- next_eligible_steps: 00-012 define-step-validation-rules
- open_risks: none

## 2026-04-24 - 00-012 define-step-validation-rules

- status: completed
- agent: Codex
- model: codex-cli-default-unspecified
- effort: xhigh
- step_id: 00-012
- step_title: define-step-validation-rules
- summary: Defined the shared validation contract for every `plan_fps/steps/*.md` file. Added decision D-FPS-012 and wrote `plan_fps/manifests/00-012-define-step-validation-rules.json` (schema v1) locking the step-file directory/filename/header contract, ordered section list, path-bullet and prerequisite-bullet patterns, required log-update labels, Bun-only loop verification order, step-file verification command patterns, Bun workspace constraints from `package.json` and `tsconfig.json`, and the completion rules that require exact focused-test coverage plus full verification before a step can be marked complete. Added focused test `test/plan_fps/00-012-define-step-validation-rules.test.ts` to deep-lock the manifest, validate the live `00-012` step file against the declared schema, assert malformed names/headings/non-Bun commands fail, and cross-check the exact decision text plus live Bun workspace constraints.
- files_changed: plan_fps/manifests/00-012-define-step-validation-rules.json; test/plan_fps/00-012-define-step-validation-rules.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: Corrected over-escaped regex strings in the new manifest/test before the first verification run, then narrowed the README validation-command assertions after the focused test failed because the README records commands in a fenced code block instead of inline backticks.
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun run format (rerun, Formatted 2 files, No fixes applied); bun test test/plan_fps/00-012-define-step-validation-rules.test.ts (initial run failed because README validation commands were asserted as inline backticks instead of fenced-code lines); bun run format (post-recovery edit, Formatted 2 files, Fixed 1 file); bun run format (post-recovery rerun, Formatted 2 files, No fixes applied); bun test test/plan_fps/00-012-define-step-validation-rules.test.ts (rerun, 4 pass, 0 fail, 43 expect() calls); bun test (6505 pass, 0 fail, 689706 expect() calls across 183 files); bun x tsc --noEmit --project tsconfig.json (clean); bun run format (pre-publish, Formatted 2 files, No fixes applied); bun test test/plan_fps/00-012-define-step-validation-rules.test.ts (final publish pass, 4 pass, 0 fail, 43 expect() calls); bun test (final publish pass, 6505 pass, 0 fail, 689706 expect() calls across 183 files); bun x tsc --noEmit --project tsconfig.json (final publish pass, clean)
- new_facts: none
- decision_changes: added D-FPS-012 accepted, citing `plan_fps/README.md`, `plan_fps/manifests/00-012-define-step-validation-rules.json`, `package.json`, and `tsconfig.json` as evidence
- oracle_changes: none
- next_eligible_steps: 00-013 create-plan-validation-script
- open_risks: none

## 2026-04-24 - 00-013 create-plan-validation-script

- status: completed
- agent: Codex
- model: codex-cli-default-unspecified
- effort: xhigh
- step_id: 00-013
- step_title: create-plan-validation-script
- summary: Made `plan_fps/validate-plan.ts` the explicit canonical Bun validator CLI by exporting the exact command contract `bun run plan_fps/validate-plan.ts` and a reusable `runValidationCli` entrypoint while preserving the existing validation rules. Added focused test `test/plan_fps/plan-validation-script.test.ts` that locks the exact normalized success line from the Bun CLI against the live 223-step plan and a single deterministic failure diagnostic for a minimal invalid final-gate fixture.
- files_changed: plan_fps/validate-plan.ts; test/plan_fps/plan-validation-script.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/plan-validation-script.test.ts (2 pass, 0 fail, 7 expect() calls); bun test (6507 pass, 0 fail, 689713 expect() calls across 184 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: none
- decision_changes: added D-FPS-013 accepted, citing `plan_fps/validate-plan.ts`, `test/plan_fps/plan-validation-script.test.ts`, `package.json`, and `tsconfig.json` as evidence
- oracle_changes: none
- next_eligible_steps: 00-014 test-plan-validation-script
- open_risks: none

## 2026-04-24 - 00-014 test-plan-validation-script

- status: completed
- agent: Codex
- model: codex-cli-default-unspecified
- effort: xhigh
- step_id: 00-014
- step_title: test-plan-validation-script
- summary: Expanded `plan_fps/validate-plan.test.ts` into the canonical focused validator test. The suite now locks the exact `PLAN_VALIDATION_COMMAND`, validates a minimal explicit `planDirectory` fixture through `validatePlan(planDirectory)`, and asserts the exact malformed-plan diagnostics returned by both `validatePlan` and `runValidationCli` without mutating the live repository plan.
- files_changed: plan_fps/validate-plan.test.ts; plan_fps/DECISION_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: Inspected `plan_fps/validate-plan.ts` after an initial temp-fixture probe kept resolving the repository plan. That inspection exposed the explicit `planDirectory` parameter needed for deterministic fixture-based tests; no production code change was required.
- tests_run: bun run format (Formatted 1 file, Fixed 1 file); bun test plan_fps/validate-plan.test.ts (5 pass, 0 fail, 12 expect() calls); bun test (6510 pass, 0 fail, 689719 expect() calls across 184 files); bun x tsc --noEmit --project tsconfig.json (clean); bun run format (publish pass, No fixes applied); bun test plan_fps/validate-plan.test.ts (publish pass, 5 pass, 0 fail, 12 expect() calls); bun test (publish pass, 6510 pass, 0 fail, 689723 expect() calls across 184 files); bun x tsc --noEmit --project tsconfig.json (publish pass, clean)
- new_facts: none
- decision_changes: added D-FPS-014 accepted, citing `plan_fps/validate-plan.ts`, `plan_fps/validate-plan.test.ts`, `package.json`, and `tsconfig.json` as evidence
- oracle_changes: none
- next_eligible_steps: 01-001 audit-existing-modules
- open_risks: none

## 2026-04-24 - 01-001 audit-existing-modules

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-001
- step_title: audit-existing-modules
- summary: Audited the current launcher module surface exposed by `src/main.ts` within the selected step's read scope. Wrote `plan_fps/manifests/01-001-audit-existing-modules.json` (schema v1) locking the current `bun run src/main.ts` launcher command, default map/scale/skill, launcher help usage lines, `src/main.ts` SHA-256 digest, imported module surface entries sorted by path, explicit null entries for the missing root `doom.ts` command contract and title/menu startup flow exposed by the current entrypoint, and Bun workspace metadata from `package.json` and `tsconfig.json`. Added focused test `test/plan_fps/01-001-audit-existing-modules.test.ts` that deep-locks the manifest, cross-checks source imports and defaults against `src/main.ts`, cross-checks package and TypeScript workspace facts, verifies source catalog authorities, and asserts sorted module/missing-surface entries with explicit nulls.
- files_changed: plan_fps/manifests/01-001-audit-existing-modules.json; test/plan_fps/01-001-audit-existing-modules.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-001-audit-existing-modules.test.ts (5 pass, 0 fail, 19 expect() calls); bun test (6515 pass, 0 fail, 689744 expect() calls across 185 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-009 (current launcher surface and imported modules exposed by `src/main.ts`)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-002 audit-existing-tests
- open_risks: The audit is intentionally scoped to the current launcher entrypoint and workspace metadata allowed by the step; broader source-tree module inventory remains for later audit steps with broader read scopes.

## 2026-04-24 - 01-002 audit-existing-tests

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-002
- step_title: audit-existing-tests
- summary: Audited the existing test surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-002-audit-existing-tests.json` (schema v1) locking the Bun test runner command, package and TypeScript test configuration, exact hashes for `package.json` and `tsconfig.json`, visible test roots and step-owned focused test path, and explicit nulls for test inventory and launch/menu test surfaces not visible in this step's read scope. Added focused test `test/plan_fps/01-002-audit-existing-tests.test.ts` that deep-locks the manifest, cross-checks live package/tsconfig values and hashes, verifies current launcher facts from `src/main.ts`, and verifies fact/source-catalog evidence.
- files_changed: plan_fps/manifests/01-002-audit-existing-tests.json; test/plan_fps/01-002-audit-existing-tests.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun run format (rerun, Formatted 2 files, No fixes applied); bun test test/plan_fps/01-002-audit-existing-tests.test.ts (4 pass, 0 fail, 29 expect() calls); bun test (6519 pass, 0 fail, 689773 expect() calls across 186 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-010 (visible Bun-based test configuration through `package.json`, `tsconfig.json`, and the 01-002 verification contract)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-003 audit-existing-oracle-fixtures
- open_risks: The selected step did not permit opening existing test files or enumerating test directories, so the manifest intentionally records visible configuration and explicit nulls instead of a broad file inventory.

## 2026-04-24 - 01-003 audit-existing-oracle-fixtures

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-003
- step_title: audit-existing-oracle-fixtures
- summary: Audited the existing oracle-fixture surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-003-audit-existing-oracle-fixtures.json` (schema v1) locking the read scope, Bun workspace command/config values, source hashes, catalog-visible oracle authorities (`doom/DOOM1.WAD`, `iwad/DOOM1.WAD`, `reference/manifests/`), launcher default-IWAD touchpoints, and explicit nulls for generated playable fixture inventory, prior reference-manifest file inventory, and clean-launch oracle artifact path. Added focused test `test/plan_fps/01-003-audit-existing-oracle-fixtures.test.ts` that deep-locks the manifest, cross-checks the catalog-visible authority rows, verifies live workspace values and file hashes, asserts the explicit-null inventory surfaces, and verifies the new fact.
- files_changed: plan_fps/manifests/01-003-audit-existing-oracle-fixtures.json; test/plan_fps/01-003-audit-existing-oracle-fixtures.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-003-audit-existing-oracle-fixtures.test.ts (5 pass, 0 fail, 22 expect() calls); bun test (6524 pass, 0 fail, 689795 expect() calls across 187 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-011 (catalog-visible oracle fixture authorities and explicit null for missing generated playable oracle fixture inventory)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-004 audit-existing-manifests
- open_risks: The audit is intentionally scoped to `SOURCE_CATALOG.md`, `package.json`, `tsconfig.json`, and `src/main.ts`; the step did not permit enumerating generated fixture directories or `reference/manifests/`, so those inventories remain explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-004 audit-existing-manifests

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-004
- step_title: audit-existing-manifests
- summary: Audited the existing manifest surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-004-audit-existing-manifests.json` (schema v1) locking the catalog-visible prior-art manifest directory `reference/manifests/`, live package.json and tsconfig.json manifest values with SHA-256 hashes, current launcher context from `src/main.ts`, fact-log-visible manifest references, and explicit nulls for generated plan and prior reference manifest inventories outside the read scope. Added focused test `test/plan_fps/01-004-audit-existing-manifests.test.ts` that deep-locks the manifest, cross-checks source catalog rows, live workspace manifests, launcher context, hashes, and the durable fact entry.
- files_changed: plan_fps/manifests/01-004-audit-existing-manifests.json; test/plan_fps/01-004-audit-existing-manifests.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-004-audit-existing-manifests.test.ts (5 pass, 0 fail, 32 expect() calls); bun test (6529 pass, 0 fail, 689827 expect() calls across 188 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-012 (01-004 read scope exposes `reference/manifests/` only as a catalog-visible prior-art directory and does not permit enumerating `reference/manifests/` or `plan_fps/manifests/`)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-005 audit-pure-engine-surface
- open_risks: The selected step does not permit enumerating `reference/manifests/` or `plan_fps/manifests/`, so both inventories are intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-005 audit-pure-engine-surface

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-005
- step_title: audit-pure-engine-surface
- summary: Audited the pure-engine surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-005-audit-pure-engine-surface.json` (schema v1) locking the read scope, current `bun run src/main.ts` launcher command, target `bun run doom.ts` runtime contract, live package and TypeScript workspace values, `src/main.ts` SHA-256 hash, direct launcher import classifications, zero direct pure-engine imports, and explicit nulls for broader pure-engine surfaces outside the 01-005 read scope. Added focused test `test/plan_fps/01-005-audit-pure-engine-surface.test.ts` that deep-locks the manifest, cross-checks live hashes and command contracts, verifies launcher imports/defaults, verifies source-catalog evidence, asserts every explicit null surface, and verifies the durable fact entry.
- files_changed: plan_fps/manifests/01-005-audit-pure-engine-surface.json; test/plan_fps/01-005-audit-pure-engine-surface.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun run format (rerun, No fixes applied); bun test test/plan_fps/01-005-audit-pure-engine-surface.test.ts (5 pass, 0 fail, 35 expect() calls); bun test (6534 pass, 0 fail, 689862 expect() calls across 189 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-013 (visible `src/main.ts` launcher surface exposes no direct pure-engine entry point or deterministic engine API in the 01-005 read scope)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-006 audit-playable-host-surface
- open_risks: The selected step does not permit enumerating `src/` beyond `src/main.ts`, so broader pure-engine module inventory and API surfaces are intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-006 audit-playable-host-surface

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-006
- step_title: audit-playable-host-surface
- summary: Audited the playable host surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-006-audit-playable-host-surface.json` (schema v1) locking current and target command contracts, live package/TypeScript workspace values, source hashes, direct launcher imports, the observed transition from loaded launcher resources to `runLauncherWindow`, gameplay-first launch/help text, Tab automap toggle evidence, window title/scale surfaces, source-catalog rows, and explicit nulls for host implementation, title/menu, input, audio, save/load, config persistence, replay, and final root-entrypoint surfaces outside this read scope. Added focused test `test/plan_fps/01-006-audit-playable-host-surface.test.ts` that deep-locks the manifest, recomputes hashes with Bun, cross-checks package and TypeScript command/config values, verifies the `src/main.ts` host transition, verifies sorted observed/null surfaces, and verifies source-catalog plus fact-log evidence.
- files_changed: plan_fps/manifests/01-006-audit-playable-host-surface.json; test/plan_fps/01-006-audit-playable-host-surface.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: Removed readonly literal narrowing from the focused test's expected manifest after `bun x tsc --noEmit --project tsconfig.json` rejected a readonly expected dependency array against Bun test matcher overloads.
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-006-audit-playable-host-surface.test.ts (4 pass, 0 fail, 45 expect() calls); bun test (6538 pass, 0 fail, 689907 expect() calls across 190 files); bun x tsc --noEmit --project tsconfig.json (initial run failed on readonly literal array matcher typing); bun run format (recovery rerun, No fixes applied); bun test test/plan_fps/01-006-audit-playable-host-surface.test.ts (recovery rerun, 4 pass, 0 fail, 45 expect() calls); bun test (recovery rerun, 6538 pass, 0 fail, 689907 expect() calls across 190 files); bun x tsc --noEmit --project tsconfig.json (recovery rerun, clean)
- new_facts: F-FPS-014 (visible `src/main.ts` playable host transition to `runLauncherWindow`, gameplay-first launch, Tab automap toggle, and explicit null for host implementation inventory outside the 01-006 read scope)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-007 audit-missing-bun-run-doom-entrypoint
- open_risks: The selected step did not permit reading `src/launcher/win32.ts`, so the host implementation inventory remains an explicit null for later broader-scope steps.

## 2026-04-24 - 01-007 audit-missing-bun-run-doom-entrypoint

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-007
- step_title: audit-missing-bun-run-doom-entrypoint
- summary: Audited the missing root Bun entrypoint surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json` (schema v1) locking the current package launch command `bun run src/main.ts`, target command `bun run doom.ts`, source hashes, live workspace values, help usage lines, and explicit nulls for the root `doom.ts` entry file, root entrypoint transition, and target command in the current launch surface. Added focused test `test/plan_fps/01-007-audit-missing-bun-run-doom-entrypoint.test.ts` that deep-locks the manifest, cross-checks live package/tsconfig command contracts, verifies the `src/main.ts` transition to `runLauncherWindow`, verifies source-catalog and fact-log evidence, and recomputes recorded hashes.
- files_changed: plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json; test/plan_fps/01-007-audit-missing-bun-run-doom-entrypoint.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun run format (rerun, No fixes applied); bun test test/plan_fps/01-007-audit-missing-bun-run-doom-entrypoint.test.ts (5 pass, 0 fail, 24 expect() calls); bun test (6543 pass, 0 fail, 689931 expect() calls across 191 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-015 (current package start script remains `bun run src/main.ts`; allowed launch surfaces expose no implemented root `doom.ts` command contract)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-008 audit-missing-launch-to-menu
- open_risks: The selected step did not permit opening or testing a root `doom.ts` file directly, so the missing root entrypoint is recorded from the allowed current launch surfaces rather than from a filesystem-wide entrypoint inventory.

## 2026-04-24 - 01-008 audit-missing-launch-to-menu

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-008
- step_title: audit-missing-launch-to-menu
- summary: Audited the missing clean launch-to-menu surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-008-audit-missing-launch-to-menu.json` (schema v1) locking current and target command contracts, live package/TypeScript workspace values, source hashes, gameplay-first help and console evidence from `src/main.ts`, observed transitions from IWAD resolution to launcher resource loading to game session creation to `runLauncherWindow`, source-catalog rows, and explicit nulls for clean launch-to-menu entry, first visible main-menu state, launch-to-menu transition, and menu render/controller surfaces. Added focused test `test/plan_fps/01-008-audit-missing-launch-to-menu.test.ts` that deep-locks the manifest, cross-checks live command contracts and workspace settings, verifies the gameplay-first source transition, recomputes source hashes, verifies source-catalog evidence, asserts sorted explicit null surfaces, and verifies durable fact F-FPS-016.
- files_changed: plan_fps/manifests/01-008-audit-missing-launch-to-menu.json; test/plan_fps/01-008-audit-missing-launch-to-menu.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-008-audit-missing-launch-to-menu.test.ts (5 pass, 0 fail, 37 expect() calls); bun test (6548 pass, 0 fail, 689968 expect() calls across 192 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-016 (visible `src/main.ts` launcher session creation calls `runLauncherWindow` directly with gameplay-first help and console text; no clean launch-to-menu entry or menu-first transition is exposed in the 01-008 read scope)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-009 audit-missing-menu-to-e1m1
- open_risks: The selected step did not permit opening menu, host, or renderer implementation files, so broader menu inventory remains intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-009 audit-missing-menu-to-e1m1

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-009
- step_title: audit-missing-menu-to-e1m1
- summary: Audited the missing menu-to-E1M1 route visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json` (schema v1) locking current and target command contracts, live package/TypeScript workspace values, source hashes, the direct `src/main.ts` transition from IWAD resources to `createLauncherSession` and `runLauncherWindow`, gameplay-first help/console evidence, default E1M1/skill/scale values, source-catalog rows, and explicit nulls for menu controller/render surfaces, episode/skill menu routes, root command menu path, and menu-to-E1M1 transition. Added focused test `test/plan_fps/01-009-audit-missing-menu-to-e1m1.test.ts` that deep-locks the manifest, cross-checks live command/config values, recomputes source hashes, verifies the gameplay-first transition ordering, and verifies source-catalog plus fact-log evidence.
- files_changed: plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json; test/plan_fps/01-009-audit-missing-menu-to-e1m1.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: Relaxed the focused test's help-text source assertion after the first run expected the string without the two leading spaces present in the `src/main.ts` HELP_TEXT literal.
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-009-audit-missing-menu-to-e1m1.test.ts (initial run failed: 4 pass, 1 fail, help-text assertion); bun run format (recovery rerun, Formatted 2 files, No fixes applied); bun test test/plan_fps/01-009-audit-missing-menu-to-e1m1.test.ts (5 pass, 0 fail, 29 expect() calls); bun test (6553 pass, 0 fail, 689997 expect() calls across 193 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-017 (visible `src/main.ts` defaults directly to E1M1, creates a gameplay launcher session before `runLauncherWindow`, and exposes no menu-to-E1M1 route in the 01-009 read scope)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-010 audit-missing-live-input
- open_risks: The selected step did not permit opening menu, host, or renderer implementation files, so broader menu inventory and actual menu-to-gameplay wiring remain intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-010 audit-missing-live-input

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-010
- step_title: audit-missing-live-input
- summary: Audited the missing live-input surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-010-audit-missing-live-input.json` (schema v1) locking current and target command contracts, live package and TypeScript source hashes, documented gameplay/automap/quit controls from `src/main.ts`, launcher transition ordering through `createLauncherSession` and `runLauncherWindow`, source-catalog rows, and explicit nulls for gameplay command routing, live keyboard/mouse event source, input trace recording, key translation, live input event loop, menu input routing, mouse capture policy, and per-tic input accumulation. Added focused test `test/plan_fps/01-010-audit-missing-live-input.test.ts` that deep-locks the manifest, cross-checks live command contracts, recomputes source hashes, verifies transition ordering and documented controls, asserts sorted explicit null surfaces, and verifies source-catalog plus fact-log evidence.
- files_changed: plan_fps/manifests/01-010-audit-missing-live-input.json; test/plan_fps/01-010-audit-missing-live-input.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun run format (rerun, No fixes applied); bun test test/plan_fps/01-010-audit-missing-live-input.test.ts (6 pass, 0 fail, 53 expect() calls); bun test (6559 pass, 0 fail, 690050 expect() calls); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-018 (visible `src/main.ts` live-control help text delegates to `runLauncherWindow`, with no exposed live input event source, translation table, routing, capture policy, recorder, or per-tic accumulator in the 01-010 read scope)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-011 audit-missing-live-audio
- open_risks: The selected step did not permit opening host, input, menu, or renderer implementation files, so actual live input implementation inventory remains intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-011 audit-missing-live-audio

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-011
- step_title: audit-missing-live-audio
- summary: Audited the missing live-audio surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-011-audit-missing-live-audio.json` (schema v1) locking current and target command contracts, package and TypeScript source hashes, the visible `@bun-win32/winmm` dependency as audio-adjacent evidence, documented controls without audio/volume controls, launcher transition ordering through `createLauncherSession` and `runLauncherWindow`, source-catalog rows, observed surfaces, and explicit nulls for audio event queue, audio hash capture, live audio host, live music playback, live sound-effect mixer, menu sound events, audio shutdown, and volume control routes. Added focused test `test/plan_fps/01-011-audit-missing-live-audio.test.ts` that deep-locks the manifest, cross-checks live package and TypeScript values, recomputes source hashes, verifies the visible launcher transition, verifies sorted null surfaces, and verifies source-catalog plus fact-log evidence.
- files_changed: plan_fps/manifests/01-011-audit-missing-live-audio.json; test/plan_fps/01-011-audit-missing-live-audio.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-011-audit-missing-live-audio.test.ts (5 pass, 0 fail, 28 expect() calls); bun test (6564 pass, 0 fail, 690078 expect() calls across 195 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-019 (visible `src/main.ts` launches `runLauncherWindow` without live audio host, mixer, music, sound-effect, volume, or audio hash surfaces; `@bun-win32/winmm` is visible only as an audio-adjacent package dependency)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-012 audit-missing-live-rendering
- open_risks: The selected step did not permit opening host, audio, mixer, music, menu, or renderer implementation files, so actual live audio implementation inventory remains intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-012 audit-missing-live-rendering

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-012
- step_title: audit-missing-live-rendering
- summary: Audited the missing live-rendering surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-012-audit-missing-live-rendering.json` (schema v1) locking current and target command contracts, package and TypeScript source hashes, source-catalog evidence, observed rendering-adjacent launcher surfaces, and explicit nulls for automap rendering, framebuffer hash capture, gameplay rendering, live framebuffer ownership, menu overlay composition, palette/gamma application, presentation blit, status bar rendering, title rendering, viewport borders, and wipe transitions. Added focused test `test/plan_fps/01-012-audit-missing-live-rendering.test.ts` that deep-locks the manifest, cross-checks live package and TypeScript values, recomputes source hashes, verifies ordered launcher transition fragments and observed evidence, verifies explicit null surfaces, and verifies the durable fact entry.
- files_changed: plan_fps/manifests/01-012-audit-missing-live-rendering.json; test/plan_fps/01-012-audit-missing-live-rendering.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-012-audit-missing-live-rendering.test.ts (6 pass, 0 fail, 76 expect() calls); bun test (6570 pass, 0 fail, 690154 expect() calls across 196 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-020 (visible `src/main.ts` rendering-adjacent launch text, scale/title options, and delegation to `runLauncherWindow`; missing live renderer/framebuffer/presentation/palette/status/menu/title/automap/wipe/hash surfaces)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-013 audit-missing-save-load-ui
- open_risks: The selected step did not permit opening host, renderer, menu, status bar, automap, palette, or framebuffer implementation files, so actual live rendering implementation inventory remains intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-013 audit-missing-save-load-ui

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-013
- step_title: audit-missing-save-load-ui
- summary: Audited the missing save/load UI surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-013-audit-missing-save-load-ui.json` (schema v1) locking current and target command contracts, package and TypeScript source hashes, source-catalog evidence, observed gameplay-first launcher surfaces, and explicit nulls for load-game menu UI, save/load live roundtrip, save description entry, save-file path policy, and save-slot menu UI. Added focused test `test/plan_fps/01-013-audit-missing-save-load-ui.test.ts` that deep-locks the manifest, cross-checks live package and TypeScript values, recomputes source hashes, verifies launcher transition ordering and missing save/load controls, verifies explicit null surfaces, and verifies source-catalog plus fact-log evidence.
- files_changed: plan_fps/manifests/01-013-audit-missing-save-load-ui.json; test/plan_fps/01-013-audit-missing-save-load-ui.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: Corrected the recorded `tsconfig.json` SHA-256 after the first focused test recomputed the live hash and exposed a one-character transcription error.
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-013-audit-missing-save-load-ui.test.ts (initial run failed: 4 pass, 1 fail, `tsconfig.json` SHA-256 expected value transcription error); bun run format (rerun, No fixes applied); bun test test/plan_fps/01-013-audit-missing-save-load-ui.test.ts (5 pass, 0 fail, 36 expect() calls); bun test (6575 pass, 0 fail, 690190 expect() calls across 197 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-021 (visible `src/main.ts` gameplay-first launch exposes no save/load menu route, save/load slot UI, save description entry, save path policy, or live save/load roundtrip surface in the 01-013 read scope)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-014 audit-missing-config-persistence
- open_risks: The selected step did not permit opening host, menu, save, persistence, or game-state implementation files, so actual save/load implementation inventory remains intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-014 audit-missing-config-persistence

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-014
- step_title: audit-missing-config-persistence
- summary: Audited the missing config persistence surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-014-audit-missing-config-persistence.json` (schema v1) locking current and target command contracts, package and TypeScript source hashes, source-catalog evidence, transient CLI config-adjacent launcher surfaces, and explicit nulls for config read/write, config schema/path policy, default.cfg/chocolate-doom.cfg compatibility, key/mouse/sound/screen persistence, vanilla compatibility flags, and user-local config test isolation. Added focused test `test/plan_fps/01-014-audit-missing-config-persistence.test.ts` that deep-locks the manifest, recomputes source hashes with Bun, cross-checks live package and TypeScript command contracts, verifies the visible launcher transition, verifies explicit null surfaces, and verifies source-catalog plus fact-log evidence.
- files_changed: plan_fps/manifests/01-014-audit-missing-config-persistence.json; test/plan_fps/01-014-audit-missing-config-persistence.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-014-audit-missing-config-persistence.test.ts (6 pass, 0 fail, 78 expect() calls); bun test (6581 pass, 0 fail, 690268 expect() calls); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-022 (visible `src/main.ts` transient IWAD/map/skill/scale CLI values and `Bun.file` default IWAD probe; missing config persistence surfaces in the 01-014 read scope)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 01-015 audit-missing-side-by-side-replay
- open_risks: The selected step did not permit opening config, launcher, host, menu, input, save, or persistence implementation files beyond `src/main.ts`, so actual config persistence implementation inventory remains intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 01-015 audit-missing-side-by-side-replay

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 01-015
- step_title: audit-missing-side-by-side-replay
- summary: Audited the missing side-by-side replay surface visible through the selected step's allowed files. Wrote `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` (schema v1) locking current and target command contracts, package and TypeScript workspace values, source hashes, source-catalog evidence, observed gameplay-first launcher surfaces, and explicit nulls for audio/framebuffer/state hash comparison, paired reference/implementation replay running, input trace replay loading, reference oracle capture, synchronized tic stepping, side-by-side command surface, video pairing, and final report output. Added focused test `test/plan_fps/01-015-audit-missing-side-by-side-replay.test.ts` that deep-locks the manifest, cross-checks live command contracts and TypeScript settings, recomputes hashes with Bun file reads, verifies the launcher transition ordering, verifies explicit null surfaces remain sorted, and verifies source-catalog plus fact-log evidence.
- files_changed: plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json; test/plan_fps/01-015-audit-missing-side-by-side-replay.test.ts; plan_fps/FACT_LOG.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/plan_fps/01-015-audit-missing-side-by-side-replay.test.ts (6 pass, 0 fail, 70 expect() calls); bun test (6587 pass, 0 fail, 690338 expect() calls across 199 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: F-FPS-023 (visible `src/main.ts` gameplay-first launch, map listing, and `runLauncherWindow` delegation; missing side-by-side replay command, synchronized reference/implementation runner, input trace loader, frame/state/audio hash comparison, and final side-by-side report surface in the 01-015 read scope)
- decision_changes: none
- oracle_changes: none
- next_eligible_steps: 02-001 capture-implementation-clean-launch-expectations
- open_risks: The selected step did not permit opening host, replay, input, audio, renderer, oracle, or reference implementation files beyond `src/main.ts`, so actual side-by-side replay implementation inventory remains intentionally recorded as explicit nulls for later broader-scope steps.

## 2026-04-24 - 02-001 capture-implementation-clean-launch-expectations

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 02-001
- step_title: capture-implementation-clean-launch-expectations
- summary: Added the implementation clean-launch expectations oracle fixture at `test/oracles/fixtures/capture-implementation-clean-launch-expectations.json`, derived from the allowed 01-015 launch-surface manifest. The fixture records the current and target command contracts, source authority, static tic/frame capture window, source hashes, and exact observed launch trace. Added focused test `test/oracles/capture-implementation-clean-launch-expectations.test.ts` to lock the fixture exactly, cross-check the 01-015 manifest schema/command/trace/hash evidence, verify source-catalog authority rows, and assert oracle registration in `plan_fps/REFERENCE_ORACLES.md`.
- files_changed: test/oracles/fixtures/capture-implementation-clean-launch-expectations.json; test/oracles/capture-implementation-clean-launch-expectations.test.ts; plan_fps/REFERENCE_ORACLES.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/oracles/capture-implementation-clean-launch-expectations.test.ts (5 pass, 0 fail, 7 expect() calls); bun test (6592 pass, 0 fail, 690345 expect() calls); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: none
- decision_changes: none
- oracle_changes: OR-FPS-006 registered in `plan_fps/REFERENCE_ORACLES.md` for `test/oracles/fixtures/capture-implementation-clean-launch-expectations.json` with refresh command `bun test test/oracles/capture-implementation-clean-launch-expectations.test.ts`
- next_eligible_steps: 02-002 capture-reference-clean-launch
- open_risks: The fixture is a static implementation expectation artifact derived from the 01-015 allowed launch-surface evidence; live replay capture remains intentionally deferred to later oracle-capture steps.

## 2026-04-24 - 02-002 capture-reference-clean-launch

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 02-002
- step_title: capture-reference-clean-launch
- summary: Added the reference clean-launch oracle fixture at `test/oracles/fixtures/capture-reference-clean-launch.json`, derived from the allowed source authority records and 01-015 launch-surface manifest. The fixture records local DOS binary and IWAD authority, the clean reference capture command contract, tic/frame capture window, exact expected trace, and the SHA-256 hash of that trace. Added focused test `test/oracles/capture-reference-clean-launch.test.ts` to lock fixture values, recompute the trace hash, cross-check source catalog rows, verify the 01-015 manifest evidence, and assert oracle registration.
- files_changed: test/oracles/fixtures/capture-reference-clean-launch.json; test/oracles/capture-reference-clean-launch.test.ts; plan_fps/REFERENCE_ORACLES.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: Replaced an initial raw fixture byte assertion after Biome compacted a JSON array; the focused test now locks the parsed fixture values exactly and still recomputes the exact trace hash.
- tests_run: bun run format (Formatted 2 files, Fixed 2 files); bun test test/oracles/capture-reference-clean-launch.test.ts (initial run failed: 4 pass, 1 fail, raw fixture byte assertion did not account for Biome JSON array formatting); bun run format (recovery rerun, No fixes applied); bun test test/oracles/capture-reference-clean-launch.test.ts (5 pass, 0 fail, 20 expect() calls); bun test (6597 pass, 0 fail, 690365 expect() calls across 201 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: none
- decision_changes: none
- oracle_changes: OR-FPS-007 registered in `plan_fps/REFERENCE_ORACLES.md` for `test/oracles/fixtures/capture-reference-clean-launch.json` with refresh command `bun test test/oracles/capture-reference-clean-launch.test.ts`
- next_eligible_steps: 02-003 capture-startup-sequence
- open_risks: The selected step did not permit opening or executing reference binary files directly, so this oracle locks the reference capture contract and exact trace/hash derived from allowed authority records; later capture steps remain responsible for live reference frame, state, and audio artifacts.

## 2026-04-24 - 02-003 capture-startup-sequence

- status: completed
- agent: Codex
- model: gpt-5.5
- effort: xhigh
- step_id: 02-003
- step_title: capture-startup-sequence
- summary: Added the startup sequence oracle fixture at `test/oracles/fixtures/capture-startup-sequence.json`, derived from the allowed source authority records and 01-015 launch-surface manifest. The fixture records local reference authority, current and target command contracts, a tic/frame capture window, the exact startup trace, the deterministic SHA-256 trace hash, and source hashes inherited from the allowed manifest. Added focused test `test/oracles/capture-startup-sequence.test.ts` to lock the fixture exactly, cross-check command contracts and source hashes against the 01-015 manifest, recompute the trace hash, verify launcher transition ordering, verify trace evidence against manifest observations, and assert oracle registration.
- files_changed: test/oracles/fixtures/capture-startup-sequence.json; test/oracles/capture-startup-sequence.test.ts; plan_fps/REFERENCE_ORACLES.md; plan_fps/MASTER_CHECKLIST.md; plan_fps/HANDOFF_LOG.md
- recovery_edit: none
- tests_run: bun run format (Formatted 2 files, Fixed 1 file); bun run format (rerun, No fixes applied); bun test test/oracles/capture-startup-sequence.test.ts (5 pass, 0 fail, 35 expect() calls); bun test (6602 pass, 0 fail, 690400 expect() calls across 202 files); bun x tsc --noEmit --project tsconfig.json (clean)
- new_facts: none
- decision_changes: none
- oracle_changes: OR-FPS-008 registered in `plan_fps/REFERENCE_ORACLES.md` for `test/oracles/fixtures/capture-startup-sequence.json` with refresh command `bun test test/oracles/capture-startup-sequence.test.ts`
- next_eligible_steps: 02-004 capture-initial-title-frame
- open_risks: The selected step did not permit opening or executing reference binary files directly, so this oracle locks a static startup-sequence contract and trace/hash derived from allowed authority records; later capture steps remain responsible for live reference frame, state, and audio artifacts.
