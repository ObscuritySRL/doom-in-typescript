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
