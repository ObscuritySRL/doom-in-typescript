# plan_final Acceptance Lane (13-001..13-011) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is deliberately executed in **deliberate, review-checkpointed sessions**, NOT a `/goal` Stop-hook loop — the terminal condition (bit-exact zero-diff vs. the reference) is not single-session-completable and must never be faked.

**Goal:** Make `bun run doom.ts` launch the real vanilla-parity DOOM engine and complete plan_final steps `13-001..13-011` with genuine, mechanically-validated, bit-exact zero-diff live evidence against the local Chocolate Doom 2.2.1 reference.

**Architecture:** The engine subsystems (`src/core`, `src/wad`, `src/assets`, `src/map`, `src/world`, `src/player`, `src/ai`, `src/specials`, `src/render`, `src/audio`, `src/ui`, `src/save`, `src/demo`, `src/bootstrap`, `src/host`, `src/mainLoop.ts`) are individually implemented and unit-tested. The work is **composition + parity validation**, not subsystem implementation: wire `doom.ts → src/vanilla/runDoomMain.ts`, replace the 15 no-op `src/vanilla/dDoomMain.ts` init steps and the 4 log-only `src/vanilla/runDoomLoop.ts` per-frame callbacks with real bodies that drive the `MainLoop` (`src/mainLoop.ts`) phases exactly as `D_DoomLoop`, present via a `D_DoomLoop`-driven Win32 host (pattern proven in `src/launcher/win32.ts`), capture the 17 pending live reference fixtures, then close each `13-*` gate against bit-exact hashes.

**Tech Stack:** Bun (runtime/test/scripts only — never npm/node/tsx/vitest), TypeScript strict, `bun:ffi` (user32/gdi32/kernel32/winmm), Windows-only. Reference oracle = local DOOM.EXE / DOOM1.WAD via `tools/reference/*` + `src/oracles/*`.

**Realistic effort estimate:** Phases A–B: ~0.5–1 session. Phase C (composition): ~3–6 focused sessions. Phase D (live capture): ~1–2 sessions (Win32/desktop-serial, flaky-capture-prone). Phase E (bit-exact parity): **the dominant cost — open-ended, plausibly many sessions**; achieving zero framebuffer/tic diff vs. real DOOM requires reconciling every fixed-point rounding, RNG call-order, BSP/visplane, and audio-event detail. Treat Phase E as iterative debugging, not a fixed task list. **Do not promise a completion date.**

---

## Governance preconditions (RESOLVED — recorded 2026-05-15)

The repository owner explicitly authorized, via this session's `AskUserQuestion`:
1. Treat `plan_vanilla_parity` / `test/vanilla_parity` (and the `test/plan_fps/01-013..01-015` `src/main.ts` pins) as **superseded prior art**. Retiring/adjusting their `doom.ts` / `src/main.ts` skeleton pins is sanctioned **under owner governance authority** — this is the documented exception to the otherwise non-negotiable "do not weaken passing tests" rule, and applies ONLY to these specific cross-plan entrypoint-skeleton pins.
2. `03-002` remains **permanently BLOCKED/accepted** (do not attempt to complete it; do not edit `src/main.ts` to satisfy it).

Authoritative memory: `plan_final-03-002-accepted-blocked`, `plan_final-acceptance-lane-unreachable` (pre-decision history), `plan_final-governance-blockers`.

Everything below is gated on those decisions remaining in force. If a future owner reverses them, **stop and re-escalate**.

---

## Non-negotiable rules for every task in this plan

