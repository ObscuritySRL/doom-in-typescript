# doom-in-typescript

TypeScript and Bun work toward a vanilla DOOM parity engine, with a new Ralph-loop plan for turning the existing deterministic engine pieces into a windowed, playable product.

The C1 product target is:

```sh
bun run doom.ts
```

That final entry point is planned but not complete yet. The current repository contains engine, asset, rendering, input, audio, save/demo, oracle, and parity-test work, plus a Win32 launcher that can run through Bun against a local IWAD.

## Current State

- Runtime, package manager, script runner, and test runner: Bun.
- Current runnable launcher: `bun run start -- --iwad <path-to-iwad>`.
- Current default launcher behavior: starts a gameplay window for a selected map, with gameplay and automap views.
- Final playable target: windowed `bun run doom.ts`.
- Active playable plan: `plan_fps/`.
- Prior engine plan: `plan_engine/`.
- Proprietary DOOM assets are not committed and must remain local.

## Requirements

- Windows
- Bun
- A local IWAD such as `DOOM.WAD`

The project uses Bun-compatible Win32 bindings, so the current launcher and host work are Windows-oriented.

## Setup

```sh
bun install
```

Place local DOOM data outside version control. The ignored local asset directories are:

- `doom/`
- `iwad/`

When `--iwad` is omitted, the current launcher looks for the default reference IWAD path defined in the source.

## Run

List maps in an IWAD:

```sh
bun run start -- --iwad D:\path\to\DOOM.WAD --list-maps
```

Launch the current gameplay window:

```sh
bun run start -- --iwad D:\path\to\DOOM.WAD --map E1M1 --skill 2 --scale 2
```

Current launcher controls:

- `W` / `S` or arrow up / down: move forward or backward
- `A` / `D` or arrow left / right: turn left or right
- `Q` / `E`: strafe left or right
- `Shift`: run
- `Tab`: toggle gameplay view and automap
- `PageUp` / `PageDown`: zoom the automap
- `F`: toggle automap follow
- `Esc`: quit

## Verify

Run the full test suite:

```sh
bun test
```

Run the typecheck:

```sh
bun x tsc --noEmit --project tsconfig.json
```

Validate the playable parity plan:

```sh
bun test plan_fps/validate-plan.test.ts
bun run plan_fps/validate-plan.ts
```

## Planning

`plan_fps/` is the active control center for the playable parity work. Future Ralph-loop turns should start from:

- `plan_fps/PROMPT.md`
- `plan_fps/MASTER_CHECKLIST.md`
- `plan_fps/README.md`

`plan_engine/` is retained as prior art for the existing engine work. Do not use it as the active control center unless a selected `plan_fps` step explicitly says to read it.

The playable plan keeps the final acceptance target scoped to a Bun-run application, not a compiled executable, installer, wrapper, or packaged binary.

## Repository Layout

- `src/`: TypeScript implementation work.
- `test/`: Bun test suite and parity fixtures.
- `tools/`: verification and reference helper tools.
- `reference/`: committed manifests and reference metadata only.
- `plan_fps/`: active playable parity plan.
- `plan_engine/`: prior engine plan.

## Asset Boundary

This repository does not redistribute proprietary DOOM binaries or IWAD files. Keep original DOOM files in ignored local directories, and do not commit generated oracle artifacts inside those reference asset roots.
