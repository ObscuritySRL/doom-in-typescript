# Decision Log

## D-FPS-001

- status: accepted
- date: 2026-04-24
- decision: Use `plan_fps/` as the active playable parity control center.
- rationale: The playable parity effort needs a self-contained control center that does not rewrite the prior `plan_engine/` engine plan.
- evidence: user request, repository inspection, `plan_fps/manifests/00-002-declare-plan-fps-control-center.json`
- affected_steps: 00-001, 00-002
- supersedes: none

## D-FPS-002

- status: accepted
- date: 2026-04-24
- decision: Classify the old `plan_engine/` work as `mixed`.
- rationale: The existing checklist includes deterministic engine, host, UI, audio, save, demo, and parity-gate work, but it does not make `bun run doom.ts` the active playable launch target.
- evidence: `plan_engine/MASTER_CHECKLIST.md`, `src/main.ts`, `package.json`
- affected_steps: 00-001
- supersedes: none

## D-FPS-003

- status: accepted
- date: 2026-04-24
- decision: The C1 runtime target is exactly `bun run doom.ts`.
- rationale: Playable parity must be achieved through Bun and TypeScript directly, not through a wrapper executable or packaged binary.
- evidence: user request, `plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json`
- affected_steps: 00-003, 03-001, 14-001, 15-010
- supersedes: none

## D-FPS-004

- status: accepted
- date: 2026-04-24
- decision: The only intentional presentation difference from the reference target is windowed launch instead of fullscreen launch.
- rationale: All other observable behavior remains parity-critical until proven otherwise and recorded.
- evidence: user request, plan_fps/README.md, plan_fps/manifests/00-010-pin-windowed-only-difference.json
- affected_steps: 00-010, 04-004, 15-010
- supersedes: none

## D-FPS-005

- status: accepted
- date: 2026-04-24
- decision: Reject compiled-binary delivery targets for the C1 playable parity product. No compiled executable, wrapper executable, installer, or packaged binary.
- rationale: The C1 runtime target is exactly `bun run doom.ts` (D-FPS-003). Compiled-binary targets are out of scope and must not be introduced by downstream steps.
- evidence: plan_fps/README.md, plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json, plan_fps/manifests/00-004-reject-compiled-exe-target.json, package.json, tsconfig.json
- affected_steps: 00-004, 03-001, 03-002, 15-010
- supersedes: none

## D-FPS-006

- status: accepted
- date: 2026-04-24
- decision: Bun is the only runtime, package manager, script runner, and test runner for the C1 playable parity product. No Node.js runtime, no `npm`, `yarn`, or `pnpm` package managers, no `npx`, `ts-node`, or `tsx` script runners, and no `vitest`, `jest`, or `mocha` test runners.
- rationale: The runtime command is exactly `bun run doom.ts` (D-FPS-003) and compiled-binary delivery is rejected (D-FPS-005). Pinning every Bun role here prevents downstream steps from drifting to a non-Bun tool through a package dependency, script, or lockfile. Lockfile policy: `bun.lock` is the only allowed lockfile; `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml` must not appear on disk.
- evidence: AGENTS.md, plan_fps/README.md, plan_fps/manifests/00-002-declare-plan-fps-control-center.json, plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json, plan_fps/manifests/00-004-reject-compiled-exe-target.json, plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json, package.json, bun.lock
- affected_steps: 00-005, 00-006, 03-006
- supersedes: none

## D-FPS-007

- status: accepted
- date: 2026-04-24
- decision: Prefer Bun-native APIs (`Bun.file`, `Bun.write`, `Bun.serve`, `Bun.argv`, `Bun.env`, `Bun.sleep`, `Bun.spawn`, `bun:test`, `bun:ffi`, `bun:sqlite`) over their Node standard-library equivalents whenever both exist, and enforce the import group order `bun:*` → `node:*` → third-party → relative with a blank line between groups.
- rationale: The C1 runtime command is exactly `bun run doom.ts` (D-FPS-003) and Bun is the only runtime, package manager, script runner, and test runner (D-FPS-006). Pinning the Bun-native API preference prevents downstream steps from reaching for Node polyfills, Node FFI shims (`ffi-napi`, `node-ffi`, `node-addon-api`), or Node-only SQLite bindings (`better-sqlite3`, `sqlite3`) when an equivalent Bun API already exists. The import group order (`bun:*` → `node:*` → third-party → relative) flows directly from the preference: `bun:*` comes first because Bun builtins are the first-party runtime surface.
- evidence: AGENTS.md, plan_fps/README.md, plan_fps/manifests/00-002-declare-plan-fps-control-center.json, plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json, plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json, plan_fps/manifests/00-006-record-bun-native-api-preference.json, package.json, tsconfig.json
- affected_steps: 00-006, 03-004, 03-005, 03-006
- supersedes: none

## D-FPS-008

- status: accepted
- date: 2026-04-24
- decision: All writable product, test, tool, plan, and generated artifacts for the playable parity effort must remain under `D:/Projects/doom-in-typescript`; no Ralph-loop step may write outside that workspace root.
- rationale: The active control center already lives under the repository root and the runtime target is exactly `bun run doom.ts` (D-FPS-003). Pinning the writable boundary prevents accidental writes into neighboring repositories or system paths while still allowing later steps to define narrower read-only roots inside the workspace.
- evidence: plan_fps/README.md, plan_fps/manifests/00-007-pin-writable-workspace-boundaries.json, package.json, tsconfig.json
- affected_steps: 00-007, 00-008, 02-001, 15-001
- supersedes: none