- Bun only. `bun run format`, `bun test`, `bun x tsc --noEmit --project tsconfig.json`. Never npm/yarn/pnpm/npx/node/tsx/ts-node/vitest/jest/mocha.
- TDD: failing test first, minimal implementation, green, commit. No `as any` / `as unknown as T`. Strict mode never weakened.
- A `13-*` step is COMPLETE only when: `plan_final/status/<id>.json` = `COMPLETED` with a real `commitSha`, `plan_final/evidence/<id>.json` exists with zero `knownFailures`, the focused test passes headless, the full `bun test` passes, `bun x tsc --noEmit` is clean, the required `bun run plan_final/test-live-reference.ts` live capture passed, and the commit is pushed to `main`.
- Never accept manifest-only / sampled-only / pending / intent-only proof for `13-*`. `plan_final/validate-plan.ts` (`validateFinalGates` / `findFinalProofViolations`) mechanically enforces this — run it as part of every `13-*` task.
- Live Win32 reference captures are serialized through `bun run plan_final/test-live-reference.ts`. Never run two live DOOM windows on the same desktop. Beware the Snipping-Tool/`WDA_EXCLUDEFROMCAPTURE` capture-break (memory: `snipping-tool-overlay-blocks-capture`).
- Commit with Conventional Commits, authored as Stev Peifer, no AI attribution. Stage explicit paths. Push directly to `main`; pull/rebase + re-verify if remote moved (parallel Ralph workers may be active).
- Each `13-*` step retains its plan_final ceremony: append-only `plan_final/progress/acceptance/<id>.md`, write lock = `test/plan_final/acceptance/<step>.test.ts` + `plan_final/final-gates/` + `plan_final/{status,evidence}/<id>.json`.

---

## File Structure

**Created:**
- `test/plan_final/acceptance/gate-bun-run-doom-smoke.test.ts` … `gate-final-side-by-side-zero-diff.test.ts` (11 gate tests, one per `13-00x`).
- `plan_final/final-gates/` — real per-gate live-evidence artifacts (framebuffer/state/audio/demo/save hash records produced by live runs; **not** hand-written).
- `src/vanilla/win32DoomHost.ts` — `D_DoomLoop`-driven Win32 window host composing `src/vanilla/win32WindowHost.ts` primitives with the FFI loop pattern from `src/launcher/win32.ts`.
- `src/vanilla/displayComposite.ts` — `D_Display` composite (gamestate → render + UI overlay) consumed by the loop `display` callback.
- `tools/reference/captureImplementationFrames.ts` — capture our `bun run doom.ts` framebuffer/state/audio windows for side-by-side diff (mirror of `tools/reference/captureReferenceTitleFrame.ts`, our side).

**Modified:**
- `doom.ts` — wire to `runDoomMain` (governed; breaks vanilla_parity skeleton pins — retired in Phase A).
- `src/vanilla/runDoomMain.ts:193-198` — real init+loop composition.
- `src/vanilla/dDoomMain.ts` — replace `NO_OP_INIT` for all 15 `D_DOOM_MAIN_INIT_ORDER` entries with real bodies.
- `src/vanilla/runDoomLoop.ts` — replace the 4 placeholder `MainLoop` callbacks (`startFrame`/`tryRunTics`/`updateSounds`/`display`) with real bodies.
- `src/vanilla/runtimeContext.ts` — narrow `playerSlots[i].player` from `unknown` to `Player`; carry host/render/audio handles.
- `package.json` — add the `doom.ts` start script (governed; breaks a vanilla_parity pin — retired in Phase A).
- Cross-plan pin tests retired/adjusted in Phase A (enumerated there).

---

## Phase A — Governed cross-plan pin retirement

> Purpose: stop `test/vanilla_parity` / `test/plan_fps` from freezing `doom.ts`/`src/main.ts` as skeletons, under the owner's explicit supersession authority. Do this FIRST so Phase B/C verification is not fighting these pins. This is the single authorized exception to "don't weaken tests" — scope it tightly to entrypoint-skeleton assertions only; do not touch unrelated assertions in those files.

### Task A1: Inventory the exact breaking assertions

**Files:**
- Investigate only (no edits).

