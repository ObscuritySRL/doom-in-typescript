# Define Source Authority Order

This document pins the canonical source authority order that every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must follow when answering a behavioral question. It freezes the canonical five tier authority ladder declared by `plan_vanilla_parity/SOURCE_CATALOG.md` (tier 1: local binaries, configs, and IWADs under `doom/` and `iwad/`; tier 2: local reference manifests under `reference/manifests/` only as prior captured evidence and never as final proof; tier 3: id Software DOOM source, especially `linuxdoom-1.10`, from `https://github.com/id-Software/DOOM`; tier 4: Chocolate Doom 2.2.1 source, especially `d_main.c`, `g_game.c`, `p_*.c`, `r_*.c`, `s_sound.c`, `i_sound.c`, `m_menu.c`, `st_stuff.c`, `wi_stuff.c`, `f_finale.c`, `hu_stuff.c`, `am_map.c`, `p_saveg.c`, `tables.c`, `m_fixed.c`, from `https://github.com/chocolate-doom/chocolate-doom/releases/tag/chocolate-doom-2.2.1`; tier 5: DoomWiki only for orientation and never as final authority), the canonical local primary sources `SRC-LOCAL-001`..`SRC-LOCAL-006` cataloged by `plan_vanilla_parity/SOURCE_CATALOG.md` (`doom/DOOMD.EXE`, `doom/DOOM.EXE`, `doom/DOOM1.WAD`, `iwad/DOOM1.WAD`, `doom/default.cfg`, `doom/chocolate-doom.cfg`), the canonical Chocolate Doom secondary reference rule (Chocolate Doom is a strong secondary reference because its project goal includes accurate DOS behavior including bugs, config, savegame, demo compatibility, display, and input feel; local binary proof wins when behavior differs or source reading is inconclusive), the canonical no-guess rule pinned by `plan_vanilla_parity/PROMPT.md` (every implementation step must add or update tests; if behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, the responsible step must create or update an oracle-capture step instead of guessing), the canonical four verifiable evidence sources named by the no-guess rule (`local binaries`, `IWAD data`, `id Software source`, `Chocolate Doom source`), the canonical CLAUDE.md authority ordering anchor (`Authority order for behavioral questions is in plan_fps/REFERENCE_ORACLES.md: local DOS binary > local IWAD > local Windows/Chocolate Doom exe > upstream Chocolate Doom source > community docs.`) inherited from the legacy plan_fps surface and now superseded by `plan_vanilla_parity/SOURCE_CATALOG.md`, and the canonical oracle redirect rule pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md` (oracle artifacts must be generated under writable paths such as `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/` and must never write inside `doom/`, `iwad/`, or `reference/`). Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 source authority order

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## authority tier count

5

## authority tier one

Local binaries, configs, and IWADs under `doom/` and `iwad/`. The local DOS executables (`doom/DOOMD.EXE`, `doom/DOOM.EXE`), the local shareware IWAD (`doom/DOOM1.WAD`, `iwad/DOOM1.WAD`), and the local configuration files (`doom/default.cfg`, `doom/chocolate-doom.cfg`) are the highest authority for any behavioral question because they are the actual proprietary id Software bytes the rebuild must match. When a behavioral question can be answered by running, reading, or instrumenting a local binary or IWAD, that answer is the final authority and overrides every lower tier. The redistribution-forbidden subset of this tier is pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md`, and the read-only handling of the `doom/` and `iwad/` roots is pinned by `plan_vanilla_parity/define-read-only-reference-roots.md`.

## authority tier two

Local reference manifests under `reference/manifests/` only as prior captured evidence, never as final proof. The committed derived JSON manifests under `reference/manifests/` (file hashes, package capability matrix, vanilla limits summary, WAD map summary, demo lump summary, configuration variable summary, source catalog, quirk manifest, title sequence, compatibility targets, and the C1 product target completeness manifest) carry no proprietary id Software bytes and may be referenced as prior captured evidence to orient a step. They are never the final authority because they are derived artifacts that can drift from the source bytes. When a manifest claim conflicts with tier one, tier one wins. The committed-but-read-only handling of the `reference/` root is pinned by `plan_vanilla_parity/define-read-only-reference-roots.md`.

## authority tier three

id Software DOOM source, especially `linuxdoom-1.10`, from `https://github.com/id-Software/DOOM`. The id Software source release is the original C source authority for the DOOM engine and is the highest authority when a tier-one local binary or IWAD cannot answer a behavioral question alone (for example when a question is about a non-running code path, an internal data layout, or a DOS-specific behavior). When the id Software source disagrees with tier one, tier one wins because the released DOS binaries are the actual artifacts the rebuild must match.

## authority tier four

Chocolate Doom 2.2.1 source, especially `d_main.c`, `g_game.c`, `p_*.c`, `r_*.c`, `s_sound.c`, `i_sound.c`, `m_menu.c`, `st_stuff.c`, `wi_stuff.c`, `f_finale.c`, `hu_stuff.c`, `am_map.c`, `p_saveg.c`, `tables.c`, and `m_fixed.c`, from `https://github.com/chocolate-doom/chocolate-doom/releases/tag/chocolate-doom-2.2.1`. Chocolate Doom is a strong secondary reference because its project goal includes accurate DOS behavior including bugs, config, savegame, demo compatibility, display, and input feel. When the id Software source is unclear or the question is about behavior the id Software source does not directly express (for example modern host integration that preserves DOS behavior), Chocolate Doom 2.2.1 source is the next authority. When Chocolate Doom 2.2.1 source disagrees with tier one or tier three, the higher tier wins because Chocolate Doom is a re-implementation, not the original artifact.

## authority tier five