## D-FPS-009

- status: accepted
- date: 2026-04-24
- decision: The only read-only reference roots for the playable parity effort are `D:/Projects/doom-in-typescript/doom`, `D:/Projects/doom-in-typescript/iwad`, and `D:/Projects/doom-in-typescript/reference`; no Ralph-loop step may write inside those roots.
- rationale: D-FPS-008 already pins the writable workspace root to `D:/Projects/doom-in-typescript` and D-FPS-003 pins the runtime target to `bun run doom.ts`. This step narrows that workspace into three in-repo reference roots that remain readable for parity work but never writable, while oracle and manifest outputs stay under writable project paths such as `test/oracles/fixtures/` and `plan_fps/manifests/`.
- evidence: doom, iwad, plan_fps/README.md, plan_fps/manifests/00-008-pin-read-only-reference-boundaries.json, reference, package.json, tsconfig.json
- affected_steps: 00-008, 00-009, 02-001, 02-002, 15-001
- supersedes: none

## D-FPS-010

- status: accepted
- date: 2026-04-24
- decision: Local DOOM binaries, WADs, configs, and other reference assets under `doom/`, `iwad/`, and `reference/` are inputs for local playable-parity development and verification only; they are not cleared for redistribution.
- rationale: D-FPS-008 pins the writable workspace root and D-FPS-009 pins the read-only reference roots. The README already says `Do not redistribute proprietary DOOM assets.`; this step turns that rule into an explicit local-use-only boundary so later oracle capture and packaging work cannot treat local possession of reference assets as redistribution permission.
- evidence: plan_fps/FACT_LOG.md, plan_fps/README.md, plan_fps/manifests/00-009-pin-asset-license-boundaries.json, package.json, tsconfig.json
- affected_steps: 00-009, 02-001, 02-002, 14-005, 15-010
- supersedes: none

## D-FPS-011

- status: accepted
- date: 2026-04-24
- decision: Final acceptance is a side-by-side comparison between the Bun playable path and the local read-only reference path, started from clean launch and driven by identical deterministic input, with exact parity required for authoritative transition, framebuffer, audio, music, save/load, and state evidence outside the approved windowed-versus-fullscreen launch envelope.
- rationale: D-FPS-003 pins the Bun runtime target to `bun run doom.ts`, D-FPS-004 limits presentation drift to windowed-versus-fullscreen launch, and D-FPS-009/D-FPS-010 constrain the local reference authority to read-only, non-redistributable DOOM assets. This step turns "side-by-side-verifiable" from a slogan into an exact acceptance standard for later oracle capture and final gating work.
- evidence: plan_fps/README.md, plan_fps/manifests/00-011-define-side-by-side-acceptance-standard.json, package.json, tsconfig.json
- affected_steps: 00-011, 00-012, 02-031, 15-010
- supersedes: none

## D-FPS-012

- status: accepted
- date: 2026-04-24
- decision: Every `plan_fps/steps/*.md` file must follow the shared step schema (title line, ordered section headings, path lists, Bun-only verification commands, and required log-update labels), and a step may be marked complete only after its focused test plus the required Bun verification sequence pass.
- rationale: D-FPS-003 pins the runtime target to `bun run doom.ts`, D-FPS-006 pins Bun as the only runtime and test toolchain, and D-FPS-011 turns later parity work into a strict acceptance gate. A machine-checkable step schema is required before the later validator implementation steps so the Ralph loop can reject malformed step files and incomplete verification sequences deterministically.
- evidence: plan_fps/README.md, plan_fps/manifests/00-012-define-step-validation-rules.json, package.json, tsconfig.json
- affected_steps: 00-012, 00-013, 00-014, 15-001
- supersedes: none

## D-FPS-013

- status: accepted
- date: 2026-04-24
- decision: `plan_fps/validate-plan.ts` is the canonical Bun validation script for the playable parity control center. It runs as `bun run plan_fps/validate-plan.ts`, exits nonzero when plan validation errors are present, and on success prints `Validated <totalSteps> playable parity steps. First step: <firstStep>.`.
- rationale: D-FPS-003 pins the runtime target to Bun, D-FPS-006 pins Bun as the only script runner and test toolchain, and D-FPS-012 defines the step schema and verification rules that now need an executable validator. Locking the script command and success/error contract prevents later steps from drifting to a non-Bun validation path or a vague validator output format.
- evidence: plan_fps/validate-plan.ts, test/plan_fps/plan-validation-script.test.ts, package.json, tsconfig.json
- affected_steps: 00-013, 00-014, 15-001
- supersedes: none

## D-FPS-014

- status: accepted
- date: 2026-04-24
- decision: `plan_fps/validate-plan.test.ts` is the canonical focused validator test. It must lock the exact `PLAN_VALIDATION_COMMAND`, validate explicit `planDirectory` fixtures through `validatePlan`, and assert deterministic malformed-plan diagnostics through both `validatePlan` and `runValidationCli`.
- rationale: D-FPS-012 defines the shared step-schema rules and D-FPS-013 defines the canonical Bun validator command. This step makes the validator testable without mutating the live repository plan by pinning the explicit `planDirectory` hook and the exact diagnostic lines that malformed fixtures must produce.
- evidence: plan_fps/validate-plan.ts, plan_fps/validate-plan.test.ts, package.json, tsconfig.json
- affected_steps: 00-014, 15-001
- supersedes: none
