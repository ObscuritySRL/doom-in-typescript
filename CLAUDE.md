# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Authoritative rules documents

Read these before making changes — they are binding:

- `AGENTS.md` — repository-wide rules (runtime, style, commits, testing, secrets). The **Runtime**, **GitHub and Publishing Authority**, and **Things to Never Do** sections are non-negotiable.
- `plan_fps/README.md` and `plan_fps/PROMPT.md` — Ralph-loop workflow (active plan).
- `README.md` — user-facing run and verify commands.

If anything in this file conflicts with `AGENTS.md`, `AGENTS.md` wins.

## Runtime constraints

- **Bun only.** Runtime, package manager, script runner, and test runner. Never `npm`, `yarn`, `pnpm`, `npx`, `node`, `ts-node`, `tsx`, `vitest`, `jest`, or `mocha`.
- **Windows only.** The host/launcher uses `@bun-win32/*` FFI bindings (user32, gdi32, kernel32, winmm). There is no cross-platform fallback and none should be added.
- **No compiled binary.** The C1 product target is `bun run doom.ts` — a Bun-run app, not an `.exe`, installer, or packaged binary.
- Prettier: `printWidth: 240`, `singleQuote: true`. TypeScript strict mode is on and must not be weakened. `as any` / `as unknown as T` are banned — fix the types instead.

## Commands

Install: `bun install`

Run the current launcher (not the final `doom.ts` target, which is not yet built):

```sh
bun run start -- --iwad <path-to-IWAD> --map E1M1 --skill 2 --scale 2
bun run start -- --iwad <path-to-IWAD> --list-maps
```

Full verification sequence (canonical order — see `tools/verify.ts`):

```sh
bun test <focused-path>                         # focused test first
bun test                                        # full suite
bun x tsc --noEmit --project tsconfig.json      # typecheck
```

Plan validation (run whenever `plan_fps/` changes):

```sh
bun test plan_fps/validate-plan.test.ts
bun run plan_fps/validate-plan.ts
```

Place local DOOM assets under `doom/` or `iwad/` (both gitignored). Never commit IWADs or proprietary binaries — see `src/reference/policy.ts` for the classification and `REFERENCE_BUNDLE_PATH`.

## Architecture

The codebase is a parity re-implementation of vanilla DOOM (Chocolate Doom 2.2.1 is the behavioral reference). Keep changes faithful to that reference — do not invent behavior.

**Determinism boundary.** `src/core/` (`fixed.ts`, `angle.ts`, `trig.ts`, `rng.ts`, `binaryReader.ts`) holds the primitives every other module depends on. Fixed-point math (`FRACUNIT`, `fixedMul`), the DOOM LCG (`DoomRandom`), and angle/trig tables must match DOOM's bit-exact semantics. Anything that breaks parity here breaks parity everywhere downstream.

**Frame orchestration.** `src/mainLoop.ts` models `D_DoomLoop` exactly: a one-time pre-loop (`initialTryRunTics → restoreBuffer → executeSetViewSize → startGameLoop`) followed by the per-frame sequence (`startFrame → tryRunTics → updateSounds → display`). The `MainLoop` class is a thin orchestrator; subsystems implement the callbacks. Do not reorder these phases.

**Subsystem map** (each directory is one subsystem; together they compose the engine):