- [ ] **Step 1:** Identify every test assertion that will fail once `doom.ts` imports+runs and `package.json` gains a `doom.ts` script. Start set (confirmed this session):
  - `test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts` — 11 tests (`export {}` marker, no-imports regex `/^\s*import[\s\(]/m`, no `console.log`/`process.exit`/`Bun.spawn`, `bun run doom.ts` exit-0/empty-stderr, `package.json` has no `doom.ts` script).
  - `test/plan_final/launch/gate-clean-launch-to-title.test.ts:~89` — asserts `doom.ts` held at skeleton.
  - `test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts` — `doom_ts_status` / `expected_runtime_target` / launch-attempt assertions.
  - `test/vanilla_parity/current-state/inventory-plan-fps-manifest-only-gates.test.ts`, `inventory-iwad-search-and-hash-evidence.test.ts` — `runtime_command` / `entry_file` inventory invariants.
  - `test/plan_fps/01-013-audit-missing-save-load-ui.test.ts`, `01-014-audit-missing-config-persistence.test.ts`, `01-015-audit-missing-side-by-side-replay.test.ts` — `src/main.ts` SHA + ordered-substring pins (only relevant if Phase C also touches `src/main.ts`; prefer NOT touching `src/main.ts` — it stays for `bun run start` — so these may not need changes; confirm).
- [ ] **Step 2:** Run `bun test test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts` to record the exact current pass baseline.
- [ ] **Step 3:** Write findings to `plan_final/progress/acceptance/phase-a-pin-inventory.md` (exact file:line of every assertion to retire, and which are NOT touched). Commit that doc: `git add plan_final/progress/acceptance/phase-a-pin-inventory.md && git commit -m "docs(plan_final): inventory cross-plan doom.ts skeleton pins for governed retirement"`.

### Task A2: Retire the doom.ts skeleton assertions (governed)

**Files:**
- Modify: `test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts`
- Modify: `test/plan_final/launch/gate-clean-launch-to-title.test.ts`
- Modify: `test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts` and the two `inventory-*` files from A1 Step 1
- Modify: any matching inventory JSON the above read (e.g. `plan_final/current-state/runtime-implementation-modules.json` `subsystems_reachable_from_doom_ts`)

- [ ] **Step 1:** For `add-root-doom-ts-bun-entrypoint.test.ts`: replace the skeleton-invariant tests ("no import declarations", `export {}`-only, no side effects, no `doom.ts` package script) with the **new post-supersession invariant**: `doom.ts` is a thin entrypoint that imports `runDoomMain` and invokes it; `bun run doom.ts --help` (or a non-launching flag) exits 0; keep the genuine failure-mode tests (nonexistent file → module-not-found; throwing module → non-zero exit) unchanged. Add a header comment citing the owner supersession decision + date.
- [ ] **Step 2:** For `gate-clean-launch-to-title.test.ts`: change the line-~89 skeleton assertion to assert the wired entrypoint shape instead. Keep all other assertions intact.
- [ ] **Step 3:** For the `inventory-*` tests + JSON: update the `doom_ts_status` / `subsystems_reachable_from_doom_ts` / `runtime_command` expectations to the wired reality. Do **not** alter unrelated inventory rows.
- [ ] **Step 4:** `bun run format` then `bun test test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts test/plan_final/launch/gate-clean-launch-to-title.test.ts` — expect PASS against the new invariants (the wiring itself lands in Phase B; here the tests must still pass with the *current* skeleton until B, so write A2 tests to assert the *target* shape and land A2+B together, OR gate A2 assertions behind the presence of the import — choose: **land A2 and B in the same commit** to avoid a red interval).
- [ ] **Step 5:** Do not commit A2 alone; proceed to Phase B and commit A2+B atomically.

---

## Phase B — Wire doom.ts → runDoomMain

### Task B1: Minimal wired entrypoint

**Files:**
- Modify: `doom.ts`
- Modify: `package.json` (add `"doom": "bun run doom.ts"` script — confirm exact key against `bun run start` convention)
- Test: reuse the Phase A2 updated `test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts`

- [ ] **Step 1 (failing test):** Phase A2 already rewrote the entrypoint test to expect `import { runDoomMain }` + invocation + clean `--help` exit. Run it; expect FAIL (doom.ts still skeleton).

  Run: `bun test test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts`
  Expected: FAIL (no import in doom.ts).

- [ ] **Step 2 (implement):** Replace `doom.ts` body with:

```ts
// Vanilla DOOM 1.9 parity Bun entrypoint. `bun run doom.ts` is the canonical
// runtime target (plan_vanilla_parity establish-vanilla-parity-control-center).
// Skeleton pin retired under owner governance supersession 2026-05-15.
import { runDoomMain } from './src/vanilla/runDoomMain.ts';

await runDoomMain(Bun.argv.slice(2));
```

