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
