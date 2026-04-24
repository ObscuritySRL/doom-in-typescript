# Fact Log

## F-FPS-001

- date: 2026-04-24
- fact: The repository root is `D:/Projects/doom-in-typescript`.
- source: environment context and `Get-Location`

## F-FPS-002

- date: 2026-04-24
- fact: `plan_fps/` did not exist before this playable planning system was created.
- source: filesystem inspection

## F-FPS-003

- date: 2026-04-24
- fact: The old `plan_engine/` checklist contains 167 completed mixed engine/playable/parity steps and references an older `D:/Projects/bun-win32/doom_codex` workspace path.
- source: `plan_engine/MASTER_CHECKLIST.md`, `plan_engine/README.md`, `plan_engine/PROMPT.md`

## F-FPS-004

- date: 2026-04-24
- fact: Local reference files include `doom/DOOM.EXE`, `doom/DOOMD.EXE`, `doom/DOOM1.WAD`, `doom/default.cfg`, and `doom/chocolate-doom.cfg`.
- source: filesystem inspection

## F-FPS-005

- date: 2026-04-24
- fact: The current package script launches `src/main.ts`; the playable parity target still requires a root-level `doom.ts` command contract.
- source: `package.json`, `src/main.ts`

## F-FPS-006

- date: 2026-04-24
- fact: The old `plan_engine/` classification is `mixed`: 167 steps completed across 18 phases (00 Governance through 17 Parity And Acceptance) deliver deterministic engine, host timing/input, bootstrap, map/world, player/AI/specials, renderer, UI, audio, save/config/demo, and parity work, but do not lock the `bun run doom.ts` playable target or the side-by-side acceptance gate.
- source: `plan_fps/manifests/existing-plan-classification.json`, `plan_engine/MASTER_CHECKLIST.md`, `plan_engine/README.md`, `plan_engine/PROMPT.md`, `package.json`, `src/main.ts`

## F-FPS-007

- date: 2026-04-24
- fact: The active Bun lockfile name on disk is `bun.lock` (text format), not the older binary `bun.lockb`. AGENTS.md previously referenced `bun.lockb`; the audit pass for 00-005 corrected the rule to match the actual lockfile name and the manifest pinned in `plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json` (`allowedLockfile.path = "bun.lock"`).
- source: filesystem inspection (`bun.lock` exists at workspace root; no `bun.lockb` present), `plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json`, `AGENTS.md`

## F-FPS-008

- date: 2026-04-24
- fact: The repository contains three top-level in-workspace reference roots at `doom/`, `iwad/`, and `reference/`; all three currently exist as directories on disk under `D:/Projects/doom-in-typescript`.
- source: filesystem inspection

## F-FPS-009

- date: 2026-04-24
- fact: The current launcher surface is `src/main.ts`; it imports `src/bootstrap/cmdline.ts`, `src/launcher/session.ts`, `src/launcher/win32.ts`, `src/reference/policy.ts`, and `src/reference/target.ts`, and the launcher help text states that it starts in the gameplay view and can switch to automap on demand.
- source: `src/main.ts`, `plan_fps/manifests/01-001-audit-existing-modules.json`

## F-FPS-010

- date: 2026-04-24
- fact: The visible test configuration is Bun-based: `tsconfig.json` includes the `test` root, `package.json` has no `test` script, and the 01-002 verification contract invokes `bun test` directly.
- source: `package.json`, `tsconfig.json`, `plan_fps/steps/01-002-audit-existing-tests.md`

## F-FPS-011

- date: 2026-04-24
- fact: Within the 01-003 read scope, the catalog-visible oracle fixture authorities are `doom/DOOM1.WAD`, `iwad/DOOM1.WAD`, and `reference/manifests/`; no generated playable oracle fixture inventory is visible, so the 01-003 manifest records explicit null surfaces for that missing inventory.
- source: `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-003-audit-existing-oracle-fixtures.json`

## F-FPS-012

- date: 2026-04-24
- fact: The 01-004 read scope exposes `reference/manifests/` only as a catalog-visible prior-art directory and does not permit enumerating `reference/manifests/` or `plan_fps/manifests/`.
- source: `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-004-audit-existing-manifests.json`

## F-FPS-013

