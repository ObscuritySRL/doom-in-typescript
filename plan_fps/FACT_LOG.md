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