- [ ] **Step 3 (green):** `bun run format` then `bun test test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts test/plan_final/launch/gate-clean-launch-to-title.test.ts` → PASS. Then `bun test` (full) and `bun x tsc --noEmit --project tsconfig.json` → confirm no other test depended on the retired pins (fix any stragglers found here, scoped to entrypoint-skeleton assertions only).

- [ ] **Step 4 (commit A2+B atomically):**

```bash
git add doom.ts package.json test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts test/plan_final/launch/gate-clean-launch-to-title.test.ts test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts plan_final/current-state/runtime-implementation-modules.json
git commit -m "feat(launch): wire doom.ts to runDoomMain and retire superseded skeleton pins"
git push origin main   # pull --rebase + re-verify if remote moved
```

> After B1, `bun run doom.ts` reaches `runDoomMain` but `runDoomMain` is still the argv-only placeholder — it parses and returns. No window yet. That is expected; Phase C makes it launch.

---

## Phase C — Real runDoomMain composition (the engine integration)

> This is multi-session. Decompose strictly along `src/mainLoop.ts` `MainLoop` phases. Reference behavior = Chocolate Doom 2.2.1 (`plan_fps/REFERENCE_ORACLES.md` authority order). Every callback must call the already-tested `src/` implementations — do not reimplement subsystems.

### Task C1: Real D_DoomMain init order

**Files:**
- Modify: `src/vanilla/dDoomMain.ts` (replace each `NO_OP_INIT`)
- Modify: `src/vanilla/runDoomMain.ts:193-198` (after `resolveLaunchContext`, build `IwadResourceCache` via a Bun file loader, `createVanillaRuntimeContext`, then `runDDoomMainInit(context)`)
- Modify: `src/vanilla/runtimeContext.ts` (narrow `playerSlots[].player: Player`)
- Test: `test/plan_final/launch/` new focused tests per init step (TDD: assert each init step performs its real effect on the runtime context)

- [ ] **Step 1:** For each of the 15 `D_DOOM_MAIN_INIT_ORDER` entries, write a failing test asserting its real post-condition (e.g. `W_Init` → context exposes IWAD lumps; `R_Init` → render tables/`computeViewport` populated; `S_Init` → sound channels allocated; `M_LoadDefaults` → config loaded from `default.cfg`). Map each to its real `src/` call: `V_Init`→framebuffers (already in `createVanillaRuntimeContext`), `M_LoadDefaults`→`src/bootstrap/config`, `W_Init`→`iwadResourceCache`, `I_Init`→Win32 host (Task C3), `OPL_Init`/`S_Init`→`src/audio`, `R_Init`→`src/render/projection` + `viewSetup`, `P_Init`→`src/world`/`src/specials`, `M_Init`/`HU_Init`/`ST_Init`→`src/ui`, etc. (Confirm exact init list + Chocolate Doom order from `src/vanilla/dDoomMain.ts` + `src/bootstrap/initOrder.ts`.)
- [ ] **Step 2–N:** TDD each init step (failing test → wire the real `src/` call → green → commit per step). One commit per init step.

### Task C2: Real D_DoomLoop per-frame callbacks

**Files:**
- Modify: `src/vanilla/runDoomLoop.ts` (4 callbacks)
- Create: `src/vanilla/displayComposite.ts`
- Test: `test/plan_final/launch/` focused tests asserting each callback drives the real subsystem (deterministic, headless where possible)

- [ ] **Step 1 (`tryRunTics`):** Replace placeholder with a call into `src/bootstrap/tryRunTics.ts` (the real implementation). Failing test: a deterministic seeded run advances game tics and mutates state. Green. Commit.
- [ ] **Step 2 (`updateSounds`):** Call `src/audio` spatial sound update (`src/vanilla/wireSpatialSfxRuntime.ts` surface). Failing test: active channels re-evaluated per tic. Green. Commit.
- [ ] **Step 3 (`display`):** Implement `src/vanilla/displayComposite.ts` = `D_Display`: switch on `VanillaGameState` (`src/vanilla/wireGameStateTransitions.ts`), render via `src/render` (vanilla fixed-point renderer — NOT the launcher float renderer) into the 320×200 indexed framebuffer, overlay `src/ui` (title/menu/HUD/automap/intermission/finale via the wire barrels), apply wipe transitions. Failing test: each gamestate produces the expected framebuffer-hash shape. Green. Commit.
- [ ] **Step 4 (`startFrame`):** Call `src/host` tic accumulator/clock (`src/host/ticAccumulator.ts`, `PerformanceClock`). Failing test: frame timing advances. Green. Commit.

