# Reference Oracles

## O-001

- oracle: reference-file-hashes
- source: S-001 through S-007
- generation_method: Hash the local reference files before any later oracle capture work.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\file-hashes.json
- hash: generated-by-step-00-002
- consumers: 00-002, 02-001, 17-010
- trust_level: high

## O-002

- oracle: startup-console-log
- source: S-002
- generation_method: Treat the bundled stdout log as the initial startup oracle until automated capture replaces it.
- artifact_path: d:\Projects\bun-win32\doom\universal-doom\stdout.txt
- hash: AC40714D3088DA7CFC6A63E23D226CB6C0B03978FB1A0778868C0B0E72A24681
- consumers: 00-001, 07-003, 17-010
- trust_level: high

## O-004

- oracle: source-catalog
- source: S-001 through S-043
- generation_method: Serialize the SOURCE_CATALOG.md inventory to a machine-readable JSON manifest.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\source-catalog.json
- hash: generated-by-step-00-003
- consumers: 00-003, 00-004, 17-010
- trust_level: high

## O-005

- oracle: package-capability-matrix
- source: PACKAGE_CAPABILITY_MATRIX.md
- generation_method: Serialize the PACKAGE_CAPABILITY_MATRIX.md inventory to a machine-readable JSON manifest.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\package-capability-matrix.json
- hash: generated-by-step-00-004
- consumers: 00-004, 00-005, 17-010
- trust_level: high

## O-003

- oracle: wad-directory-summary
- source: S-005
- generation_method: Parse the IWAD directory once and store the result as a stable derived manifest for later steps.
- artifact_path: d:\Projects\bun-win32\doom_codex\plans\manifests\wad-directory-summary.json
- hash: generated-at-plan-build
- consumers: 01-001, 05-001, 08-010
- trust_level: high

## O-006

- oracle: wad-map-summary
- source: S-005
- generation_method: Parse the IWAD header and directory using src/wad/header.ts and src/wad/directory.ts to extract all 9 map entries with their sub-lumps and categorize all 1264 lumps into 18 categories.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\wad-map-summary.json
- hash: generated-by-step-01-002
- consumers: 01-002, 01-003, 17-010
- trust_level: high

## O-007

- oracle: demo-lump-summary
- source: S-005
- generation_method: Parse DEMO1, DEMO2, DEMO3 lump headers from the IWAD using src/wad/header.ts and src/wad/directory.ts to extract demo version, skill, episode, map, player presence, tic counts, durations, and SHA-256 hashes.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\demo-lump-summary.json
- hash: generated-by-step-01-003
- consumers: 01-003, 01-006, 07-005, 17-010
- trust_level: high

## O-008

- oracle: config-variable-summary
- source: S-006, S-007
- generation_method: Parse default.cfg (43 variables) and chocolate-doom.cfg (113 variables) from the reference bundle to extract variable names, values, types, and categories into a machine-readable inventory.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\config-variable-summary.json
- hash: generated-by-step-01-004
- consumers: 01-004, 01-005, 07-002, 17-010
- trust_level: high

## O-009

- oracle: vanilla-limit-summary
- source: Doom 1.9 source code, S-004 (chocolate-doom.cfg)
- generation_method: Compile the 16 hardcoded vanilla Doom engine limits from canonical source code references and Chocolate Doom vanilla compatibility enforcement into a machine-readable manifest.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\vanilla-limit-summary.json
- hash: generated-by-step-01-005
- consumers: 01-005, 04-001, 07-006, 09-010, 17-010
- trust_level: high

## O-010

- oracle: title-sequence
- source: S-009 (d_main.c D_DoAdvanceDemo), S-005 (DOOM1.WAD)
- generation_method: Document the 6-state shareware title/demo loop from D_DoAdvanceDemo, cross-referencing demo metadata from O-007 and lump presence from the IWAD directory.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\title-sequence.json
- hash: generated-by-step-01-006
- consumers: 01-006, 07-005, 17-010
- trust_level: high

## O-011

- oracle: quirk-manifest
- source: Doom 1.9 source code, S-003 (default.cfg), S-005 (DOOM1.WAD), S-015 through S-017 (renderer sources), S-023/S-024/S-025 (draw/sprite/main), S-026 (st_stuff.c), S-038 (i_sound.c)
- generation_method: Catalog 22 rendering and audio behavioral quirks from vanilla Doom 1.9 / Chocolate Doom 2.2.1 with source file attribution, parity impact classification, and relevant engine constants.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\quirk-manifest.json
- hash: generated-by-step-01-007
- consumers: 01-007, 01-008, 05-003, 05-004, 15-007, 17-010
- trust_level: high

## O-012

