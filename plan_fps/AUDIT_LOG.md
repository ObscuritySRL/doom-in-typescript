# Audit Log

Append-only record of completed-step audits. Each audited step gets one entry per auditing agent.

The Ralph-loop audit prompt and audit-only launchers use this file to decide which completed steps remain eligible for each agent. An entry by `Codex` makes that step ineligible for future Codex audits, but it does not make the step ineligible for `Claude Code`. An entry by `Claude Code` works the same way in the opposite direction.

Required entry shape:

```md
## <UTC timestamp> - <step_id> <step_title> - <agent>

- status: completed|blocked
- agent: Codex|Claude Code
- model: <model>
- effort: <effort>
- step_id: <step_id>
- step_title: <step_title>
- prior_audits: <agent/status/finding summary or none>
- correctness_findings: <summary or none>
- performance_findings: <summary or none>
- improvement_findings: <summary or none>
- corrective_action: <summary or none>
- files_changed: <semicolon-separated paths or none>
- tests_run: <semicolon-separated commands or none>
- follow_up: <summary or none>
```

## 2026-04-25T19:34:10Z - 03-005 wire-bun-native-process-oracle-helpers - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 03-005
- step_title: wire-bun-native-process-oracle-helpers
- prior_audits: none
- correctness_findings: Implementation satisfies Expected Changes; type contract pins Bun.spawn provider, forbidden providers, capture streams, and deterministic-replay boundary; focused test locks the contract, derives the target command from program/subcommand/entryFile parts, cross-checks the 01-007 audit manifest from disk, and locks the package script and src/main.ts launcher evidence.
- performance_findings: none (pure declarative data contract; no hot paths).
- improvement_findings: Production const used `satisfies WireBunNativeProcessOracleHelpers` while every sibling in src/playable/bun-runtime-entry-point/ uses `as const satisfies` — without `as const`, literal/tuple types in array fields (captureStreams, forbiddenProviders, helpUsageLines) widened to `string[]` for downstream consumers; the test's expected literal correspondingly used only `satisfies` and would have masked future drift in the narrow contract types.
- corrective_action: Added `as const` to the production declaration so the inferred const value preserves readonly tuple/literal types consumers see; aligned the test fixture with `as const satisfies WireBunNativeProcessOracleHelpers` so `expect(...).toEqual(expected)` keeps strict literal-type matching against the now-narrower production value. No contract field values changed.
- files_changed: src/playable/bun-runtime-entry-point/wireBunNativeProcessOracleHelpers.ts; test/playable/bun-runtime-entry-point/wire-bun-native-process-oracle-helpers.test.ts
- tests_run: bun test test/playable/bun-runtime-entry-point/wire-bun-native-process-oracle-helpers.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T19:34:10Z - 01-009 audit-missing-menu-to-e1m1 - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 01-009
- step_title: audit-missing-menu-to-e1m1
- prior_audits: none
- correctness_findings: Manifest at plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json fully satisfies Expected Changes — alphabetically sorted top-level keys, sorted observedSurfaces and explicitNullSurfaces by surfaceId, sorted sourceCatalogEvidence by id, and ordinal-continuous transitions chain (Bun.argv → CommandLine → IWAD path resolution → launcher resources → gameplay session → gameplay window) where each successive `from` matches the previous `to`. Pinned SHA-256 hashes for package.json, src/main.ts, and tsconfig.json all verify against the live files (recomputed via Bun.CryptoHasher: 9075b8e3…, 019ea4be…, 49105a2f…). Focused test enforces full manifest deep-equality, live package/tsconfig key parity, three-file SHA-256 drift guard, indexOf-ordered gameplay-first source markers (sessionIndex < windowIndex), and source catalog plus FACT_LOG presence; no nullable, off-by-one, or wrap-around boundary exists in this declarative audit data.
- performance_findings: none (manifest is static JSON; tests read each file once at test time).
- improvement_findings: none — manifest is sorted, transitions ordinals form an unbroken 1→5 chain with consistent from/to wiring, all explicit null surfaces correctly carry expectedPath: null with reason text, and the test already locks exact values (full-manifest toEqual, ordered indexOf, SHA-256 drift) rather than only existence.
- corrective_action: none — no fixes required.
- files_changed: none
- tests_run: bun test test/plan_fps/01-009-audit-missing-menu-to-e1m1.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T19:40:16Z - 03-013 implement-fatal-error-handling - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 03-013
- step_title: implement-fatal-error-handling
- prior_audits: none (no prior AUDIT_LOG entry; HANDOFF_LOG records Codex completion of the original implementation only)
- correctness_findings: extractFatalErrorMessage in src/playable/bun-runtime-entry-point/implementFatalErrorHandling.ts called fatalError.message.trim() unconditionally inside the `instanceof Error` branch. Empirically reproduced — `Object.create(Error.prototype)` and a real `new Error()` whose `.message` was redefined to `undefined` both pass `instanceof Error` while `typeof .message === 'undefined'`, and `.trim()` then threw `TypeError: undefined is not an object (evaluating 'fatalError.message.trim')`. That defect lived inside the *fatal error handler itself*, where a thrown error has nowhere to be caught (the launcher's outer `void main().catch` would already be servicing the original fatal). Implementation otherwise satisfies Expected Changes: contract object is `as const`, runtime command guard rejects non-`bun run doom.ts` callers with the literal expected message, deterministic-replay flags are all false at phase `pre-session-launch`, and the focused test still pins the contract SHA-256 (3148335646ca0fc8e21171fb4e4ee389716b96265748769f7c94aac5b1f745da, recomputed live via Bun.CryptoHasher) and cross-checks the 01-007 audit manifest, package.json `start` script, and `src/main.ts` HELP_TEXT plus catch/stderr/exit fatal path.
- performance_findings: none — fatal handler runs at most once per process exit; no hot-path allocations or per-frame work involved.
- improvement_findings: focused test exercised only `Error` with valid message, `Error` with whitespace-only message, and the non-Bun command rejection path. The plain-`string` branch of extractFatalErrorMessage and the unknown-fallback path for null, undefined, plain objects, arrays, numbers, booleans, and Errors with non-string messages were not directly tested, masking the undefined-message crash and leaving four other branches drift-unprotected.
- corrective_action: Hardened extractFatalErrorMessage with a `typeof fatalError.message === 'string'` guard so a non-string `.message` falls through to the next branch instead of throwing. Contract object value (and therefore its pinned SHA-256) is unchanged. Added three regression tests covering the trimmed plain-string path, a parameterized fallback sweep across `''`, `'   '`, `null`, `undefined`, `0`, `42`, `true`, `false`, `{}`, `[]`, and two Errors whose `.message` was redefined to `undefined`/`42`, and a result-identity test asserting the result reuses the contract's auditedCurrentLauncherSurface and deterministicReplayCompatibility references and pins the literal status/exitCode/outputStream/runtimeCommand fields. Test count grew from 6 (17 expects) to 9 (36 expects).
- files_changed: src/playable/bun-runtime-entry-point/implementFatalErrorHandling.ts; test/playable/bun-runtime-entry-point/implement-fatal-error-handling.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/playable/bun-runtime-entry-point/implement-fatal-error-handling.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T19:48:10Z - 02-015 capture-sound-volume-menu-path - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 02-015
- step_title: capture-sound-volume-menu-path
- prior_audits: none
- correctness_findings: Fixture at test/oracles/fixtures/capture-sound-volume-menu-path.json fully satisfies Expected Changes — captureCommand pins program/arguments/runner/targetPlayableCommand, captureWindow records monotonic startTick=0/endTick=10 with checkpointTicks==checkpointFrames, expectedHashes.traceSha256 (8f01956219a468482870e172933dd21339b4574ce2bc720312977bb749db4d70) recomputes exactly via Bun.CryptoHasher over JSON.stringify(expectedTrace), inputSequence covers ticks 1–9 keystroke-by-keystroke into the sound-volume submenu, sourceAuthority cites local-primary-binary S-FPS-005 doom/DOOMD.EXE, primaryData S-FPS-006 doom/DOOM1.WAD, secondaryData S-FPS-007 iwad/DOOM1.WAD, and inherited sourceHashes for package.json (9075b8e3…/569 B), src/main.ts (019ea4be…/3239 B), tsconfig.json (49105a2f…/645 B) all reverify against the live filesystem. Oracle is registered as OR-FPS-020 in plan_fps/REFERENCE_ORACLES.md with the matching refresh command. No nullable/empty/wrap-around boundary exists on this declarative fixture.
- performance_findings: Test's hashTrace helper used the WebCrypto crypto.subtle.digest pipeline plus a manual byte→hex conversion, while the sibling 02-031 oracle test already uses Bun.CryptoHasher; the WebCrypto path is asynchronous, allocates a fresh TextEncoder + Uint8Array per call, and is slower than the native Bun hasher. Minor — only invoked once per test — but inconsistent with the surrounding convention.
- improvement_findings: (1) Second test ('locks the deterministic trace hash and sound volume transition') asserted the trace hash and the sound-volume submenu transition entries against the local `as const expectedTrace` constant rather than the actual fixture file, so the literal-object cross-checks at indices 8 and 9 only verified the test's local data against another copy of itself and locked nothing about the fixture's sound-volume transition; (2) parseJson(text) helper wrapped JSON.parse(text) where Bun.file().json() is the one-call convention used by sibling tests; (3) hashTrace was inconsistent with sibling 02-031 hashing convention (Bun.CryptoHasher).
- corrective_action: Replaced WebCrypto-based hashTrace with the native Bun.CryptoHasher (sync, no TextEncoder allocation), aligning with 02-031 sibling. Rewrote the 'sound volume transition' test so it reads the live fixture via Bun.file(fixturePath).json(), guards shape with isRecord and Array.isArray plus a typeof traceSha256 string check, and asserts the trace hash and the sound-volume entry/sub-menu transitions against fixture.expectedTrace[8]/[9] — these assertions now actually protect the fixture file rather than re-comparing a local constant to itself. Replaced the parseJson helper at the manifest cross-check call site with Bun.file().json() and removed the now-unused parseJson helper. Fixture content and all pinned hashes are unchanged; trace SHA-256 still verifies against the recomputation.
- files_changed: test/oracles/capture-sound-volume-menu-path.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/oracles/capture-sound-volume-menu-path.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T19:48:10Z - 01-007 audit-missing-bun-run-doom-entrypoint - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 01-007
- step_title: audit-missing-bun-run-doom-entrypoint
- prior_audits: none
- correctness_findings: Manifest at plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json fully satisfies Expected Changes — auditFindings list both observed (current-launch-command-uses-src-main with package.json:scripts.start and src/main.ts:HELP_TEXT evidence) and missing (root-doom-ts-command-contract-not-implemented-in-current-launcher-surface) entries, currentEntrypoint pins script name 'start' to command 'bun run src/main.ts' with the two stripped helpUsageLines, explicitNulls record three required surfaces (root-entry-file, root-entrypoint-transition, target-command-in-current-launch-surface) each with observedPath: null and a reason string, evidencePaths and readScope are sorted and identical, sourceHashes algorithm is SHA-256 with files for package.json, plan_fps/SOURCE_CATALOG.md, src/main.ts, tsconfig.json. All four pinned hashes recompute exactly against the live filesystem via Bun.CryptoHasher (package.json 9075b8e3…/569 B, plan_fps/SOURCE_CATALOG.md 7c8de73f…/1852 B, src/main.ts 019ea4be…/3239 B, tsconfig.json 49105a2f…/645 B). Test enforces full deep-equality, live package and tsconfig key parity, derived target-command split (['bun','run','doom.ts']), launcher-text transition markers, source-catalog and FACT_LOG evidence, and per-file SHA-256 drift guard.
- performance_findings: Test's sha256Hex helper used crypto.subtle.digest + a manual byte→hex padStart loop; the loop allocates a fresh string per byte and pushes onto an array. Minor (4 calls per test) but inconsistent with the Bun.CryptoHasher convention used in sibling 02-031 and the 03-005 audit fix-pass.
- improvement_findings: sha256Hex inconsistent with sibling hashing convention; otherwise no improvement gaps — all manifest fields are sorted and machine-readable, the focused test pins values rather than mere existence, and the helpUsageLines toContain(...) check correctly tolerates the leading-whitespace stripping (the manifest's no-leading-space form is a substring of src/main.ts's two-space-indented HELP_TEXT line).
- corrective_action: Replaced WebCrypto sha256Hex implementation with a Bun.CryptoHasher-based version that calls hasher.update(await Bun.file(...).bytes()) and hasher.digest('hex'), matching the convention in 02-031 and the 03-005 audit fix-pass. No manifest field values changed; all four pinned SHA-256 hashes still verify exactly against the live filesystem.
- files_changed: test/plan_fps/01-007-audit-missing-bun-run-doom-entrypoint.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/plan_fps/01-007-audit-missing-bun-run-doom-entrypoint.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T19:48:10Z - 02-031 capture-final-side-by-side-replay - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 02-031
- step_title: capture-final-side-by-side-replay
- prior_audits: none
- correctness_findings: Fixture at test/oracles/fixtures/capture-final-side-by-side-replay.json fully satisfies Expected Changes — captureCommand pins program 'bun' with full --side-by-side-replay/--reference-executable/--iwad/--input-trace/--sample-tics/--hash/--report argv and pending-unimplemented-side-by-side-surface implementationStatus, captureWindow holds startTic=0/endTic=2100 with sampleTics==sampleFrames at the canonical 35Hz tic rate and 320×200 framebuffer, commandContract names runtimeCommand 'bun run doom.ts' with sourceManifestStepId '01-015', expectedTrace records 5 ordered checkpoints (clean-launch-pair-created → menu-route-to-e1m1 → e1m1-gameplay-synchronized → scripted-path-samples-collected → final-side-by-side-report-ready) with monotonic frameIndex/tic, inheritedSourceHashes mirror the 01-015 manifest (package.json/src/main.ts/tsconfig.json with the same SHA-256 and sizes that recompute exactly against live), liveHashStatus records the four required missing-surface kinds (audio, framebuffer, music-event, state) cross-referencing the manifest's explicitNullSurfaces, and the pinned traceSha256 (4c4e75ccf5333fe7ea84916139237d77403adb8307f5220bfd5c95fd784e6111) recomputes exactly via Bun.CryptoHasher over JSON.stringify(expectedTrace). Oracle is registered as OR-FPS-036 in plan_fps/REFERENCE_ORACLES.md with the matching refresh command. Test pins full fixture deep-equality, fixture-derived trace hash, command contract cross-check against the 01-015 manifest, missing-surface map, and oracle/source-authority registration.
- performance_findings: none — test reads each file once, uses Bun.CryptoHasher for hashing, and uses Bun.file().json() for JSON parsing with no per-call allocations beyond what the test invariants require.
- improvement_findings: none — implementation already follows the conventions established by the 03-005 and 02-031 audits (Bun.CryptoHasher, Bun.file().json(), assert-on-fixture rather than assert-on-local-const), schema is sorted and machine-readable, and all hashes verify against the live filesystem.
- corrective_action: none — no fixes required.
- files_changed: plan_fps/AUDIT_LOG.md
- tests_run: bun test test/oracles/capture-final-side-by-side-replay.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T19:58:23Z - 00-002 declare-plan-fps-control-center - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 00-002
- step_title: declare-plan-fps-control-center
- prior_audits: none
- correctness_findings: Manifest at plan_fps/manifests/00-002-declare-plan-fps-control-center.json fully satisfies Expected Changes — schemaVersion: 1, decisionId: D-FPS-001, activeControlCenter pins all nine plan_fps subpaths (README/checklist/prompt/pre-prompt/template/validator script+test/steps/manifests directories), priorArtPlan declares plan_engine as prior-art-only with mixed classification inherited from existing-plan-classification.json, runtimeTarget locks 'bun run doom.ts', totalSteps: 223 with firstStepId 00-001 classify-existing-plan and finalGateStepId 15-010, writableWorkspaceRoot 'D:/Projects/doom-in-typescript', readOnlyReferenceRoots ['doom/', 'iwad/', 'reference/'] each terminating in '/', sharedFiles enumerates the nine plan_fps control-log/reference files, ralphLoopWorkflowStepCount 12, and validationCommands lists the canonical five commands. The 23-test focused suite verifies on-disk existence for every active path, deep-equality on declarative arrays, derived first-step path pattern, sorted-no-duplicates invariants on three list fields, MASTER_CHECKLIST/README/DECISION_LOG cross-checks, validate-plan.ts RUNTIME_TARGET source pin, glob-counted step file total against manifest.totalSteps, and checklist-row regex count against manifest.totalSteps. No nullable/empty/wrap-around boundary exists in this declarative manifest.
- performance_findings: README.md is read four times across four independent tests (lines 112, 172, 209, 223). Splitting tests for readability is intentional and Bun.file().text() is fast for small files; hoisting via beforeAll would couple the tests. Not worth changing.
- improvement_findings: none — manifest fields are sorted and machine-readable, the test pins exact values rather than mere existence (deep-equality on sharedFiles/readOnlyReferenceRoots/validationCommands, glob-derived step file count cross-check, regex-validated step filename pattern), and cross-references both the prior-art classification manifest and the validate-plan.ts runtime target source. The readOnlyReferenceRoots existence check is correctly omitted because doom/ and iwad/ are gitignored user-supplied directories.
- corrective_action: none — no fixes required.
- files_changed: plan_fps/AUDIT_LOG.md
- tests_run: bun test test/plan_fps/00-002-declare-plan-fps-control-center.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T19:58:23Z - 06-014 replay-deterministic-input - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 06-014
- step_title: replay-deterministic-input
- prior_audits: none
- correctness_findings: Implementation in src/playable/input/replayDeterministicInput.ts satisfies Expected Changes — REPLAY_DETERMINISTIC_INPUT_CONTRACT pins domains tuple, neutralTicCommand=EMPTY_TICCMD, preservesArrivalOrder=true, replaysOnlyCurrentTic=true, runtimeCommand 'bun run doom.ts', ticCommandSize=TICCMD_SIZE, traceSchemaVersion=1, validatesKeyboardTranslation=true. Function validates runtime command, integer ticIndex/traceCursor with non-negative ticIndex and bounded traceCursor, header (runtimeCommand, schemaVersion, ticCommandSize, neutralTicCommand-by-field), per-event integer arrivalIndex/ticIndex with non-negative ticIndex, type-discriminated assertion (keyboard scanCode/extendedKey/doomKey cross-checked against extractScanCode/isExtendedKey/translateScanCode of messageLongParameter; mouse-button enum + transition; mouse-motion integer deltas; scripted-doom-key transition), monotonic arrival-order within a tic, and skipped-pending-tic guard. Test (4 cases pre-audit) only covered the contract value, contract hash, manifest linkage, happy-path consumption, runtime-command rejection, and one keyboard doomKey drift case — leaving header validation, bounds errors, mouse-button enum/transition errors, mouse-motion integer guard, scripted-doom-key transition guard, monotonic arrival, skipped pending tic, empty consumption, end-of-trace cursor, and non-zero cursor resume paths drift-unprotected.
- performance_findings: replayDeterministicInput allocated a new array via spread `Object.freeze([...consumedEvents])` before freezing the result, even though the local `consumedEvents` array is constructed inside the function and never escapes before the freeze. The spread allocates a redundant copy on every call (one per tic at 35Hz when input replay is active).
- improvement_findings: 23 missing-coverage paths — header runtimeCommand/traceSchemaVersion/ticCommandSize/neutralTicCommand mismatches, traceCursor < 0 / > events.length, ticIndex < 0, non-integer ticIndex, keyboard scanCode/extendedKey mismatches and unsupported transition, mouse-button unsupported button/transition, mouse-motion non-integer delta, scripted-doom-key unsupported transition, scripted-doom-key negative ticIndex, non-monotonic arrival within a tic, skipped pending tic, empty-trace consumption, cursor-at-end consumption, and non-zero cursor resume.
- corrective_action: Replaced `Object.freeze([...consumedEvents])` with `Object.freeze(consumedEvents)` to drop the redundant spread allocation; the local array is the sole reference and freeze still prevents post-return mutation. Added 23 regression tests to test/playable/input/replay-deterministic-input.test.ts covering keyboard scanCode mismatch, keyboard extendedKey mismatch, unsupported keyboard transition, mouse-button enum and transition errors, mouse-motion non-integer delta, scripted-doom-key transition error, negative event ticIndex, non-monotonic arrival within a tic, skipped pending tic, empty-result requested-tic mismatch, cursor-at-end consumption, fully-empty trace consumption, non-integer ticIndex, negative ticIndex, traceCursor out-of-bounds (both directions), all four header mismatches, and a non-zero cursor resume case. Test count grew from 6 (10 expects) to 27 (39 expects). Imported the missing event-type interfaces (MouseButtonReplayTraceEvent, MouseMotionReplayTraceEvent, ScriptedDoomKeyReplayTraceEvent) so the new tests build event fixtures with `as const satisfies <Type>` rather than `as` casts. Contract value and pinned SHA-256 hash are unchanged.
- files_changed: src/playable/input/replayDeterministicInput.ts; test/playable/input/replay-deterministic-input.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/playable/input/replay-deterministic-input.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T19:58:23Z - 05-007 handle-pause-focus-timing - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 05-007
- step_title: handle-pause-focus-timing
- prior_audits: none
- correctness_findings: Implementation in src/playable/real-time-main-loop/handlePauseFocusTiming.ts satisfies Expected Changes — HANDLE_PAUSE_FOCUS_TIMING_CONTRACT pins deterministicReplayGuard, focusLossPolicy, focusRegainPolicy, hostTransition (matches the 01-006 manifest's currentLauncherHostTransition.call), mainLoopPhase 'tryRunTics', runtimeCommand 'bun run doom.ts', and ticTimingAuthority. Function correctly handles all five state transitions: wrong runtime → throws; phase ≠ tryRunTics → 'skip' with paused: !isFocused and resetApplied: false; tryRunTics + !isFocused → 'pause' with resetApplied: false; tryRunTics + !wasFocused + isFocused → 'resume' with reset called and resetApplied: true; tryRunTics + wasFocused + isFocused → 'continue'. The 5-test focused suite (pre-audit) covered the contract literal, contract hash, manifest+source cross-checks, focus-loss→focus-regain transition, non-tryRunTics phase skip, and runtime-command rejection — but did not cover the steady-state 'continue' path, the still-unfocused 'pause' path at tryRunTics, or the paused-during-non-tryRunTics phase path.
- performance_findings: none — function returns a freshly-constructed result object per call (5 fields, ~35Hz under tryRunTics + 35Hz×3 other phases), trivial allocation. Pre-freezing the simple-path results would require parameterizing on totalTics/paused, which would not amortize.
- improvement_findings: 3 missing-coverage action paths — 'continue' (true→true at tryRunTics, no reset), 'pause' (false→false at tryRunTics, no reset, not first time), and 'skip' with paused: true (lose focus during non-tryRunTics phase to verify the paused flag tracks isFocused even when the action is skip).
- corrective_action: Added 3 regression tests to test/playable/real-time-main-loop/handle-pause-focus-timing.test.ts: 'continues without resetting when focus is held across consecutive tryRunTics calls', 'keeps reporting pause without resetting when focus has been lost across consecutive tryRunTics calls', and 'preserves the paused flag across non-tryRunTics phases when focus is lost'. Each test uses an inline TicAccumulator stub with a resetCallCount counter and asserts the full PauseFocusTimingDecision shape via toEqual plus the reset call count and (where relevant) the totalTics drift after the call. Test count grew from 6 (12 expects) to 9 (20 expects). No production code change required.
- files_changed: test/playable/real-time-main-loop/handle-pause-focus-timing.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/playable/real-time-main-loop/handle-pause-focus-timing.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T20:10:48Z - 09-009 apply-palette-effects-and-gamma - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 09-009
- step_title: apply-palette-effects-and-gamma
- prior_audits: none
- correctness_findings: applyPaletteEffectsAndGamma in src/playable/rendering-product-integration/applyPaletteEffectsAndGamma.ts satisfies Expected Changes — PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT pins entryFile 'doom.ts' / runtimeCommand 'bun run doom.ts', the function rejects non-Bun-runtime callers, validates byteLength on framebuffer (64000), gammaTable (256), palette (768), and presentationFramebuffer (256000), validates paletteEffect.{red,green,blue} integer 0..255 and paletteEffect.strength integer 0..256, and writes RGBA bytes via the rounded-blend formula `((source*(0x100-strength) + target*strength + 0x80) >> 8) & 0xff` then `gammaTable[blended]` over a full 320x200 frame. Boundary inputs strength=0 collapses to gammaTable[palette[i]] (palette+gamma pass-through) and strength=256 collapses to gammaTable[targetColor] (full target replacement); all 64000 pixels and the FNV-1a-style framebuffer/presentation checksums verified byte-identical against the prior implementation after the performance refactor. The test file's pinned EXPECTED_PRESENTATION_SHA256, EXPECTED_FRAMEBUFFER_CHECKSUM, EXPECTED_PRESENTATION_CHECKSUM, and EXPECTED_FIRST/LAST_PRESENTATION_BYTES all still match the new implementation, proving algorithm output is unchanged.
- performance_findings: Hot loop ran 64000 iterations and accessed `context.{framebuffer,gammaTable,palette,presentationFramebuffer}` (~10x per iter) and `context.paletteEffect.{red,green,blue,strength}` (~12x per iter via the inner `blendChannel` call) — roughly 23 property reads per pixel × 64000 = 1,472,000 property reads per frame. Additionally `context.paletteEffect.red/green/blue` were re-multiplied by `strength` 192,000 times per frame (3 channels × 64000) when the products are loop-invariant, and `pixelIndex * PRESENTATION_BYTES_PER_PIXEL` recomputed offsets each iteration when an accumulated `presentationOffset += 4` would suffice. The non-inlined `blendChannel(source, target, strength, inverseStrength)` helper added 192,000 function-call frames per frame.
- improvement_findings: 9 missing-coverage paths in test/playable/rendering-product-integration/apply-palette-effects-and-gamma.test.ts — invalid framebuffer/gammaTable/palette/presentationFramebuffer byteLengths (each both above and below the expected size, plus the zero-byte case), invalid paletteEffect.{red,green,blue} below 0 / above 0xff / non-integer (and Infinity), strength below 0 / above 0x100 / non-integer / NaN, the strength=0 boundary (palette+gamma pass-through), and the strength=256 boundary (full target color replacement). Test 4 only covered strength=0x101. Result.paletteEffect referential identity (`result.paletteEffect === input.paletteEffect`) was also unprotected.
- corrective_action: Refactored applyPaletteEffectsAndGamma to (1) hoist context.framebuffer/gammaTable/palette/presentationFramebuffer/paletteEffect to locals, (2) hoist paletteEffect.strength + the loop-invariant target*strength products into pre-multiplied locals (targetRedScaled/targetGreenScaled/targetBlueScaled), (3) inline the blendChannel formula into the hot loop body, (4) replace `pixelIndex * PRESENTATION_BYTES_PER_PIXEL` with an accumulating `presentationOffset += PRESENTATION_BYTES_PER_PIXEL`, and (5) delete the now-unused blendChannel helper. The blend formula and FNV-1a checksum sequence are byte-identical to the prior implementation. Updated the test's EXPECTED_SOURCE_SHA256 to `99241bad3b9e0ba8472d0765a079b576b18aae6021fb316ad8622fa72fcf00f9` (recomputed via Bun.CryptoHasher) and added 22 new regression assertions: a parameterized 9-case byte-length rejection (each branch of assertByteLength × negative/zero/over case), a parameterized 14-case paletteEffect rejection covering blue/green/red bounds plus integer/NaN/Infinity guards and strength bounds plus non-integer/NaN guards, a strength=0 boundary test (full-frame SHA-256 hash compare against an oracle-computed expected buffer plus an independent gammaTable[palette[paletteIndex*3+offset]] sampled-pixel check at index 12345), a strength=256 boundary test (full-frame SHA-256 hash compare against a constant-color expected buffer with explicit gamma-table value pins 0xdf/0xbf/0x7f), and a `result.paletteEffect === fixture.paletteEffect` identity assertion in the existing golden test. Test count grew from 4 (22 expects) to 28 (78 expects).
- files_changed: src/playable/rendering-product-integration/applyPaletteEffectsAndGamma.ts; test/playable/rendering-product-integration/apply-palette-effects-and-gamma.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/playable/rendering-product-integration/apply-palette-effects-and-gamma.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T20:10:48Z - 01-005 audit-pure-engine-surface - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 01-005
- step_title: audit-pure-engine-surface
- prior_audits: none
- correctness_findings: Manifest at plan_fps/manifests/01-005-audit-pure-engine-surface.json fully satisfies Expected Changes — auditScope pins allowedReadOnlyPaths/catalogAuthority/limitation/selectedSourceEntry, commandContracts pins currentLauncherCommand 'bun run src/main.ts' / currentPackageScript {name:'start', value:'bun run src/main.ts'} / finalRuntimeCommand 'bun run doom.ts' / runtime 'bun', currentLauncher pins entryPoint, defaults (DEFAULT_MAP_NAME='E1M1', DEFAULT_SCALE=2, DEFAULT_SKILL=2, defaultIwadExpression), the 5 directImports (bootstrap-command-line, launcher-session, win32-host-presentation, reference-policy, reference-target), and helpTextStatesGameplayViewLaunch/launchesWindowHost flags, evidencePaths and readScope are 5-entry sorted-equal lists, explicitNullSurfaces enumerates 6 alphabetically sorted surfaces (broadPureEngineModuleInventory, deterministicTickApi, pureEngineEntrypoint, saveStateSerializationApi, sideEffectFreeRendererApi, simulationStateHashApi) each with value:null and prose evidence/reason, packageJson and tsconfigJson contents pinned, pureEngineSurface records directPureEngineImportCount:0 with empty list and explicitNullSurfaceCount:6 and visibleBoundary classification 'launcher-only-visible', sourceCatalog pins hashSha256 and 3 relevantRows (S-FPS-009..011), and srcMain pins hashSha256 + Bun.argv/Bun.file/process.exit usage flags. All four pinned hashes recompute exactly against the live filesystem via Bun.CryptoHasher (package.json 9075b8e3…, plan_fps/SOURCE_CATALOG.md 7c8de73f…, src/main.ts 019ea4be…, tsconfig.json 49105a2f…). FACT_LOG.md F-FPS-013 is present with the durable read-scope-limitation fact.
- performance_findings: none — manifest is static JSON; tests read each file once and use Bun.CryptoHasher.
- improvement_findings: (1) Test used `JSON.parse(await Bun.file(path).text())` via a local readJsonFile helper for three call sites (the manifest, package.json, tsconfig.json) where 8 of 13 sibling 01-* tests use the one-call `Bun.file(path).json()` convention codified in the 02-031, 02-015, 03-005, 01-007 audit fix-passes; (2) hashFile manually constructed the hasher across three lines and used `arrayBuffer()` where the audited 01-007 convention is the single-statement `Bun.CryptoHasher('sha256').update(await Bun.file(path).bytes()).digest('hex')`; (3) the test asserted the explicit-null-surface name list against a hard-coded 6-element array but did not lock the alphabetical-sort invariant or the no-duplicates invariant — the manifest is currently sorted but a future drift to an unsorted insertion order would still match the toEqual literal if the same names happened to be present in any order with a similar literal update; (4) explicit-null-surface entries' `evidence`/`reason` fields were not type-checked or required to be non-empty.
- corrective_action: Replaced all three `JSON.parse(await Bun.file(path).text())` call sites with `Bun.file(path).json()` and removed the now-unused readJsonFile helper. Hoisted the manifest path to a single MANIFEST_PATH constant. Replaced hashFile with the one-statement `new Bun.CryptoHasher('sha256').update(await Bun.file(path).bytes()).digest('hex')` form aligned with the 01-007 audit fix-pass. Strengthened test 4 with an explicit `surfaceNames === [...surfaceNames].sort()` sortedness assertion, a `new Set(surfaceNames).size === surfaceNames.length` no-duplicates assertion, and a per-entry typeof + non-empty length check on every explicitNullSurfaces[].evidence and .reason field. Manifest content unchanged. Test count remains 5; expect() count grew from 32 to 61.
- files_changed: test/plan_fps/01-005-audit-pure-engine-surface.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/plan_fps/01-005-audit-pure-engine-surface.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T20:20:05Z - 05-005 schedule-presentation - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 05-005
- step_title: schedule-presentation
- prior_audits: none
- correctness_findings: schedulePresentation in src/playable/real-time-main-loop/schedulePresentation.ts satisfies Expected Changes — SCHEDULE_PRESENTATION_CONTRACT pins accumulationRule 'floor((delta * 35) / frequency)', currentLauncherCommand 'bun run src/main.ts', deterministicReplayCompatibility prose, mainLoopPhaseCount=4, mainLoopPhases [startFrame, tryRunTics, updateSounds, display] (matching MAIN_LOOP_PHASES), playableHostTransition exactly equal to the 01-006 manifest's currentLauncherHostTransition.call, presentationPhase 'display', requiredRuntimeCommand 'bun run doom.ts', ticAuthority [TicAccumulator.advance(), TicAccumulator.totalTics], and ticsPerSecond=35. The function rejects non-Bun runtime commands with 'schedulePresentation requires runtime command bun run doom.ts', returns null for any phase ≠ 'display', and otherwise returns {frameOrdinal: frameCount+1, mainLoopPhase: 'display', presentationScheduled: true, runtimeCommand: 'bun run doom.ts', ticsPerSecond: 35, totalTics}. The result type uses readonly fields but the runtime object was not Object.freeze'd, leaving the deterministic-replay-shape promise unenforced at runtime — sibling functions preserveKeyRepeatBehavior, replayDeterministicInput, and handlePauseFocusTiming all freeze their result objects/arrays.
- performance_findings: none — function called at most once per display phase (~35Hz), no allocations beyond a 6-field result literal, no per-frame property re-reads. Object.freeze adds a one-time sealing call per frame which is acceptable.
- improvement_findings: (1) Test used `node:crypto.createHash` for the contract hash where every recently-audited sibling test (01-005, 01-007, 02-015, 02-031, 03-005, 03-013, 06-014, 09-009) uses `Bun.CryptoHasher` per the convention codified by the 01-007 and 02-015 audit fix-passes; (2) test used `JSON.parse(await Bun.file(...).text())` instead of the one-call `Bun.file(...).json()` convention; (3) test contained no `Object.isFrozen` assertion on SCHEDULE_PRESENTATION_CONTRACT, so a future regression dropping the wrapper Object.freeze would not be caught; (4) test 'skips presentation outside the display phase' covered only one non-display phase ('updateSounds'), leaving 'startFrame' and 'tryRunTics' untested for the same skip path; (5) test did not pin a non-trivial totalTics-to-result correspondence beyond the single 12-tic happy-path case.
- corrective_action: Replaced `node:crypto.createHash` with `new Bun.CryptoHasher('sha256').update(...).digest('hex')` (removing the unused node:crypto import). Replaced `JSON.parse(await Bun.file(HOST_SURFACE_MANIFEST_PATH).text())` with `Bun.file(HOST_SURFACE_MANIFEST_PATH).json()`. Wrapped the schedulePresentation return literal in `Object.freeze({...})` so the runtime shape matches the readonly type contract and matches the freeze convention used by preserveKeyRepeatBehavior/replayDeterministicInput. Added `expect(Object.isFrozen(SCHEDULE_PRESENTATION_CONTRACT)).toBe(true)` to test 1 and `expect(Object.isFrozen(scheduled)).toBe(true)` to the happy-path test. Added two new tests: 'skips presentation for every non-display phase' iterates over startFrame/tryRunTics/updateSounds, and 'preserves the totalTics snapshot it observes from TicAccumulator' pins totalTics=1234567 → result.totalTics=1234567 and frameCount=0 → frameOrdinal=1. Contract value and pinned SHA-256 hash (f9375fd3f3ca58342ec510c00663253c1059ec20bf171d33099c3798cb732773) are unchanged because Object.freeze does not affect JSON.stringify output. Test count grew from 6 (10 expects) to 8 (15 expects).
- files_changed: src/playable/real-time-main-loop/schedulePresentation.ts; test/playable/real-time-main-loop/schedule-presentation.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/playable/real-time-main-loop/schedule-presentation.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T20:20:05Z - 00-011 define-side-by-side-acceptance-standard - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 00-011
- step_title: define-side-by-side-acceptance-standard
- prior_audits: none
- correctness_findings: Manifest at plan_fps/manifests/00-011-define-side-by-side-acceptance-standard.json fully satisfies Expected Changes — schemaVersion=1, decisionId 'D-FPS-011', stepId '00-011', stepSlug 'define-side-by-side-acceptance-standard', acceptanceGate pins comparisonMode 'side-by-side' / gateStepId '15-010' / gateStepSlug 'gate-final-side-by-side' / referenceAuthority 'local-read-only-doom-reference' / requiresCleanLaunch=true / requiresDeterministicReplay=true, allowedPresentationDifference cites D-FPS-004 with implementationLaunchMode 'windowed' / referenceLaunchMode 'fullscreen' / scope 'launch-presentation-envelope-only', comparisonPipeline holds 5 ordered steps (arrange → launch-clean → drive-deterministic → capture-oracles → accept-only-window-envelope), runtimeTarget pins 'bun run doom.ts' to D-FPS-003, and requiredEvidenceFamilies enumerates 8 alphabetically sorted families (attract-loop, audio-hash-windows, framebuffer-hash-windows, music-event-hash-windows, save-load-roundtrip, scripted-e1m1-start, startup-and-menu-transitions, state-hash-windows). Every evidence family includes the final acceptance gate '15-010' in its gateStepIds (verified — invariant-locked by the new test). The DECISION_LOG.md D-FPS-011 block matches the test's expectedDecisionBlock literal exactly (status accepted, date 2026-04-24, decision/rationale/evidence/affected_steps/supersedes prose).
- performance_findings: none — manifest is static JSON read once per test; the test parses the manifest twice across two consecutive tests but each parse is fast for a ~3 KB file and consolidating to beforeAll would couple tests for negligible gain.
- improvement_findings: (1) Test used four separate `JSON.parse(await Bun.file(path).text())` call sites (lines 122, 128, 150, 152) where the convention established by the 01-005, 01-007, 02-015, 02-031, 03-005 audit fix-passes is `Bun.file(path).json()`; (2) test asserted manifest deep-equality and the comparison-pipeline order but did NOT lock the alphabetical-sort invariant on requiredEvidenceFamilies, the no-duplicates invariant on comparisonPipeline ids or requiredEvidenceFamilies ids, the sortedness/no-duplicates of evidencePaths, or the load-bearing acceptance-gate invariant that every required evidence family must terminate at the final gate step (15-010); (3) test did not pin oracleStepIds non-empty or oracle-step-id no-duplicates per family; (4) test did not pin the runtime-target → D-FPS-003 link or the acceptance-gate clean-launch / deterministic-replay flags as a fail-loud governance assertion.
- corrective_action: Replaced all four `JSON.parse(await Bun.file(path).text())` call sites with `Bun.file(path).json()`. Added five new structural-invariant tests: 'keeps evidence paths sorted with no duplicates' asserts evidencePaths matches its sorted copy and unique-Set length; 'keeps required evidence family ids alphabetical and unique' asserts the family-id list matches its sorted copy and unique-Set length; 'keeps comparison pipeline ids unique' asserts unique-Set length on pipeline ids; 'routes every evidence family through the final acceptance gate' iterates each family and asserts (a) family.gateStepIds includes acceptanceGate.gateStepId ('15-010'), (b) family.oracleStepIds.length > 0, (c) family.gateStepIds is duplicate-free, (d) family.oracleStepIds is duplicate-free; 'uses the runtime command pinned by D-FPS-003 as the acceptance-gate target' asserts runtimeTarget.command === 'bun run doom.ts' / runtimeTarget.decisionId === 'D-FPS-003' / acceptanceGate.requiresDeterministicReplay === true / acceptanceGate.requiresCleanLaunch === true. Manifest content unchanged. Test count grew from 5 (12 expects) to 10 (39 expects).
- files_changed: test/plan_fps/00-011-define-side-by-side-acceptance-standard.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/plan_fps/00-011-define-side-by-side-acceptance-standard.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none

## 2026-04-25T20:20:05Z - 06-005 preserve-key-repeat-behavior - Claude Code

- status: completed
- agent: Claude Code
- model: claude-opus-4-7
- effort: max
- step_id: 06-005
- step_title: preserve-key-repeat-behavior
- prior_audits: none
- correctness_findings: preserveKeyRepeatBehavior in src/playable/input/preserveKeyRepeatBehavior.ts satisfies Expected Changes — PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT pins auditManifestStepId '01-010', auditSurface 'input-event-source' (cross-checked against the live 01-010 manifest's input-event-source explicit-null-surface), neutralTicCommand=EMPTY_TICCMD, repeatCountMask=0xFFFF, repeatExpansionPolicy prose, repeatStateFlag=0x40000000, replayCompatibility prose, runtimeCommand 'bun run doom.ts', ticCommandSize=8, supportedEventTypes ['keydown'], translationFunctions ['extractScanCode','isExtendedKey','translateScanCode'], unmappedPolicy 'drop'. The function correctly rejects non-Bun runtime, rejects non-keydown event types, rejects repeatCount<1 (repeatCount = lparam & 0xFFFF, so a malformed message with repeat-count zero throws cleanly), drops unmapped scan codes via translateScanCode→0 'continue' (drops the entire repeat run for an unmapped scan code, matching the policy intent), and otherwise expands one Win32 keydown into `repeatCount` PreservedRepeatedKeydown entries with isRepeat=(wasPreviouslyDown || ordinal>1). Each result element is Object.freeze'd and the result array itself is Object.freeze'd. Boundary check: a 0xFFFF repeat-count produces exactly 65535 entries, ordinal[0]=1/isRepeat=false and ordinal[65534]=65535/isRepeat=true. Edge case verified: scan code 0x00 (unmapped) with previousState=true correctly drops without leaking into the result, and a scan code 0x4D extended-flag-set message that follows produces the single KEY_RIGHTARROW arrival in source order.
- performance_findings: none — function processes Win32 keyboard messages at human typing rate (well under 35Hz), per-message Object.freeze cost is acceptable. The result-array Object.freeze does not allocate a copy (the local array is the sole reference at freeze time, matching the 06-014 audit's freeze-without-spread convention).
- improvement_findings: (1) Test had no `Object.isFrozen` assertion on PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT itself or on its frozen array fields (supportedEventTypes, translationFunctions) or its frozen object field (neutralTicCommand) — a regression dropping any Object.freeze would not be caught; (2) test 'expands repeated keydown counts without deduping' only checked `Object.isFrozen(preservedRepeatedKeydowns[0])` not every element; (3) no test for the empty-eventMessages path (returns frozen empty array); (4) no test for the maximum 16-bit repeat count boundary (LONG_PARAMETER_REPEAT_COUNT_MASK = 0xFFFF) — the previously-tested max was 3; (5) no test for previousState=true combined with repeatCount>1, where the policy should mark every expansion (including ordinal 1) as isRepeat=true; (6) no test for source-order preservation across 3+ messages with a mid-list unmapped drop.
- corrective_action: Added four `Object.isFrozen` assertions to the contract-locking test (the contract object plus its supportedEventTypes/translationFunctions/neutralTicCommand fields). Added four new regression tests: 'returns a frozen empty result for an empty event message list' (empty input → empty frozen array); 'marks every expansion as a repeat when the previous-state flag is set' (repeatCount=3 + previousState=true → all 3 ordinals isRepeat=true, every element frozen); 'expands the maximum 16-bit repeat count without truncating arrivals' (repeatCount=0xFFFF → exactly 65535 entries, first element isRepeat=false ordinal=1, last element isRepeat=true ordinal=65535); 'preserves arrival order across mixed mapped and unmapped messages' (3 messages: scan-0x1E rep=2 → 2 entries, scan-0x00 rep=5 → 0 entries (dropped), scan-0x4D extended rep=1 → 1 entry, total 3 ordered entries with each frozen). Production code unchanged. Test count grew from 7 (16 expects) to 11 (52 expects). Contract value and pinned SHA-256 hash (5b6e5aeeb9d95efeebb8fd84aa5e0f3df5e11952f46ad7ec74635517caeaf196) are unchanged.
- files_changed: test/playable/input/preserve-key-repeat-behavior.test.ts; plan_fps/AUDIT_LOG.md
- tests_run: bun test test/playable/input/preserve-key-repeat-behavior.test.ts; bun test; bun x tsc --noEmit --project tsconfig.json
- follow_up: none