### Task C3: D_DoomLoop-driven Win32 host

**Files:**
- Create: `src/vanilla/win32DoomHost.ts` (compose `src/vanilla/win32WindowHost.ts` primitives — `createIndexedFramebuffer`, `buildBgraPaletteLookup`, `convertIndexedFrameToBgra`, `buildVanillaBitmapInfoHeader`, `computeVanillaPresentationRect` — with the proven FFI loop pattern from `src/launcher/win32.ts`: `CreateWindowExW`/message pump/`GetAsyncKeyState`/`StretchDIBits`). No new FFI bindings needed.
- Modify: `src/vanilla/runDoomMain.ts` (after init, construct the host and run `runVanillaDoomLoop` against it)
- Test: `test/plan_final/launch/` host-shape unit tests headless (FFI window creation is a live test — gate behind the live-reference env, do not run in plain `bun test`).

- [ ] **Step 1:** TDD the pure host primitives composition headless (framebuffer→BGRA→bitmap-info pipeline correctness).
- [ ] **Step 2:** Wire the live FFI window+loop (mirror `src/launcher/win32.ts`). Manual/live verification only; keep headless `bun test` green by env-gating the FFI path.
- [ ] **Step 3:** Smoke: `bun run doom.ts --iwad doom/DOOM1.WAD` opens a window showing the DOOM title screen (manual). Commit.

> Phase C exit criteria: `bun run doom.ts` launches, shows the title loop, accepts input, plays music/SFX, enters E1M1, runs the vanilla simulation, quits cleanly — functionally equivalent to the reference. (Bit-exactness is Phase E.)

---

## Phase D — Live reference + implementation fixture capture

**Files:**
- Use: `tools/reference/createReferenceSandbox.ts`, `launchReferenceCleanly.ts`, `captureReferenceTitleFrame.ts`, `windowCaptureProbe.ts`; `src/oracles/{framebufferHash,stateHash,audioHash,musicEventLog,referenceSandbox,referenceRunManifest}.ts`
- Create: `tools/reference/captureImplementationFrames.ts` (our side: launch `bun run doom.ts` windowed, GDI-capture client area, `normalizeToInternalFramebuffer`, hash — mirror of the reference capturer)
- Modify: the 17 pending fixtures under `test/oracles/fixtures/` (registry: `test/plan_final/oracle/replace-pending-oracle-fixtures.test.ts` `BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY`) — replace `"pending-live-reference-capture"` placeholders with real captured SHA-256s
- Add (if absent): `test/plan_final/acceptance/*` to `plan_final/liveReferenceTestConfig.ts` `LIVE_REFERENCE_TEST_PATHS` (note: that file is outside the 13-* write locks — its edit needs its own governed step or owner confirmation; alternatively always pass explicit paths to `test-live-reference.ts` which the 13-* verification commands already do)

- [ ] **Step 1:** Capture all reference fixtures from the real `DOOM.EXE` via `bun run plan_final/test-live-reference.ts` (serialized; one window at a time). Persist real hashes; remove every `pending-live-reference-capture`. Run `test/plan_final/oracle/replace-pending-oracle-fixtures.test.ts` → green. Commit per fixture group.
- [ ] **Step 2:** Build `tools/reference/captureImplementationFrames.ts` and verify it captures our window deterministically (same windowed cfg, same `normalizeToInternalFramebuffer` 320×200 path). Commit.

---

## Phase E — Per-gate bit-exact parity (13-001 → 13-011)