- oracle: compatibility-targets
- source: Doom 1.9 source code (doomdef.h GameMode_t, GameMission_t), Chocolate Doom 2.2.1, S-003, S-005
- generation_method: Define 6 compatibility targets (C1-C6) covering the full Doom family progression from shareware through Final Doom, with game mode, mission, IWAD, map structure, prerequisite chain, and incremental feature deltas.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\compatibility-targets.json
- hash: generated-by-step-01-008
- consumers: 01-008, 02-001, 07-003, 17-010
- trust_level: high

## O-013

- oracle: reference-run-manifest
- source: S-002 (stdout.txt), S-003 (default.cfg), S-004 (chocolate-doom.cfg), PRIMARY_TARGET, SANDBOX_REQUIRED_FILES
- generation_method: Compile the reference Chocolate Doom 2.2.1 run configuration from observed stdout, default.cfg, and chocolate-doom.cfg into a frozen TypeScript manifest with screen, audio, startup, vanilla compatibility, initialization sequence, and run mode definitions.
- artifact_path: d:\Projects\bun-win32\doom_codex\src\oracles\referenceRunManifest.ts
- hash: generated-by-step-02-002
- consumers: 02-002, 02-003, 02-008, 02-009, 17-010
- trust_level: high

## O-014

- oracle: input-script-format
- source: F-010 (35 Hz tic rate), F-022 (DOS scan codes), REFERENCE_RUN_MANIFEST (run modes), ORACLE_KINDS (input-script kind)
- generation_method: Define the input script event vocabulary (6 event kinds as discriminated union), payload interface, and frozen empty scripts for title-loop and demo-playback run modes in TypeScript.
- artifact_path: d:\Projects\bun-win32\doom_codex\src\oracles\inputScript.ts
- hash: generated-by-step-02-003
- consumers: 02-003, 02-004, 06-004, 06-005, 17-010
- trust_level: high

## O-015

- oracle: state-hash-format
- source: F-010 (35 Hz tic rate), F-024 (vanilla engine limits), REFERENCE_RUN_MANIFEST (run modes), ORACLE_KINDS (state-hash kind)
- generation_method: Define the state hash component vocabulary (6 components as a type union), entry interface with per-component SHA-256 hashes, payload interface, and frozen empty payloads for title-loop and demo-playback run modes in TypeScript.
- artifact_path: d:\Projects\bun-win32\doom_codex\src\oracles\stateHash.ts
- hash: generated-by-step-02-004
- consumers: 02-004, 02-005, 02-009, 17-010
- trust_level: high

## O-016

- oracle: framebuffer-hash-format
- source: F-010 (35 Hz tic rate), F-027 (14 PLAYPAL palettes), F-033 (320x200 internal framebuffer), REFERENCE_RUN_MANIFEST (run modes, screen dimensions), ORACLE_KINDS (framebuffer-hash kind)
- generation_method: Define framebuffer dimension constants, palette count, entry interface with SHA-256 hash and palette index, payload interface, and frozen empty payloads for title-loop and demo-playback run modes in TypeScript.
- artifact_path: d:\Projects\bun-win32\doom_codex\src\oracles\framebufferHash.ts
- hash: generated-by-step-02-005
- consumers: 02-005, 02-006, 02-008, 17-010
- trust_level: high

## O-017

- oracle: audio-hash-format
- source: F-010 (35 Hz tic rate), F-028 (DMX format 11025 Hz, distance attenuation), F-033 (44100 Hz output, 8 channels), REFERENCE_RUN_MANIFEST (run modes, audio config), ORACLE_KINDS (audio-hash kind)
- generation_method: Define audio constants (sample rate, max channels, DMX native rate, samples per tic), entry interface with SHA-256 hash of mixed SFX PCM and active channel count, payload interface, and frozen empty payloads for title-loop and demo-playback run modes in TypeScript.
- artifact_path: d:\Projects\bun-win32\doom_codex\src\oracles\audioHash.ts
- hash: generated-by-step-02-006
- consumers: 02-006, 02-007, 15-007, 17-010
- trust_level: high

## O-018

- oracle: music-event-log-format
- source: F-010 (35 Hz tic rate), F-025 (title/demo loop music assignments), F-026 (music quirks: MUS format, volume, device selection), F-033 (music device 3, volume 8), REFERENCE_RUN_MANIFEST (run modes, audio config), ORACLE_KINDS (music-event-log kind)
- generation_method: Define music event vocabulary (4 event kinds as discriminated union), MUS/MIDI channel constants, volume range constants, entry interfaces, payload interface, and frozen empty payloads for title-loop and demo-playback run modes in TypeScript.
- artifact_path: d:\Projects\bun-win32\doom_codex\src\oracles\musicEventLog.ts
- hash: generated-by-step-02-007
- consumers: 02-007, 02-008, 17-010
- trust_level: high