DoomWiki only for orientation, never final authority. Community documentation cataloged by `plan_vanilla_parity/SOURCE_CATALOG.md` may be consulted to orient a step toward the right files, the right code paths, or the right behavioral question, but it is never the final authority because community documentation can be incomplete, outdated, or wrong. When DoomWiki disagrees with any of tier one through tier four, the higher tier wins.

## local primary source identifiers

- SRC-LOCAL-001
- SRC-LOCAL-002
- SRC-LOCAL-003
- SRC-LOCAL-004
- SRC-LOCAL-005
- SRC-LOCAL-006

## local primary source paths

- doom/DOOMD.EXE
- doom/DOOM.EXE
- doom/DOOM1.WAD
- iwad/DOOM1.WAD
- doom/default.cfg
- doom/chocolate-doom.cfg

## chocolate doom secondary reference rule

Chocolate Doom 2.2.1 is a strong secondary reference because its project goal includes accurate DOS behavior including bugs, config, savegame, demo compatibility, display, and input feel. The local Chocolate Doom Windows executable cataloged as `SRC-LOCAL-002` (`doom/DOOM.EXE`) is the practical secondary executable authority when the local DOS executable `SRC-LOCAL-001` (`doom/DOOMD.EXE`) cannot be run or instrumented. The Chocolate Doom 2.2.1 source release at `https://github.com/chocolate-doom/chocolate-doom/releases/tag/chocolate-doom-2.2.1` is the source-level secondary reference when tier-three id Software source is unclear or silent. In every case, local binary proof wins when behavior differs or source reading is inconclusive: tier one is final when it answers the question, and Chocolate Doom is consulted only when tier one and tier three together cannot resolve the question.

## no guess rule

Every implementation step must add or update tests. If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, the responsible step must create or update an oracle-capture step instead of guessing. The rule is anchored verbatim by `plan_vanilla_parity/PROMPT.md`: `If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, create or update an oracle-capture step instead of guessing.` Forward Ralph-loop agents must convert any unverifiable behavior into a write-locked oracle-capture step file under `plan_vanilla_parity/steps/02-NNN-<slug>.md` whose owned write roots are the canonical four allowed oracle output roots pinned by `plan_vanilla_parity/define-read-only-reference-roots.md` (`plan_vanilla_parity/final-gates/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, `test/vanilla_parity/oracles/`).

## verifiable evidence sources

- local binaries
- IWAD data
- id Software source
- Chocolate Doom source

## claude md authority ordering anchor

`CLAUDE.md` declares the legacy plan_fps surface authority order with the verbatim line ``Authority order for behavioral questions is in `plan_fps/REFERENCE_ORACLES.md`: local DOS binary > local IWAD > local Windows/Chocolate Doom exe > upstream Chocolate Doom source > community docs.`` That phrasing is preserved by the legacy `plan_fps/REFERENCE_ORACLES.md` Authority Order section but is now superseded for the active control center by `plan_vanilla_parity/SOURCE_CATALOG.md` (which lists the same five tiers in the same order with extra cataloged source files and the Chocolate Doom secondary reference rule). When a Ralph-loop step needs to consult the authority order, the active source is `plan_vanilla_parity/SOURCE_CATALOG.md`; the CLAUDE.md anchor remains valid because the two are in lockstep.

## oracle redirect rule

When the no-guess rule fires and a step needs an oracle-capture follow-up, the captured artifacts must be written under one of the canonical four allowed oracle output roots pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md`. The redirect rule reads in full: oracle artifacts must be generated under writable paths such as `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/`, and must never write inside `doom/`, `iwad/`, or `reference/`. The rule is also pinned by `plan_vanilla_parity/define-read-only-reference-roots.md` and is enforced for every step file write lock by `validateWritablePath` in `plan_vanilla_parity/validate-plan.ts`.

## allowed oracle output roots

- plan_vanilla_parity/final-gates/
- test/oracles/fixtures/
- test/vanilla_parity/acceptance/
- test/vanilla_parity/oracles/

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_fps/REFERENCE_ORACLES.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/REFERENCE_ORACLES.md
- plan_vanilla_parity/SOURCE_CATALOG.md
- plan_vanilla_parity/define-read-only-reference-roots.md
- plan_vanilla_parity/define-step-file-required-fields.md
- plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md
- plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md
- plan_vanilla_parity/validate-plan.ts
- plan_vanilla_parity/validate-plan.test.ts
- src/reference/policy.ts

## acceptance phrasing

Every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild answers behavioral questions by walking the canonical five tier authority ladder pinned by `plan_vanilla_parity/SOURCE_CATALOG.md`: tier one is the local binaries, configs, and IWADs under `doom/` and `iwad/` (the six cataloged identifiers `SRC-LOCAL-001`, `SRC-LOCAL-002`, `SRC-LOCAL-003`, `SRC-LOCAL-004`, `SRC-LOCAL-005`, `SRC-LOCAL-006` resolving to the six paths `doom/DOOMD.EXE`, `doom/DOOM.EXE`, `doom/DOOM1.WAD`, `iwad/DOOM1.WAD`, `doom/default.cfg`, `doom/chocolate-doom.cfg`); tier two is the local reference manifests under `reference/manifests/` as prior captured evidence and never final proof; tier three is the id Software DOOM source from `https://github.com/id-Software/DOOM`; tier four is the Chocolate Doom 2.2.1 source from `https://github.com/chocolate-doom/chocolate-doom/releases/tag/chocolate-doom-2.2.1`; tier five is DoomWiki for orientation only. When a behavioral question cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, the responsible step must create or update an oracle-capture step instead of guessing, and the captured artifacts must be written under one of the canonical four allowed oracle output roots `plan_vanilla_parity/final-gates/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `test/vanilla_parity/oracles/`, never inside `doom/`, `iwad/`, or `reference/`.
