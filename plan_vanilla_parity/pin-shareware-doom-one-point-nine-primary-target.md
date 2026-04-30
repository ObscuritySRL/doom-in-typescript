# Pin Shareware Doom One Point Nine Primary Target

This document pins the shareware DOOM 1.9 IWAD as the single primary parity target for the vanilla DOOM 1.9 rebuild, locks the Chocolate Doom 2.2.1 engine that emulates DOOM 1.9 as the behavioral reference, and freezes the SHA-256 hash, byte size, and on-disk relative path of every local artifact every later step is allowed to compare against. Shareware scope is fixed at episode 1 (`E1M1` through `E1M9`), the tic rate is fixed at 35 Hz, and the redistribution policy bars this repository from publishing the proprietary IWAD or the proprietary executables under any name. Later registered and Ultimate IWAD targets are listed for scope clarity but are user-supplied and never redistributed. Any future change to these invariants must update this document and its focused test in lockstep.

## primary target name

shareware DOOM 1.9

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## reference game mode

shareware

## tic rate hertz

35

## shareware iwad filename

DOOM1.WAD

## shareware iwad sha256

1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771

## shareware iwad byte size

4196020

## shareware iwad lump count

1264

## shareware iwad relative paths

- doom/DOOM1.WAD
- iwad/DOOM1.WAD

## shareware dos executable filename

DOOMD.EXE

## shareware dos executable sha256

9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B

## shareware dos executable byte size

709753

## shareware dos executable relative path

doom/DOOMD.EXE

## shareware windows executable filename

DOOM.EXE

## shareware windows executable sha256

5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2

## shareware windows executable byte size

1893888

## shareware windows executable relative path

doom/DOOM.EXE

## shareware episode count

1

## shareware episode maps

- E1M1
- E1M2
- E1M3
- E1M4
- E1M5
- E1M6
- E1M7
- E1M8
- E1M9

## shareware game description

DOOM Shareware

## shareware identification rule

Mission `doom` is resolved from the IWAD basename `doom1.wad` (case-insensitive). The lump scan must find `E1M1` and must not find `E3M1` or `E4M1`. This matches Chocolate Doom 2.2.1 `D_IdentifyVersion` and the `identifyMission` plus `identifyMode` pair in `src/bootstrap/gameMode.ts`.

## later targets

- registered DOOM (user-supplied DOOM.WAD with E3M1 present and E4M1 absent)
- ultimate DOOM (user-supplied DOOM.WAD with E4M1 present)

## proprietary asset redistribution policy

The shareware IWAD `DOOM1.WAD`, the DOS executable `DOOMD.EXE`, the merged Windows polyglot `DOOM.EXE`, and the upstream id Software DOOM source are proprietary id Software assets. They are present locally for parity authority only. This repository must not redistribute them, must not regenerate them in tests, must not stage them for commit, and must not publish them under any alternate name. Later registered and Ultimate targets are user-supplied IWADs only and are never bundled with this repository.

## evidence locations

- src/reference/target.ts
- src/bootstrap/gameMode.ts
- reference/manifests/file-hashes.json
- doom/DOOM1.WAD
- doom/DOOMD.EXE
- doom/DOOM.EXE
- iwad/DOOM1.WAD
- plan_vanilla_parity/README.md
- plan_vanilla_parity/SOURCE_CATALOG.md

## acceptance phrasing

Primary target: shareware DOOM 1.9 with local `DOOM1.WAD`.