- date: 2026-04-24
- fact: Within the 01-005 read scope, `src/main.ts` exposes no direct pure-engine entry point or deterministic engine API; it imports bootstrap, launcher session, Win32 host, and reference policy/target modules, so broader pure-engine inventory remains outside the 01-005 read scope and is recorded as explicit nulls.
- source: `src/main.ts`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-005-audit-pure-engine-surface.json`

## F-FPS-014

- date: 2026-04-24
- fact: Within the 01-006 read scope, `src/main.ts` directly transitions from loaded launcher resources to `runLauncherWindow` imported from `src/launcher/win32.ts`, starts in the gameplay view, exposes a Tab automap toggle in help text, and leaves the host implementation inventory itself outside the read scope as an explicit null.
- source: `src/main.ts`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-006-audit-playable-host-surface.json`

## F-FPS-015

- date: 2026-04-24
- fact: Within the 01-007 read scope, `package.json` exposes `scripts.start` as `bun run src/main.ts`, and the allowed launch surfaces expose no implemented root `doom.ts` command contract.
- source: `package.json`, `src/main.ts`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json`

## F-FPS-016

- date: 2026-04-24
- fact: Within the 01-008 read scope, `src/main.ts` creates a launcher session and calls `runLauncherWindow` directly with help and console text that starts in gameplay view; no clean launch-to-menu entry or menu-first transition is exposed.
- source: `src/main.ts`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-008-audit-missing-launch-to-menu.json`

## F-FPS-017

- date: 2026-04-24
- fact: Within the 01-009 read scope, `src/main.ts` defaults directly to `E1M1`, creates a gameplay launcher session before `runLauncherWindow`, and exposes gameplay-first help/console text; no menu-to-E1M1 route is exposed.
- source: `src/main.ts`, `package.json`, `plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json`

## F-FPS-018

- date: 2026-04-24
- fact: Within the 01-010 read scope, `src/main.ts` documents live controls in help text and delegates to `runLauncherWindow`, but no live keyboard/mouse event source, key translation table, gameplay input router, menu input router, mouse capture policy, input trace recorder, or per-tic input accumulator is exposed.
- source: `src/main.ts`, `package.json`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-010-audit-missing-live-input.json`

## F-FPS-019

- date: 2026-04-24
- fact: Within the 01-011 read scope, `src/main.ts` launches `runLauncherWindow` without any exposed live audio host, mixer, music, sound-effect, volume, or audio hash surfaces; only the package-level `@bun-win32/winmm` dependency is visible as an audio-adjacent capability.
- source: `src/main.ts`, `package.json`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-011-audit-missing-live-audio.json`

## F-FPS-020

- date: 2026-04-24
- fact: Within the 01-012 read scope, `src/main.ts` exposes only rendering-adjacent launch text, scale/title options, and delegation to `runLauncherWindow`; no live renderer, framebuffer, presentation blit, palette/gamma, status bar, menu overlay, title screen, automap renderer, wipe transition, or framebuffer hash surface is exposed.
- source: `src/main.ts`, `package.json`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-012-audit-missing-live-rendering.json`

## F-FPS-021

- date: 2026-04-24
- fact: Within the 01-013 read scope, `src/main.ts` exposes gameplay-first launch and delegates to `runLauncherWindow`, but no save/load menu route, save slot UI, load slot UI, save description entry, save path policy, or live save/load roundtrip surface is exposed.
- source: `src/main.ts`, `package.json`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-013-audit-missing-save-load-ui.json`

## F-FPS-022

- date: 2026-04-24
- fact: Within the 01-014 read scope, `src/main.ts` exposes transient command-line values for IWAD, map, skill, and scale plus a `Bun.file` default IWAD probe, but no config file read/write path, default.cfg or chocolate-doom.cfg bridge, key/mouse/sound/screen setting persistence, vanilla compatibility flag persistence, or user-local config test isolation surface is exposed.
- source: `src/main.ts`, `package.json`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-014-audit-missing-config-persistence.json`

## F-FPS-023

- date: 2026-04-24
- fact: Within the 01-015 read scope, `src/main.ts` exposes gameplay-first launch, map listing, and `runLauncherWindow` delegation, but no side-by-side replay command, synchronized reference/implementation runner, input trace loader, frame/state/audio hash comparison, or final side-by-side report surface is exposed.
- source: `src/main.ts`, `package.json`, `plan_fps/SOURCE_CATALOG.md`, `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json`