> One task group per gate, in prerequisite order. Each is a full plan_final step (progress log, focused test, full verify, `validate-plan`, evidence+status JSON, commit, push). Phase E is **iterative parity debugging** — when a diff is nonzero, root-cause it to a specific subsystem deviation from Chocolate Doom 2.2.1 and fix in `src/` (re-running that subsystem's unit tests), then re-capture. Budget Phase E as open-ended.

For each gate `13-00x` (smoke; title/menu; e1m1-entry; scripted-e1m1; demo-sync; save-load; intermission/finale; full-shareware; registered-when-present; ultimate-when-present; final-side-by-side-zero-diff):

- [ ] **Step 1:** `bun run plan_final/select-step.ts --lane acceptance` confirms `13-00x` eligible; append start entry to `plan_final/progress/acceptance/13-00x.md`.
- [ ] **Step 2:** Read the step file's read-only paths + the relevant reference fixtures.
- [ ] **Step 3 (failing test):** Author `test/plan_final/acceptance/<step>.test.ts` asserting **zero diff** between the Phase-D reference fixture and a fresh live capture of `bun run doom.ts` for that scenario (frame hashes for smoke/title/e1m1; tic/state hashes for scripted/demo; save bytes for save-load; audio/music events for audio windows; transition records for intermission/finale; the union for `13-011`). Use `src/oracles/*` hash types; write evidence to `plan_final/final-gates/13-00x/`.
- [ ] **Step 4:** Run `bun run plan_final/test-live-reference.ts test/plan_final/acceptance/<step>.test.ts`. If diff ≠ 0: root-cause to a subsystem, fix in `src/`, re-run that subsystem's unit tests + `bun test`, re-capture. Repeat until zero diff. **Never** relax the assertion to pass.
- [ ] **Step 5:** Full verify in order: `bun run format`; `bun test test/plan_final/acceptance/<step>.test.ts`; `bun test`; `bun run plan_final/test-live-reference.ts test/plan_final/acceptance/<step>.test.ts`; `bun run plan_final/validate-plan.ts` (must report no `findFinalProofViolations`); `bun x tsc --noEmit --project tsconfig.json`.
- [ ] **Step 6:** Write `plan_final/evidence/13-00x.json` (commands, changed paths, zero knownFailures, clean typecheck, live-capture proof reference) and `plan_final/status/13-00x.json` (`COMPLETED`, real `commitSha`).
- [ ] **Step 7:** `bun run plan_final/sync-master-checklist.ts`; stage explicit paths; commit `feat(plan_final): gate <title> for 13-00x` + `docs(plan_final): record 13-00x completion status`; push; verify remote contains the SHA; log it in the progress file.

`13-011` (`gate-final-side-by-side-zero-diff`, prereqs `13-008/009/010`) is the terminal: a single live side-by-side run (clean launch + demos + gameplay + save/load + transitions) with **all** diff classes zero and no pending evidence. Only then is the plan_final goal genuinely met.

---

## Self-Review

- **Spec coverage:** Phase A covers the governance-pin blocker; B the doom.ts seam; C the runDoomMain/init/loop/host composition (the code-explorer's gap list, items 1–6); D the 17 pending fixtures + our-side capture; E each of `13-001..13-011` including the final zero-diff. `03-002` is intentionally out of scope (owner-accepted blocked). Covered.
- **Placeholder scan:** Investigative tasks (A1, C1 Step 1, E Step 4 root-causing) are honestly labeled as investigation/iteration, not hidden TODOs — appropriate for a parity-debugging effort; code steps with known shape show the code (B1). The deliberately open-ended parts (Phase E) are flagged as such with rationale rather than fake task counts.
- **Type consistency:** `runDoomMain`, `runVanillaDoomLoop`, `createVanillaRuntimeContext`, `runDDoomMainInit`, `D_DOOM_MAIN_INIT_ORDER`, `resolveLaunchContext`, `IwadResourceCache`, `VanillaRuntimeContext`, `VanillaGameState` names match the code-explorer's verified symbol map.
- **Known risk:** Phase E (bit-exact parity vs. real DOOM) is the dominant, open-ended cost and the reason this is not a `/goal` Stop-loop. Execute with review checkpoints; never fake a gate to make the loop terminate.
