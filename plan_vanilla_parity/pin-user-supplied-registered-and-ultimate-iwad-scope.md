# Pin User Supplied Registered And Ultimate Iwad Scope

This document pins the scope of the two user-supplied DOOM IWAD parity targets that sit beyond the primary shareware `DOOM1.WAD` target: registered DOOM (`DOOM.WAD` with `E3M1` present and `E4M1` absent) and Ultimate DOOM (`DOOM.WAD` with `E4M1` present). It freezes the IWAD basename, the search relative paths users may drop the proprietary file at, the mission name, the per-target game mode, the per-target game description, the per-target Chocolate Doom 2.2.1 game version constant, the per-target episode count, the per-target full episode-map list, and the canonical lump-based identification rules that match Chocolate Doom 2.2.1 `D_IdentifyVersion` and the `identifyMission` plus `identifyMode` pair in `src/bootstrap/gameMode.ts`. It also locks the redistribution policy: this repository must never bundle, regenerate, stage for commit, or publish a registered or Ultimate `DOOM.WAD` under any name. Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

user-supplied registered and Ultimate DOOM

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## tic rate hertz

35

## supplied iwad filename

DOOM.WAD

## supplied iwad search relative paths

- doom/DOOM.WAD
- iwad/DOOM.WAD

## supplied iwad mission

doom

## supplied iwad mission identification rule

Mission `doom` is resolved from the IWAD basename `doom.wad` (case-insensitive) by `identifyMission` in `src/bootstrap/gameMode.ts`, which mirrors Chocolate Doom 2.2.1 `D_IdentifyIWADByName`. The basename match is independent of the directory prefix, so `doom/DOOM.WAD` and `iwad/DOOM.WAD` both resolve to mission `doom`.

## registered game mode

registered

## registered game description

DOOM Registered

## registered game version

exe_doom_1_9

## registered episode count

3

## registered episode maps

- E1M1
- E1M2
- E1M3
- E1M4
- E1M5
- E1M6
- E1M7
- E1M8
- E1M9
- E2M1
- E2M2
- E2M3
- E2M4
- E2M5
- E2M6
- E2M7
- E2M8
- E2M9
- E3M1
- E3M2
- E3M3
- E3M4
- E3M5
- E3M6
- E3M7
- E3M8
- E3M9

## registered identification rule

For mission `doom`, `identifyMode` in `src/bootstrap/gameMode.ts` returns `registered` when the lump directory contains `E3M1` and does not contain `E4M1`. This matches Chocolate Doom 2.2.1 `D_IdentifyVersion`: `E4M1` absent collapses the retail branch, and `E3M1` present collapses the shareware branch, leaving the registered branch.

## ultimate game mode

retail

## ultimate game description

The Ultimate DOOM

## ultimate game version

exe_ultimate

## ultimate episode count

4

## ultimate episode maps

- E1M1
- E1M2
- E1M3
- E1M4
- E1M5
- E1M6
- E1M7
- E1M8
- E1M9
- E2M1
- E2M2
- E2M3
- E2M4
- E2M5
- E2M6
- E2M7
- E2M8
- E2M9
- E3M1
- E3M2
- E3M3
- E3M4
- E3M5
- E3M6
- E3M7
- E3M8
- E3M9
- E4M1
- E4M2
- E4M3
- E4M4
- E4M5
- E4M6
- E4M7
- E4M8
- E4M9

## ultimate identification rule

For mission `doom`, `identifyMode` in `src/bootstrap/gameMode.ts` returns `retail` when the lump directory contains `E4M1`. This matches Chocolate Doom 2.2.1 `D_IdentifyVersion`: the retail branch is selected on the first `E4M1` lookup, regardless of `E3M1` presence.

## local availability

No registered or Ultimate `DOOM.WAD` exists at `doom/DOOM.WAD` or `iwad/DOOM.WAD` in this working tree. Both paths are gitignored and reserved as user-supplied drop locations for the user's own purchased proprietary IWAD. The only IWAD copies present locally are the two shareware copies pinned by `plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md` (`doom/DOOM1.WAD` and `iwad/DOOM1.WAD`).

## proprietary asset redistribution policy

The registered `DOOM.WAD` and the Ultimate `DOOM.WAD` are proprietary id Software assets. They are user-supplied only. This repository must not bundle them, must not regenerate them in tests, must not stage them for commit, must not publish them under any alternate name, and must not redistribute them. Tests that exercise registered or Ultimate behavior must skip cleanly when no user-supplied `DOOM.WAD` is present at `doom/DOOM.WAD` or `iwad/DOOM.WAD`.

## evidence locations

- src/bootstrap/gameMode.ts
- src/reference/target.ts
- plan_vanilla_parity/README.md
- plan_vanilla_parity/SOURCE_CATALOG.md

## acceptance phrasing

Later targets: user-supplied registered or Ultimate `DOOM.WAD`; no proprietary assets are redistributed.