## O-019

- oracle: window-capture-feasibility-probe
- source: F-033 (640x480x32bpp display), F-036 (320x200 framebuffer), D-003 (GDI DIB presentation), user32.dll/gdi32.dll FFI symbol definitions
- generation_method: Define the GDI capture pipeline configuration (12 steps, Win32 constants, BITMAPINFOHEADER layout), FFI symbol definitions for direct dlopen of user32.dll and gdi32.dll, and a live captureDesktopRegion function that proves the full pipeline end-to-end from Bun FFI.
- artifact_path: d:\Projects\bun-win32\doom_codex\tools\reference\windowCaptureProbe.ts
- hash: generated-by-step-02-008
- consumers: 02-008, 02-009, 17-010
- trust_level: high

## O-020

- oracle: reference-run-isolation-probe
- source: F-031 (4-file sandbox composition), F-039 (GDI capture pipeline), REFERENCE_SANDBOX_POLICY (copy policy, hash expectations, cleanup rules)
- generation_method: Create a temporary sandbox under doom_codex/.sandboxes/, copy the 4 required reference files via Bun.write, verify SHA-256 hashes and byte sizes against SANDBOX_REQUIRED_FILES, prove config-file copy isolation by sentinel-write test, confirm source immutability, and clean up the sandbox.
- artifact_path: d:\Projects\bun-win32\doom_codex\tools\reference\isolationProbe.ts
- hash: generated-by-step-02-009
- consumers: 02-009, 02-010, 17-010
- trust_level: high

## O-021

- oracle: manual-gate-policy
- source: F-025 (title/demo loop), F-034 (input script format, scripted input), F-036 (framebuffer hash), F-037 (audio hash)
- generation_method: Define 6 manual gate domains (audio, input, music, timing, title-loop, visual), 3 verdict types (fail, inconclusive, pass), per-run-mode required-domain policy, ManualGateEntry/ManualGatePayload interfaces, frozen empty payloads for both run modes, and an isGateSetComplete validation function in TypeScript.
- artifact_path: d:\Projects\bun-win32\doom_codex\src\oracles\manualGatePolicy.ts
- hash: generated-by-step-02-010
- consumers: 02-010, 03-001, 17-010
- trust_level: high

## O-022

- oracle: level-start-state-hashes
- source: S-005 (DOOM1.WAD), O-013 (reference-run-manifest), O-015 (state-hash-format), F-180
- generation_method: Derive shareware E1 tic-0 level-start hashes at startup skill 2 by combining setupLevel map state, single-player mapthing spawn order, player reborn plus psprite setup, pristine automap defaults, and the resulting RNG indices, then hash the automap, player, rng, sectors, and thinkers components separately before hashing their ASCII-ordered concatenation for the combined digest.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\levelStartHashes.json
- hash: generated-by-step-17-001
- consumers: 17-001, 17-002, 17-009, 17-010
- trust_level: high

## O-023

- oracle: bundled-demo-sync
- source: F-021, F-172, F-174
- generation_method: Stream DEMO1, DEMO2, and DEMO3 through `src/demo/demoPlayback.ts`, convert each single-player tic to canonical `ticcmd_t`-compatible commands with zero `consistancy` and `chatchar`, hash the full ordered command stream plus 0/25/50/75/100 percent prefix checkpoints, and cross-check the attract demo sequence strings against the bundled DOS executables.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\demoSync.json
- hash: generated-by-step-17-002
- consumers: 17-002, 17-003, 17-010
- trust_level: high

## O-024

- oracle: scripted-input-core-mechanics
- source: F-182
- generation_method: Rebuild four synthetic command-driven parity scenarios entirely inside `doom_codex`: a rocket-launcher attack latch that holds `BT_ATTACK` across respawn until a ready-state release, a `BT_USE` latch against repeatable door special `1`, a manual blue-door denial (`line.special = 26`), and a tagged blue-object denial (`line.special = 99`). Hash the per-tic state streams for the attack and use scenarios, hash the denial summaries, and cross-check both blue-key denial strings against `DOOM.EXE` and `DOOMD.EXE`.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\scriptedMechanics.json
- hash: generated-by-step-17-003
- consumers: 17-003, 17-004, 17-010
- trust_level: high

## O-025

