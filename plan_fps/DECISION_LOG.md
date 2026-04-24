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
- evidence: user request
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
