# Source Catalog

## Authority Order

1. Local binaries, configs, and IWADs under `doom/` and `iwad/`.
2. Local reference manifests only as prior captured evidence, never as final proof.
3. id Software DOOM source, especially `linuxdoom-1.10`, from https://github.com/id-Software/DOOM.
4. Chocolate Doom 2.2.1 source, especially `d_main.c`, `g_game.c`, `p_*.c`, `r_*.c`, `s_sound.c`, `i_sound.c`, `m_menu.c`, `st_stuff.c`, `wi_stuff.c`, `f_finale.c`, `hu_stuff.c`, `am_map.c`, `p_saveg.c`, `tables.c`, and `m_fixed.c`, from https://github.com/chocolate-doom/chocolate-doom/releases/tag/chocolate-doom-2.2.1.
5. DoomWiki only for orientation, never final authority.

## Local Primary Sources

| id | path | role |
| --- | --- | --- |
| SRC-LOCAL-001 | `doom/DOOMD.EXE` | Primary DOS executable behavior authority for shareware DOOM 1.9 when it can be run or instrumented. |
| SRC-LOCAL-002 | `doom/DOOM.EXE` | Local merged executable with Chocolate Doom 2.2.1 Windows half, practical secondary executable authority. |
| SRC-LOCAL-003 | `doom/DOOM1.WAD` | Primary shareware IWAD data authority. |
| SRC-LOCAL-004 | `iwad/DOOM1.WAD` | Alternate local shareware IWAD copy; must hash-identically to the primary. |
| SRC-LOCAL-005 | `doom/default.cfg` | Vanilla-compatible control, audio, and UI defaults. |
| SRC-LOCAL-006 | `doom/chocolate-doom.cfg` | Host and compatibility flag defaults for the local Chocolate Doom reference. |

Chocolate Doom's project goal includes accurate DOS behavior including bugs, config, savegame, demo compatibility, display, and input feel. It is a strong secondary reference, but local binary proof wins when behavior differs or source reading is inconclusive.