- oracle: framebuffer-crc-suite
- source: F-187
- generation_method: Render one deterministic synthetic scene for every `setBlocks` `3..11` viewport size at both high and low detail using the existing sky, visplane-span, solid-wall, two-sided-wall, masked-midtexture, patch-draw, sprite-projection, and masked-sprite draw modules; copy the resulting logical view into a canonical 320x200 framebuffer with `computeViewport()` offsets and low-detail horizontal duplication; then hash both the full frame and the view-window sub-rectangle, while cross-checking the `High detail`, `Low detail`, `Messages OFF`, and `Messages ON` menu strings against the bundled DOS executables.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\framebufferHashes.json
- hash: generated-by-step-17-004
- consumers: 17-004, 17-005, 17-010
- trust_level: high

## O-026

- oracle: menu-and-ui-timing-suite
- source: F-189
- generation_method: Regenerate the pure menu/front-end timing traces inside `doom_codex`: a 16-tic skull-cursor blink sequence from `tickMenu`, the strict mouse/joystick repeat-gate acceptance traces from `canAccept*Input` plus `mark*InputConsumed`, and the shareware TITLEPIC countdown trace from `tickFrontEnd` with the menu overlay opened for the first 5 idle tics and closed for the next 3. Hash each canonical trace payload, then cross-check the anchor UI strings `High detail`, `Low detail`, `Messages OFF`, `Messages ON`, and `press a key.` against both bundled DOS executables.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\menuTiming.json
- hash: generated-by-step-17-005
- consumers: 17-005, 17-006, 17-010
- trust_level: high

## O-027

- oracle: sound-and-music-suite
- source: F-190
- generation_method: Drive the existing audio parity harness with a same-origin `DSPISTOL` -> `DSSHOTGN` replacement trace, a looping `D_E1M1` music lifecycle (`set-volume`, `change-music`, same-track no-op, `pause-music`, `resume-music`, `stop-music`), and a silent-vs-music-only comparison. Hash the resulting per-tic SFX buffers, hash the dispatched MUS event summaries, and cross-check the anchor config strings `snd_channels`, `snd_musicdevice`, and `snd_sfxdevice` against both bundled DOS executables.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\audioHashes.json
- hash: generated-by-step-17-006
- consumers: 17-006, 17-009, 17-010
- trust_level: high

## O-028

- oracle: save-load-roundtrip-suite
- source: F-191
- generation_method: Serialize one synthetic C1 savegame through `writeSaveGameHeader`, `writeArchivedPlayers`, `writeArchivedWorld`, `writeArchivedMobjs`, `writeArchivedSpecials`, and `writeVanillaSaveGame`; hash each section plus the full byte stream; load the result back through `readLoadGame`; assert byte-identical reserialization; and cross-check the bundled DOS save/load anchor strings against `DOOM.EXE` and `DOOMD.EXE`.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\saveLoad.json
- hash: generated-by-step-17-007
- consumers: 17-007, 17-008, 17-010
- trust_level: high

## O-029

- oracle: vanilla-quirk-regression-suite
- source: F-183, F-194
- generation_method: Regenerate a 16-case quirk fixture inside `doom_codex` that locks the shared bundled-binary anchor strings plus the load-bearing player/sector, PCM mixer, OPL register, and OPL synthesis edge behaviors through the existing pure exported helpers, then verify the same expectations in `test/parity/quirk-regressions.test.ts`.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\quirkCases.json
- hash: generated-by-step-17-008
- consumers: 17-008, 17-009, 17-010
- trust_level: high

## O-030

- oracle: full-shareware-e1-acceptance
- source: F-025, F-180, F-181, F-189, F-190, O-022 through O-029, d:\Projects\bun-win32\doom\universal-doom\DOOM.EXE, d:\Projects\bun-win32\doom\universal-doom\DOOMD.EXE
- generation_method: Aggregate the shareware E1 acceptance boundary into one JSON manifest: exact E1M1 through E1M9 title/start-state coverage, the shareware attract-loop order and demo hashes, the locked audio parity hashes, the prior high-trust parity oracle dependencies, and the bundled DOS executable anchor strings that must survive into the final gate.
- artifact_path: d:\Projects\bun-win32\doom_codex\test\parity\fixtures\e1Acceptance.json
- hash: generated-by-step-17-009
- consumers: 17-009, 17-010
- trust_level: high

## O-031

- oracle: c1-complete
- source: O-001, O-002, O-012, O-030, d:\Projects\bun-win32\doom\universal-doom\DOOM.EXE, d:\Projects\bun-win32\doom\universal-doom\DOOMD.EXE
- generation_method: Aggregate the final C1 completion gate into one JSON manifest by pinning the exact required oracle chain, the shared DOS executable anchor strings that must appear in both bundled binaries, the canonical shareware attract-loop slotting, and the opening contract for the registered C2 target.
- artifact_path: d:\Projects\bun-win32\doom_codex\reference\manifests\c1-complete.json
- hash: generated-by-step-17-010
- consumers: 17-010
- trust_level: high