- `src/wad/` + `src/assets/` — WAD header/directory/lumps; palette, colormap, flats, patches, PNAMES, TEXTURE1, MUS.
- `src/map/` — map bundle parsing, BSP/subsector queries, blockmap, node traversal, reject, map setup.
- `src/world/` — mobj/thinker simulation: `xyMovement`, `zMovement`, `tryMove`, `slideMove`, `checkPosition`, `radiusAttack`, `sectorChange`, `teleport`, `useLines`.
- `src/player/` — spawn, movement, pickups, powerups, weapons (state machine in `weaponStates.ts`), hitscan, projectiles.
- `src/ai/` — monster behavior: chase, targeting, melee/missile range, attacks, sound propagation, boss specials, shared state transitions.
- `src/specials/` — sector/line specials: doors, floors, ceilings, platforms, stairs/donut, switches, animations, active specials scheduler, line triggers.
- `src/render/` — software renderer: projection, solid/two-sided walls, wall columns, visplanes and spans, masked textures, sprite projection/clip, fuzz, sky, patch draw, primitives, render limits.
- `src/audio/` — OPL register/synth, MUS parser+scheduler, PCM mixer, channels, SFX lumps, spatial placement, sound origins; `audioParity.ts` gates parity-affecting choices.
- `src/input/` — keyboard, mouse, focus policy, ticcmd encode.
- `src/ui/` — menus, HUD/status bar, automap, intermission, finale, ENDOOM, front-end sequence, hud messages.
- `src/save/` — save/load, vanilla save limits, core + special serialization, headers.
- `src/demo/` — demo record/playback/parse, demo file format.
- `src/bootstrap/` — `cmdline`, `config`, `gameMode`, `initOrder`, `tryRunTics`, `titleLoop`, `quitFlow` — startup and init sequencing.
- `src/host/` — `windowPolicy.ts` (screen constants), `ticAccumulator.ts`, and `src/host/win32/` (Win32 clock and message pump via `@bun-win32/*`).
- `src/launcher/` — the current runnable wiring (`session.ts`, `win32.ts`, `gameplayAssets.ts`, `gameplayRenderer.ts`). This is what `src/main.ts` drives today.
- `src/oracles/` — hashing and manifest types used for parity testing: `framebufferHash`, `stateHash`, `audioHash`, `musicEventLog`, `inputScript`, `referenceRunManifest`, `manualGatePolicy`, `referenceSandbox`, `schema`.
- `src/reference/` — asset license boundaries (`policy.ts`) and the primary target constants (`target.ts`).

**Current entry point** is `src/main.ts` → `createLauncherSession` / `runLauncherWindow`. The final target `bun run doom.ts` does not yet exist; `plan_fps/` is the plan for building it.

**Import order** (enforced): `bun:*` → `node:*` → third-party → relative, with a blank line between groups. Type imports use `import type`.

**FFI rules** (relevant across `src/host/win32/`, `src/launcher/win32.ts`, `tools/reference/`):

- Handles: `FFIType.u64` (→ `bigint`), `DWORD`: `u32`, `BOOL`: `i32`, buffer pointers: `FFIType.ptr`.
- Preserve Win32 parameter names verbatim in FFI declarations (`hProcess`, `lpBuffer`, `dwSize`, …) — the only exception to the no-abbreviations rule.
- Windows APIs are UTF-16LE: `Buffer.from(str + '\0', 'utf16le')`. `GetProcAddress` is ANSI.
- Every `OpenProcess` / `CreateToolhelp32Snapshot` / `CreateRemoteThread` needs a matching `CloseHandle` in `finally`. Every `VirtualAllocEx` needs `VirtualFreeEx`. Remote pointers are `bigint` in the target's address space — never dereference locally.

## Planning system

All forward work goes through `plan_fps/` (223 numbered step files under `plan_fps/steps/`). Each Ralph-loop turn picks the first unchecked step from `plan_fps/MASTER_CHECKLIST.md` whose prerequisites are satisfied, reads only that step file plus the files it lists under **Read Only**, and touches only files listed under **Expected Changes** (plus the control logs: `MASTER_CHECKLIST.md`, `FACT_LOG.md`, `DECISION_LOG.md`, `HANDOFF_LOG.md`, `REFERENCE_ORACLES.md`).

- `plan_engine/` is prior art only. Do not use it as the active control center unless the selected step explicitly lists a file from it under Read Only.
- Authority order for behavioral questions is in `plan_fps/REFERENCE_ORACLES.md`: local DOS binary > local IWAD > local Windows/Chocolate Doom exe > upstream Chocolate Doom source > community docs.
- Oracle artifacts must be written under `test/oracles/fixtures/`, `test/parity/fixtures/`, or `plan_fps/manifests/` — never inside `doom/`, `iwad/`, or `reference/` (those are read-only).

## Commits and publishing

- Conventional Commits (`type(scope): description`), lowercase imperative, no trailing period.
- **Authored as Stev Peifer only.** Do not override `user.name` / `user.email`. Do not add `Co-Authored-By: Claude`, `Generated with Claude Code`, 🤖 markers, or any AI attribution to commits, PR bodies, or review replies. Commit messages must read as human-authored.
- Stage files explicitly by path — never `git add -A` / `git add .`.
- Every verified Ralph-loop step ends with a commit and a direct push to the current branch. Do not open pull requests. Do not use `gh`, GitHub Apps, or any API-based publishing tooling unless the human owner changes the rule.
- If a push fails, report the blocker — do not mark the loop successful.
