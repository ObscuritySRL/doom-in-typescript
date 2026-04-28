/**
 * Audit ledger for the vanilla DOOM 1.9 map lump bundle boundary
 * resolver, the `P_SetupLevel()` pipeline that resolves a map name
 * (`"E1M1"` for shareware/registered/Ultimate DOOM, `"MAP01"` for
 * commercial DOOM 2 / Final DOOM) to its directory marker via
 * `W_GetNumForName(lumpname)`, then pulls 10 fixed-order data lumps
 * (`THINGS`, `LINEDEFS`, `SIDEDEFS`, `VERTEXES`, `SEGS`, `SSECTORS`,
 * `NODES`, `SECTORS`, `REJECT`, `BLOCKMAP`) at hard-coded offsets
 * `lumpnum + ML_THINGS .. lumpnum + ML_BLOCKMAP` (1..10) relative
 * to the marker.
 *
 * This module pins the runtime contract one level deeper than the
 * prior 05-001..05-004 marker / lookup audits, the 05-005 PLAYPAL /
 * COLORMAP audit, the 05-006 patch picture format audit, the 05-007
 * flat namespace audit, the 05-008 PNAMES audit, the 05-009 / 05-010
 * TEXTURE1 / TEXTURE2 audits, the 05-011 sprite namespace audit, the
 * 05-012 sound effect lump audit, the 05-013 music MUS lump audit,
 * and the 05-014 demo lump audit: the `E#M#` map-name format
 * produced by `sprintf(lumpname, "E%dM%d", gameepisode, gamemap)`,
 * the `MAP##` map-name format produced by
 * `sprintf(lumpname, "MAP%02d", gamemap)`, the upstream
 * `enum { ML_LABEL, ML_THINGS, ML_LINEDEFS, ML_SIDEDEFS, ML_VERTEXES,
 *  ML_SEGS, ML_SSECTORS, ML_NODES, ML_SECTORS, ML_REJECT,
 *  ML_BLOCKMAP }` declaration in `linuxdoom-1.10/doomdata.h`, the
 * `lumpnum = W_GetNumForName(lumpname)` map-marker resolution that
 * issues a fatal `I_Error` on miss, the `lumpnum + ML_<lumpkind>`
 * positional addressing of every data lump, the empirical
 * `marker.size === 0` invariant (every map header lump in the
 * shareware DOOM1.WAD is a zero-byte placeholder), the absence of any
 * `S_START` / `S_END` / `F_START` / `F_END` style marker range around
 * the bundle (vanilla addresses each data lump by absolute index,
 * never by marker-bounded range), and the shareware `doom/DOOM1.WAD`
 * axis pinning 9 map bundles (E1M1..E1M9) at directory indices
 * 6, 17, 28, 39, 50, 61, 72, 83, and 94. The accompanying focused
 * test imports the ledger plus a self-contained `resolveMapBundle`
 * runtime exposed by this module and cross-checks every audit entry
 * against the runtime behavior plus the live shareware
 * `doom/DOOM1.WAD` oracle.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (`p_setup.c`,
 *      `g_game.c`, `doomdata.h`),
 *   5. Chocolate Doom 2.2.1 source (`src/doom/p_setup.c`,
 *      `src/doom/g_game.c`).
 *
 * The `ML_*` enum offsets and the `lumpnum + ML_<kind>` positional
 * load pattern are pinned against authority 4 (id Software
 * `linuxdoom-1.10/p_setup.c` `P_SetupLevel` plus
 * `linuxdoom-1.10/doomdata.h` `enum { ML_LABEL, ... }`). The
 * `sprintf(lumpname, "E%dM%d", gameepisode, gamemap)` map-name
 * construction and the `lumpnum = W_GetNumForName(lumpname)`
 * resolution are pinned against authority 4 (linuxdoom-1.10
 * `g_game.c` `G_DoLoadLevel` and `p_setup.c` `P_SetupLevel`). The
 * `marker.size === 0` and `data lumps follow at offsets 1..10`
 * empirical invariants are pinned against authority 2 (the live
 * shareware IWAD itself), and re-derived from the on-disk file every
 * test run.
 */

import { createHash } from 'node:crypto';

import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract of the map lump bundle boundary resolver, pinned to its
 * upstream declaration.
 */
export interface MapLumpBundleAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'map-bundle-name-format-doom1-e-m'
    | 'map-bundle-name-format-doom2-map-nn'
    | 'map-bundle-name-lookup-via-w-getnumforname'
    | 'map-bundle-marker-size-zero'
    | 'map-bundle-ml-label-offset-zero'
    | 'map-bundle-ml-things-offset-one'
    | 'map-bundle-ml-linedefs-offset-two'
    | 'map-bundle-ml-sidedefs-offset-three'
    | 'map-bundle-ml-vertexes-offset-four'
    | 'map-bundle-ml-segs-offset-five'
    | 'map-bundle-ml-ssectors-offset-six'
    | 'map-bundle-ml-nodes-offset-seven'
    | 'map-bundle-ml-sectors-offset-eight'
    | 'map-bundle-ml-reject-offset-nine'
    | 'map-bundle-ml-blockmap-offset-ten'
    | 'map-bundle-data-lump-count-ten'
    | 'map-bundle-total-lump-count-eleven'
    | 'map-bundle-positional-load-via-lumpnum-plus-offset'
    | 'map-bundle-no-marker-range'
    | 'map-bundle-shareware-doom1-nine-maps';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'map-marker-lump' | 'map-data-lump' | 'P_SetupLevel' | 'G_DoLoadLevel' | 'doomdata.h-ML-enum' | 'resolveMapBundle' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the upstream tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/p_setup.c' | 'linuxdoom-1.10/g_game.c' | 'linuxdoom-1.10/doomdata.h' | 'src/doom/p_setup.c' | 'src/doom/g_game.c' | 'shareware/DOOM1.WAD';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and
 * runtime parser contract the runtime map lump bundle boundary
 * resolver must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const MAP_LUMP_BUNDLE_AUDIT: readonly MapLumpBundleAuditEntry[] = [
  {
    id: 'map-bundle-name-format-doom1-e-m',
    subject: 'G_DoLoadLevel',
    cSourceLines: [
      'if ( gamemode == commercial)',
      '    sprintf (lumpname, "map%02i", gamemap);',
      'else',
      '{',
      "    lumpname[0] = 'E';",
      "    lumpname[1] = '0'+gameepisode;",
      "    lumpname[2] = 'M';",
      "    lumpname[3] = '0'+gamemap;",
      '    lumpname[4] = 0;',
      '}',
    ],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      "Vanilla `G_DoLoadLevel` formats the map marker name for shareware / registered / Ultimate DOOM as `E<gameepisode>M<gamemap>` (4 ASCII characters: `E`, episode digit, `M`, map digit). Episode and map digits are produced by `'0'+gameepisode` / `'0'+gamemap`, so episode and map values are constrained to 0..9 (vanilla shareware uses episode 1, maps 1..9). The runtime models this with `MAP_NAME_PATTERN_DOOM1 = /^E[1-9]M[1-9]$/` exposed by `parse-map-lump-bundle-boundaries.ts`.",
  },
  {
    id: 'map-bundle-name-format-doom2-map-nn',
    subject: 'G_DoLoadLevel',
    cSourceLines: ['if ( gamemode == commercial)', '    sprintf (lumpname, "map%02i", gamemap);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'Vanilla `G_DoLoadLevel` formats the map marker name for commercial DOOM 2 / Final DOOM as `MAP<map>` zero-padded to 2 digits (5 ASCII characters total). The on-disk lumps are uppercased by `W_GetNumForName` before hashing, so the WAD directory stores names as `MAP01`..`MAP32`. Commercial DOOM 2 uses maps 1..32. The runtime models this with `MAP_NAME_PATTERN_DOOM2 = /^MAP(0[1-9]|[12][0-9]|3[0-2])$/` exposed by `parse-map-lump-bundle-boundaries.ts`.',
  },
  {
    id: 'map-bundle-name-lookup-via-w-getnumforname',
    subject: 'P_SetupLevel',
    cSourceLines: ['lumpnum = W_GetNumForName (lumpname);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'Vanilla `P_SetupLevel` resolves the constructed map marker name via `W_GetNumForName`, which calls through `W_CheckNumForName` and throws a fatal `I_Error("W_GetNumForName: %s not found!")` on miss. A registered-only map requested while running on shareware would be a fatal error. The runtime models this with `resolveMapBundle` throwing `Error` whose message matches `W_GetNumForName: <name> not found!` on a missing map.',
  },
  {
    id: 'map-bundle-marker-size-zero',
    subject: 'map-marker-lump',
    cSourceLines: ['lumpnum = W_GetNumForName (lumpname);'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'Vanilla DOOM map header lumps (e.g., E1M1, MAP01) carry zero data — they are pure positional markers in the WAD directory. The empirical invariant `directoryEntry(mapName).size === 0` holds for every map header lump in the shareware `doom/DOOM1.WAD` (E1M1 through E1M9) and is conventional in every official id IWAD. The runtime models this with `MAP_MARKER_LUMP_SIZE === 0` exposed by `parse-map-lump-bundle-boundaries.ts`.',
  },
  {
    id: 'map-bundle-ml-label-offset-zero',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['enum {', '    ML_LABEL,\t\t// A separator, name, MAPxx', '    ML_THINGS,\t\t// Monsters, items..'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant:
      'The `linuxdoom-1.10/doomdata.h` `enum` block declares `ML_LABEL` as the FIRST entry, giving it implicit value 0. This is the marker lump itself (`lumpnum + ML_LABEL == lumpnum`). The runtime models this with `MAP_BUNDLE_ML_LABEL === 0` exposed by `parse-map-lump-bundle-boundaries.ts`.',
  },
  {
    id: 'map-bundle-ml-things-offset-one',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_THINGS,\t\t// Monsters, items..', 'P_LoadThings (lumpnum+ML_THINGS);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant:
      '`ML_THINGS` is declared as the SECOND `enum` entry (implicit value 1) in `linuxdoom-1.10/doomdata.h`, and `P_SetupLevel` loads things via `P_LoadThings(lumpnum+ML_THINGS)`. The data lump immediately following the marker is THINGS. The runtime models this with `MAP_BUNDLE_ML_THINGS === 1`.',
  },
  {
    id: 'map-bundle-ml-linedefs-offset-two',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_LINEDEFS,\t// LineDefs, from editing', 'P_LoadLineDefs (lumpnum+ML_LINEDEFS);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_LINEDEFS` is declared as the THIRD `enum` entry (implicit value 2) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_LINEDEFS === 2`.',
  },
  {
    id: 'map-bundle-ml-sidedefs-offset-three',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_SIDEDEFS,\t// SideDefs, from editing', 'P_LoadSideDefs (lumpnum+ML_SIDEDEFS);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_SIDEDEFS` is declared as the FOURTH `enum` entry (implicit value 3) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_SIDEDEFS === 3`.',
  },
  {
    id: 'map-bundle-ml-vertexes-offset-four',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_VERTEXES,\t// Vertices, edited and BSP splits generated', 'P_LoadVertexes (lumpnum+ML_VERTEXES);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_VERTEXES` is declared as the FIFTH `enum` entry (implicit value 4) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_VERTEXES === 4`.',
  },
  {
    id: 'map-bundle-ml-segs-offset-five',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_SEGS,\t\t// LineSegs, from LineDefs split by BSP', 'P_LoadSegs (lumpnum+ML_SEGS);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_SEGS` is declared as the SIXTH `enum` entry (implicit value 5) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_SEGS === 5`.',
  },
  {
    id: 'map-bundle-ml-ssectors-offset-six',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_SSECTORS,\t// SubSectors, list of LineSegs', 'P_LoadSubsectors (lumpnum+ML_SSECTORS);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_SSECTORS` is declared as the SEVENTH `enum` entry (implicit value 6) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_SSECTORS === 6`.',
  },
  {
    id: 'map-bundle-ml-nodes-offset-seven',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_NODES,\t\t// BSP nodes', 'P_LoadNodes (lumpnum+ML_NODES);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_NODES` is declared as the EIGHTH `enum` entry (implicit value 7) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_NODES === 7`.',
  },
  {
    id: 'map-bundle-ml-sectors-offset-eight',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_SECTORS,\t\t// Sectors, from editing', 'P_LoadSectors (lumpnum+ML_SECTORS);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_SECTORS` is declared as the NINTH `enum` entry (implicit value 8) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_SECTORS === 8`.',
  },
  {
    id: 'map-bundle-ml-reject-offset-nine',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_REJECT,\t\t// LUT, sector-sector visibility', 'P_LoadReject (lumpnum+ML_REJECT);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_REJECT` is declared as the TENTH `enum` entry (implicit value 9) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_REJECT === 9`.',
  },
  {
    id: 'map-bundle-ml-blockmap-offset-ten',
    subject: 'doomdata.h-ML-enum',
    cSourceLines: ['ML_BLOCKMAP\t\t// LUT, motion clipping, walls/grid element', 'P_LoadBlockMap (lumpnum+ML_BLOCKMAP);'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant: '`ML_BLOCKMAP` is declared as the ELEVENTH and FINAL `enum` entry (implicit value 10) in `linuxdoom-1.10/doomdata.h`. The runtime models this with `MAP_BUNDLE_ML_BLOCKMAP === 10`.',
  },
  {
    id: 'map-bundle-data-lump-count-ten',
    subject: 'P_SetupLevel',
    cSourceLines: [
      'P_LoadVertexes (lumpnum+ML_VERTEXES);',
      'P_LoadSectors (lumpnum+ML_SECTORS);',
      'P_LoadSideDefs (lumpnum+ML_SIDEDEFS);',
      'P_LoadLineDefs (lumpnum+ML_LINEDEFS);',
      'P_LoadSubsectors (lumpnum+ML_SSECTORS);',
      'P_LoadNodes (lumpnum+ML_NODES);',
      'P_LoadSegs (lumpnum+ML_SEGS);',
      'P_LoadThings (lumpnum+ML_THINGS);',
      'P_LoadReject (lumpnum+ML_REJECT);',
      'P_LoadBlockMap (lumpnum+ML_BLOCKMAP);',
    ],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'Vanilla `P_SetupLevel` issues exactly 10 `P_Load<kind>(lumpnum + ML_<kind>)` calls — one per data lump kind: VERTEXES, SECTORS, SIDEDEFS, LINEDEFS, SSECTORS, NODES, SEGS, THINGS, REJECT, BLOCKMAP. The data lump count therefore equals 10 (excluding the ML_LABEL marker). The runtime models this with `MAP_BUNDLE_DATA_LUMP_COUNT === 10`.',
  },
  {
    id: 'map-bundle-total-lump-count-eleven',
    subject: 'P_SetupLevel',
    cSourceLines: ['enum {', '    ML_LABEL,', '    ML_THINGS,', '    ML_LINEDEFS,', '    ML_SIDEDEFS,', '    ML_VERTEXES,', '    ML_SEGS,', '    ML_SSECTORS,', '    ML_NODES,', '    ML_SECTORS,', '    ML_REJECT,', '    ML_BLOCKMAP', '};'],
    referenceSourceFile: 'linuxdoom-1.10/doomdata.h',
    invariant:
      'The `linuxdoom-1.10/doomdata.h` `enum` block has exactly 11 entries (`ML_LABEL` plus the 10 data lump kinds). The contiguous block in the WAD directory therefore spans 11 lumps: `[markerIndex .. markerIndex + 10]` inclusive. The runtime models this with `MAP_BUNDLE_TOTAL_LUMP_COUNT === 11`.',
  },
  {
    id: 'map-bundle-positional-load-via-lumpnum-plus-offset',
    subject: 'P_SetupLevel',
    cSourceLines: ['P_LoadVertexes (lumpnum+ML_VERTEXES);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      "Vanilla `P_SetupLevel` addresses every data lump by ABSOLUTE directory index (`lumpnum + ML_<kind>`), never by name lookup. The data lumps therefore must appear in the WAD directory in the canonical fixed order `THINGS`, `LINEDEFS`, `SIDEDEFS`, `VERTEXES`, `SEGS`, `SSECTORS`, `NODES`, `SECTORS`, `REJECT`, `BLOCKMAP` — out-of-order placement would silently corrupt the level. The runtime models this with `MAP_BUNDLE_LUMP_NAMES === ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']`.",
  },
  {
    id: 'map-bundle-no-marker-range',
    subject: 'P_SetupLevel',
    cSourceLines: ['lumpnum = W_GetNumForName (lumpname);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'Map bundles in vanilla DOOM 1.9 are NOT enclosed by an `S_START` / `S_END`, `F_START` / `F_END`, or `P_START` / `P_END` style marker range. Each map header lump is looked up by its full name via `W_GetNumForName` directly. The 11 lumps spanning the bundle therefore live at fixed positions in the WAD directory anywhere between the IWAD identifier and the EOF; in shareware DOOM1.WAD they sit at directory indices 6..16 (E1M1), 17..27 (E1M2), 28..38 (E1M3), 39..49 (E1M4), 50..60 (E1M5), 61..71 (E1M6), 72..82 (E1M7), 83..93 (E1M8), and 94..104 (E1M9). The runtime models this with `resolveMapBundle` reading directly from the directory without any marker-range scan.',
  },
  {
    id: 'map-bundle-shareware-doom1-nine-maps',
    subject: 'shareware-doom1.wad',
    cSourceLines: ["lumpname[0] = 'E';", "lumpname[1] = '0'+gameepisode;", "lumpname[2] = 'M';", "lumpname[3] = '0'+gamemap;"],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The shareware `doom/DOOM1.WAD` ships exactly 9 map header lumps (E1M1 through E1M9) at directory indices 6, 17, 28, 39, 50, 61, 72, 83, and 94. The 9 markers plus 9 * 10 = 90 data lumps total 99 directory entries, matching the `lumpCategories.map-marker: 9` and `lumpCategories.map-data: 90` fields in `reference/manifests/wad-map-summary.json`. The runtime models this with the oracle entry whose `mapBundleCount === 9`, `firstMapBundleIndex === 6`, and `lastMapBundleIndex === 94`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface MapLumpBundleDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const MAP_LUMP_BUNDLE_DERIVED_INVARIANTS: readonly MapLumpBundleDerivedInvariant[] = [
  {
    id: 'MAP_NAME_PATTERN_DOOM1_MATCHES_E_DIGIT_M_DIGIT',
    description: "`MAP_NAME_PATTERN_DOOM1.test(\"E1M1\") === true`. Matches the upstream `'E' '0'+gameepisode 'M' '0'+gamemap` formatting in `G_DoLoadLevel` for shareware/registered/Ultimate DOOM.",
  },
  {
    id: 'MAP_NAME_PATTERN_DOOM2_MATCHES_MAP_TWO_DIGITS',
    description: '`MAP_NAME_PATTERN_DOOM2.test("MAP01") === true`. Matches the upstream `sprintf(lumpname, "map%02i", gamemap)` formatting for commercial DOOM 2 / Final DOOM.',
  },
  {
    id: 'MAP_MARKER_LUMP_SIZE_EQUALS_ZERO',
    description: '`MAP_MARKER_LUMP_SIZE === 0`. Matches the empirical invariant that every map header lump in the shareware DOOM1.WAD carries zero data.',
  },
  {
    id: 'MAP_BUNDLE_ML_LABEL_EQUALS_ZERO',
    description: '`MAP_BUNDLE_ML_LABEL === 0`. Matches the upstream `enum { ML_LABEL, ... }` first-position implicit value 0.',
  },
  {
    id: 'MAP_BUNDLE_ML_THINGS_EQUALS_ONE',
    description: '`MAP_BUNDLE_ML_THINGS === 1`. Matches the upstream `enum { ML_LABEL, ML_THINGS, ... }` second-position implicit value 1.',
  },
  {
    id: 'MAP_BUNDLE_ML_LINEDEFS_EQUALS_TWO',
    description: '`MAP_BUNDLE_ML_LINEDEFS === 2`. Matches the upstream third-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_ML_SIDEDEFS_EQUALS_THREE',
    description: '`MAP_BUNDLE_ML_SIDEDEFS === 3`. Matches the upstream fourth-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_ML_VERTEXES_EQUALS_FOUR',
    description: '`MAP_BUNDLE_ML_VERTEXES === 4`. Matches the upstream fifth-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_ML_SEGS_EQUALS_FIVE',
    description: '`MAP_BUNDLE_ML_SEGS === 5`. Matches the upstream sixth-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_ML_SSECTORS_EQUALS_SIX',
    description: '`MAP_BUNDLE_ML_SSECTORS === 6`. Matches the upstream seventh-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_ML_NODES_EQUALS_SEVEN',
    description: '`MAP_BUNDLE_ML_NODES === 7`. Matches the upstream eighth-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_ML_SECTORS_EQUALS_EIGHT',
    description: '`MAP_BUNDLE_ML_SECTORS === 8`. Matches the upstream ninth-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_ML_REJECT_EQUALS_NINE',
    description: '`MAP_BUNDLE_ML_REJECT === 9`. Matches the upstream tenth-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_ML_BLOCKMAP_EQUALS_TEN',
    description: '`MAP_BUNDLE_ML_BLOCKMAP === 10`. Matches the upstream eleventh-position `enum` value.',
  },
  {
    id: 'MAP_BUNDLE_DATA_LUMP_COUNT_EQUALS_TEN',
    description: '`MAP_BUNDLE_DATA_LUMP_COUNT === 10`. Matches the 10 `P_Load<kind>(lumpnum + ML_<kind>)` call sites in `P_SetupLevel`.',
  },
  {
    id: 'MAP_BUNDLE_TOTAL_LUMP_COUNT_EQUALS_ELEVEN',
    description: '`MAP_BUNDLE_TOTAL_LUMP_COUNT === 11`. Matches the 11-entry `enum { ML_LABEL .. ML_BLOCKMAP }` in `doomdata.h`.',
  },
  {
    id: 'MAP_BUNDLE_LUMP_NAMES_FIXED_ORDER',
    description: '`MAP_BUNDLE_LUMP_NAMES` equals `["THINGS", "LINEDEFS", "SIDEDEFS", "VERTEXES", "SEGS", "SSECTORS", "NODES", "SECTORS", "REJECT", "BLOCKMAP"]`. Matches the upstream `enum` order at the data-lump indices 1..10.',
  },
  {
    id: 'RESOLVE_MAP_BUNDLE_RETURNS_FROZEN_BUNDLE',
    description: 'A successful `resolveMapBundle(directory, mapName)` returns an object that is `Object.isFrozen` and whose `dataLumps` array is `Object.isFrozen`.',
  },
  {
    id: 'RESOLVE_MAP_BUNDLE_REJECTS_MISSING_MAP_NAME',
    description:
      '`resolveMapBundle(directory, "E9M9")` (with E9M9 absent from the directory) throws `Error` whose message starts with `W_GetNumForName: E9M9 not found!`. Matches the upstream `I_Error("W_GetNumForName: %s not found!", ...)` semantics.',
  },
  {
    id: 'RESOLVE_MAP_BUNDLE_REJECTS_DATA_LUMP_OUT_OF_ORDER',
    description: '`resolveMapBundle(directory, mapName)` throws `Error` when the directory entry at `markerIndex + ML_<kind>` does not match the expected lump name. Matches the upstream positional addressing requirement.',
  },
  {
    id: 'RESOLVE_MAP_BUNDLE_REJECTS_BUNDLE_RUNNING_OFF_DIRECTORY_END',
    description: '`resolveMapBundle(directory, mapName)` throws `Error` when fewer than `MAP_BUNDLE_DATA_LUMP_COUNT` lumps follow the marker.',
  },
  {
    id: 'IS_MAP_MARKER_NAME_ACCEPTS_E1M1_AND_MAP01',
    description: '`isMapMarkerName("E1M1") === true` and `isMapMarkerName("MAP01") === true`. Mirrors the upstream `gamemode == commercial` branch.',
  },
  {
    id: 'IS_MAP_MARKER_NAME_REJECTS_NON_MAP_NAMES',
    description: '`isMapMarkerName("PLAYPAL") === false`, `isMapMarkerName("THINGS") === false`. Mirrors the upstream `lumpname` exact format.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Regex pattern matching the DOOM 1 / Ultimate DOOM map marker name format `E#M#` (episode 1..9, map 1..9). */
export const MAP_NAME_PATTERN_DOOM1 = /^E[1-9]M[1-9]$/;

/** Regex pattern matching the DOOM 2 / Final DOOM map marker name format `MAP##` (zero-padded map 01..32). */
export const MAP_NAME_PATTERN_DOOM2 = /^MAP(0[1-9]|[12][0-9]|3[0-2])$/;

/** Empirical byte size of every map marker lump (the marker carries no data, only its directory position). */
export const MAP_MARKER_LUMP_SIZE = 0;

/** `ML_LABEL` enum value (the marker itself). */
export const MAP_BUNDLE_ML_LABEL = 0;

/** `ML_THINGS` enum value. */
export const MAP_BUNDLE_ML_THINGS = 1;

/** `ML_LINEDEFS` enum value. */
export const MAP_BUNDLE_ML_LINEDEFS = 2;

/** `ML_SIDEDEFS` enum value. */
export const MAP_BUNDLE_ML_SIDEDEFS = 3;

/** `ML_VERTEXES` enum value. */
export const MAP_BUNDLE_ML_VERTEXES = 4;

/** `ML_SEGS` enum value. */
export const MAP_BUNDLE_ML_SEGS = 5;

/** `ML_SSECTORS` enum value. */
export const MAP_BUNDLE_ML_SSECTORS = 6;

/** `ML_NODES` enum value. */
export const MAP_BUNDLE_ML_NODES = 7;

/** `ML_SECTORS` enum value. */
export const MAP_BUNDLE_ML_SECTORS = 8;

/** `ML_REJECT` enum value. */
export const MAP_BUNDLE_ML_REJECT = 9;

/** `ML_BLOCKMAP` enum value (the last `enum` entry). */
export const MAP_BUNDLE_ML_BLOCKMAP = 10;

/** Number of data lumps (excluding the ML_LABEL marker) in a map bundle. */
export const MAP_BUNDLE_DATA_LUMP_COUNT = 10;

/** Total number of lumps in a map bundle (1 marker + 10 data lumps). */
export const MAP_BUNDLE_TOTAL_LUMP_COUNT = 11;

/**
 * Fixed canonical order of the 10 data lump names that follow a map
 * marker, indexed so `MAP_BUNDLE_LUMP_NAMES[i]` is the name at offset
 * `markerIndex + i + 1` in the WAD directory.
 *
 * Matches the upstream `enum { ML_LABEL, ML_THINGS, ML_LINEDEFS,
 * ML_SIDEDEFS, ML_VERTEXES, ML_SEGS, ML_SSECTORS, ML_NODES,
 * ML_SECTORS, ML_REJECT, ML_BLOCKMAP }` declaration in
 * `linuxdoom-1.10/doomdata.h`.
 */
export const MAP_BUNDLE_LUMP_NAMES: readonly string[] = Object.freeze(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']);

/** Resolved bundle of one map's marker plus 10 data lumps. */
export interface MapLumpBundle {
  /** Map marker name (uppercase, NUL-stripped). */
  readonly mapName: string;
  /** Directory index of the map marker lump. */
  readonly markerIndex: number;
  /** The map marker directory entry. */
  readonly marker: DirectoryEntry;
  /** The 10 data lump directory entries in canonical fixed order. */
  readonly dataLumps: readonly DirectoryEntry[];
  /** Sum of the byte sizes of all 10 data lumps. */
  readonly totalDataBytes: number;
}

/**
 * Resolve a map's marker and its 10 fixed-order data lumps.
 *
 * Mirrors the vanilla `P_SetupLevel` resolution path:
 *  1. lookup the marker via `W_GetNumForName(mapName)` — fatal on miss,
 *  2. address every data lump by `lumpnum + ML_<kind>`, validating
 *     the on-disk name matches the expected canonical order.
 *
 * @param directory - Parsed WAD directory entries.
 * @param mapName - Uppercase map marker name (e.g., `E1M1`, `MAP01`).
 * @returns Frozen {@link MapLumpBundle}.
 * @throws {Error} If the map marker is not found, the bundle runs off
 *   the end of the directory, or any data lump is out of order.
 */
export function resolveMapBundle(directory: readonly DirectoryEntry[], mapName: string): MapLumpBundle {
  const upper = mapName.toUpperCase();
  let markerIndex = -1;
  for (let i = 0; i < directory.length; i += 1) {
    if (directory[i]!.name.toUpperCase() === upper) {
      markerIndex = i;
    }
  }
  if (markerIndex === -1) {
    throw new Error(`W_GetNumForName: ${upper} not found!`);
  }
  if (markerIndex + MAP_BUNDLE_DATA_LUMP_COUNT >= directory.length) {
    throw new Error(`resolveMapBundle: bundle for ${upper} starting at index ${markerIndex} runs off the directory end (length ${directory.length})`);
  }

  const marker = directory[markerIndex]!;
  const dataLumps: DirectoryEntry[] = new Array(MAP_BUNDLE_DATA_LUMP_COUNT);
  let totalDataBytes = 0;
  for (let offset = 0; offset < MAP_BUNDLE_DATA_LUMP_COUNT; offset += 1) {
    const expectedName = MAP_BUNDLE_LUMP_NAMES[offset]!;
    const dataIndex = markerIndex + offset + 1;
    const dataEntry = directory[dataIndex]!;
    if (dataEntry.name.toUpperCase() !== expectedName) {
      throw new Error(`resolveMapBundle: bundle for ${upper} expected ${expectedName} at index ${dataIndex}, got ${dataEntry.name}`);
    }
    dataLumps[offset] = dataEntry;
    totalDataBytes += dataEntry.size;
  }

  return Object.freeze({
    mapName: upper,
    markerIndex,
    marker,
    dataLumps: Object.freeze(dataLumps),
    totalDataBytes,
  });
}

/**
 * Predicate identifying map marker lumps by name.
 *
 * Matches both vanilla DOOM 1 / Ultimate DOOM `E#M#` and DOOM 2 /
 * Final DOOM `MAP##` formats. Names are uppercased before testing
 * (`W_CheckNumForName` performs the same uppercase fold).
 *
 * @param name - Lump name to test.
 */
export function isMapMarkerName(name: string): boolean {
  const upper = name.toUpperCase();
  return MAP_NAME_PATTERN_DOOM1.test(upper) || MAP_NAME_PATTERN_DOOM2.test(upper);
}

/**
 * Decoded `(episode, map)` pair from a map marker name. `null` for
 * non-marker names.
 */
export interface MapMarkerNameFields {
  /** Map name format kind. */
  readonly kind: 'doom1' | 'doom2';
  /** Episode number (1..9 for doom1, always 1 for doom2). */
  readonly episode: number;
  /** Map number (1..9 for doom1, 1..32 for doom2). */
  readonly map: number;
}

/**
 * Decode the `(episode, map)` pair from a map marker name.
 *
 * Returns `null` for names that are not in either canonical format.
 * Mirrors the inverse of the upstream `sprintf` formatting in
 * `G_DoLoadLevel`.
 *
 * @param name - Map marker name to decode.
 */
export function parseMapMarkerName(name: string): MapMarkerNameFields | null {
  const upper = name.toUpperCase();
  if (MAP_NAME_PATTERN_DOOM1.test(upper)) {
    return Object.freeze({
      kind: 'doom1',
      episode: parseInt(upper[1]!, 10),
      map: parseInt(upper[3]!, 10),
    });
  }
  if (MAP_NAME_PATTERN_DOOM2.test(upper)) {
    return Object.freeze({
      kind: 'doom2',
      episode: 1,
      map: parseInt(upper.slice(3), 10),
    });
  }
  return null;
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-map-lump-bundle-boundaries.ts`. The cross-check
 * helper consumes this shape so the focused test can both verify the
 * live runtime exports and exercise a deliberately tampered snapshot
 * to prove the failure modes are observable.
 */
export interface MapLumpBundleRuntimeSnapshot {
  readonly mapNamePatternDoom1AcceptsE1M1: boolean;
  readonly mapNamePatternDoom2AcceptsMap01: boolean;
  readonly mapMarkerLumpSize: number;
  readonly mapBundleMlLabel: number;
  readonly mapBundleMlThings: number;
  readonly mapBundleMlLinedefs: number;
  readonly mapBundleMlSidedefs: number;
  readonly mapBundleMlVertexes: number;
  readonly mapBundleMlSegs: number;
  readonly mapBundleMlSsectors: number;
  readonly mapBundleMlNodes: number;
  readonly mapBundleMlSectors: number;
  readonly mapBundleMlReject: number;
  readonly mapBundleMlBlockmap: number;
  readonly mapBundleDataLumpCount: number;
  readonly mapBundleTotalLumpCount: number;
  readonly mapBundleLumpNamesMatchFixedOrder: boolean;
  readonly resolveMapBundleReturnsFrozenBundle: boolean;
  readonly resolveMapBundleRejectsMissingMapName: boolean;
  readonly resolveMapBundleRejectsDataLumpOutOfOrder: boolean;
  readonly resolveMapBundleRejectsBundleRunningOffDirectoryEnd: boolean;
  readonly isMapMarkerNameAcceptsE1M1: boolean;
  readonly isMapMarkerNameAcceptsMap01: boolean;
  readonly isMapMarkerNameRejectsNonMapNames: boolean;
}

/**
 * Cross-check a `MapLumpBundleRuntimeSnapshot` against
 * `MAP_LUMP_BUNDLE_AUDIT` and `MAP_LUMP_BUNDLE_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckMapLumpBundleRuntime(snapshot: MapLumpBundleRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (!snapshot.mapNamePatternDoom1AcceptsE1M1) {
    failures.push('derived:MAP_NAME_PATTERN_DOOM1_MATCHES_E_DIGIT_M_DIGIT');
    failures.push('audit:map-bundle-name-format-doom1-e-m:not-observed');
  }
  if (!snapshot.mapNamePatternDoom2AcceptsMap01) {
    failures.push('derived:MAP_NAME_PATTERN_DOOM2_MATCHES_MAP_TWO_DIGITS');
    failures.push('audit:map-bundle-name-format-doom2-map-nn:not-observed');
  }
  if (snapshot.mapMarkerLumpSize !== 0) {
    failures.push('derived:MAP_MARKER_LUMP_SIZE_EQUALS_ZERO');
    failures.push('audit:map-bundle-marker-size-zero:not-observed');
  }
  if (snapshot.mapBundleMlLabel !== 0) {
    failures.push('derived:MAP_BUNDLE_ML_LABEL_EQUALS_ZERO');
    failures.push('audit:map-bundle-ml-label-offset-zero:not-observed');
  }
  if (snapshot.mapBundleMlThings !== 1) {
    failures.push('derived:MAP_BUNDLE_ML_THINGS_EQUALS_ONE');
    failures.push('audit:map-bundle-ml-things-offset-one:not-observed');
  }
  if (snapshot.mapBundleMlLinedefs !== 2) {
    failures.push('derived:MAP_BUNDLE_ML_LINEDEFS_EQUALS_TWO');
    failures.push('audit:map-bundle-ml-linedefs-offset-two:not-observed');
  }
  if (snapshot.mapBundleMlSidedefs !== 3) {
    failures.push('derived:MAP_BUNDLE_ML_SIDEDEFS_EQUALS_THREE');
    failures.push('audit:map-bundle-ml-sidedefs-offset-three:not-observed');
  }
  if (snapshot.mapBundleMlVertexes !== 4) {
    failures.push('derived:MAP_BUNDLE_ML_VERTEXES_EQUALS_FOUR');
    failures.push('audit:map-bundle-ml-vertexes-offset-four:not-observed');
  }
  if (snapshot.mapBundleMlSegs !== 5) {
    failures.push('derived:MAP_BUNDLE_ML_SEGS_EQUALS_FIVE');
    failures.push('audit:map-bundle-ml-segs-offset-five:not-observed');
  }
  if (snapshot.mapBundleMlSsectors !== 6) {
    failures.push('derived:MAP_BUNDLE_ML_SSECTORS_EQUALS_SIX');
    failures.push('audit:map-bundle-ml-ssectors-offset-six:not-observed');
  }
  if (snapshot.mapBundleMlNodes !== 7) {
    failures.push('derived:MAP_BUNDLE_ML_NODES_EQUALS_SEVEN');
    failures.push('audit:map-bundle-ml-nodes-offset-seven:not-observed');
  }
  if (snapshot.mapBundleMlSectors !== 8) {
    failures.push('derived:MAP_BUNDLE_ML_SECTORS_EQUALS_EIGHT');
    failures.push('audit:map-bundle-ml-sectors-offset-eight:not-observed');
  }
  if (snapshot.mapBundleMlReject !== 9) {
    failures.push('derived:MAP_BUNDLE_ML_REJECT_EQUALS_NINE');
    failures.push('audit:map-bundle-ml-reject-offset-nine:not-observed');
  }
  if (snapshot.mapBundleMlBlockmap !== 10) {
    failures.push('derived:MAP_BUNDLE_ML_BLOCKMAP_EQUALS_TEN');
    failures.push('audit:map-bundle-ml-blockmap-offset-ten:not-observed');
  }
  if (snapshot.mapBundleDataLumpCount !== 10) {
    failures.push('derived:MAP_BUNDLE_DATA_LUMP_COUNT_EQUALS_TEN');
    failures.push('audit:map-bundle-data-lump-count-ten:not-observed');
  }
  if (snapshot.mapBundleTotalLumpCount !== 11) {
    failures.push('derived:MAP_BUNDLE_TOTAL_LUMP_COUNT_EQUALS_ELEVEN');
    failures.push('audit:map-bundle-total-lump-count-eleven:not-observed');
  }
  if (!snapshot.mapBundleLumpNamesMatchFixedOrder) {
    failures.push('derived:MAP_BUNDLE_LUMP_NAMES_FIXED_ORDER');
    failures.push('audit:map-bundle-positional-load-via-lumpnum-plus-offset:not-observed');
  }
  if (!snapshot.resolveMapBundleReturnsFrozenBundle) {
    failures.push('derived:RESOLVE_MAP_BUNDLE_RETURNS_FROZEN_BUNDLE');
  }
  if (!snapshot.resolveMapBundleRejectsMissingMapName) {
    failures.push('derived:RESOLVE_MAP_BUNDLE_REJECTS_MISSING_MAP_NAME');
    failures.push('audit:map-bundle-name-lookup-via-w-getnumforname:not-observed');
  }
  if (!snapshot.resolveMapBundleRejectsDataLumpOutOfOrder) {
    failures.push('derived:RESOLVE_MAP_BUNDLE_REJECTS_DATA_LUMP_OUT_OF_ORDER');
    failures.push('audit:map-bundle-positional-load-via-lumpnum-plus-offset:not-observed');
  }
  if (!snapshot.resolveMapBundleRejectsBundleRunningOffDirectoryEnd) {
    failures.push('derived:RESOLVE_MAP_BUNDLE_REJECTS_BUNDLE_RUNNING_OFF_DIRECTORY_END');
  }
  if (!snapshot.isMapMarkerNameAcceptsE1M1) {
    failures.push('derived:IS_MAP_MARKER_NAME_ACCEPTS_E1M1_AND_MAP01');
    failures.push('audit:map-bundle-name-format-doom1-e-m:not-observed');
  }
  if (!snapshot.isMapMarkerNameAcceptsMap01) {
    failures.push('derived:IS_MAP_MARKER_NAME_ACCEPTS_E1M1_AND_MAP01');
    failures.push('audit:map-bundle-name-format-doom2-map-nn:not-observed');
  }
  if (!snapshot.isMapMarkerNameRejectsNonMapNames) {
    failures.push('derived:IS_MAP_MARKER_NAME_REJECTS_NON_MAP_NAMES');
  }

  const declaredAxes = new Set(MAP_LUMP_BUNDLE_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<MapLumpBundleAuditEntry['id']> = [
    'map-bundle-name-format-doom1-e-m',
    'map-bundle-name-format-doom2-map-nn',
    'map-bundle-name-lookup-via-w-getnumforname',
    'map-bundle-marker-size-zero',
    'map-bundle-ml-label-offset-zero',
    'map-bundle-ml-things-offset-one',
    'map-bundle-ml-linedefs-offset-two',
    'map-bundle-ml-sidedefs-offset-three',
    'map-bundle-ml-vertexes-offset-four',
    'map-bundle-ml-segs-offset-five',
    'map-bundle-ml-ssectors-offset-six',
    'map-bundle-ml-nodes-offset-seven',
    'map-bundle-ml-sectors-offset-eight',
    'map-bundle-ml-reject-offset-nine',
    'map-bundle-ml-blockmap-offset-ten',
    'map-bundle-data-lump-count-ten',
    'map-bundle-total-lump-count-eleven',
    'map-bundle-positional-load-via-lumpnum-plus-offset',
    'map-bundle-no-marker-range',
    'map-bundle-shareware-doom1-nine-maps',
  ];
  for (const axis of requiredAxes) {
    if (!declaredAxes.has(axis)) {
      failures.push('derived:EVERY_AUDIT_AXIS_IS_DECLARED');
      break;
    }
  }

  return failures;
}

/**
 * Pinned facts about a single named map bundle inside the shareware
 * `doom/DOOM1.WAD` directory that the focused test cross-checks
 * against the live on-disk file. Each pinned entry covers the full
 * `P_SetupLevel` read path: directory placement of the marker,
 * marker size, total data byte count, and a SHA-256 fingerprint of
 * the concatenated 10 data lumps.
 */
export interface ShareWareDoom1WadMapBundleOracleEntry {
  /** Map marker name (uppercase). */
  readonly name: string;
  /** Directory index of the map marker lump. */
  readonly markerIndex: number;
  /** Byte size of the marker lump (always 0 in shareware DOOM1.WAD). */
  readonly markerSize: number;
  /** Sum of the byte sizes of the 10 data lumps. */
  readonly totalDataBytes: number;
  /** SHA-256 hex digest of the 10 data lumps concatenated in canonical order (lower-case, 64 chars). */
  readonly dataSha256: string;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` map bundle inventory. */
export interface ShareWareDoom1WadMapBundleOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Total map bundle count (matches `lumpCategories.map-marker`). */
  readonly mapBundleCount: 9;
  /** Directory index of the first map marker (E1M1). */
  readonly firstMapBundleIndex: 6;
  /** Directory index of the last map marker (E1M9). */
  readonly lastMapBundleIndex: 94;
  /** Pinned named map bundles with directory indices, byte sizes, and SHA-256 fingerprints. */
  readonly pinnedMapBundles: readonly ShareWareDoom1WadMapBundleOracleEntry[];
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` map bundle
 * inventory.
 *
 * The pinned probes were captured from the live IWAD via a one-off
 * probe script. Each map pins the directory index of its marker, the
 * marker's byte size (always 0), the sum of the byte sizes of its 10
 * data lumps, and the SHA-256 of the concatenated data lumps in
 * canonical order (THINGS, LINEDEFS, SIDEDEFS, VERTEXES, SEGS,
 * SSECTORS, NODES, SECTORS, REJECT, BLOCKMAP).
 */
export const SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE: ShareWareDoom1WadMapBundleOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  mapBundleCount: 9,
  firstMapBundleIndex: 6,
  lastMapBundleIndex: 94,
  pinnedMapBundles: Object.freeze([
    Object.freeze({ name: 'E1M1', markerIndex: 6, markerSize: 0, totalDataBytes: 55714, dataSha256: 'df5c2697f6b8c9cb948eb7bb9b098b2ff0c06af3b497c911070c06a19c922eed' }),
    Object.freeze({ name: 'E1M2', markerIndex: 17, markerSize: 0, totalDataBytes: 114474, dataSha256: '3f5e724d917c7aaa744f709239f7b12f69d3577182231222a3ffc9e03cd169b8' }),
    Object.freeze({ name: 'E1M3', markerIndex: 28, markerSize: 0, totalDataBytes: 111205, dataSha256: 'c31bb7fa92c58d63136be25d5330dd8b15f96c1e78b45f4383983aa3569e3c3e' }),
    Object.freeze({ name: 'E1M4', markerIndex: 39, markerSize: 0, totalDataBytes: 87544, dataSha256: '3b0402b16f263724c6a3301fd8dc189bc1dbaae77069e2609b712ba1edd1003c' }),
    Object.freeze({ name: 'E1M5', markerIndex: 50, markerSize: 0, totalDataBytes: 89313, dataSha256: '4c0fa3a93847dc8a5011c016dd8a592df189eb81476cf6c2592ba5081f03a13a' }),
    Object.freeze({ name: 'E1M6', markerIndex: 61, markerSize: 0, totalDataBytes: 152021, dataSha256: 'eb948e867ab02c3c6705dff6bd0c8221286fbb47c534147acdbed832f5dc8346' }),
    Object.freeze({ name: 'E1M7', markerIndex: 72, markerSize: 0, totalDataBytes: 105513, dataSha256: 'c2659dfa027056ca4836d5b5de418e85574a562513aec8b3ee756f76bbd48e0f' }),
    Object.freeze({ name: 'E1M8', markerIndex: 83, markerSize: 0, totalDataBytes: 57241, dataSha256: 'b37ede18d822b59025da8583ce72784b207d9af85c8518c30e7130bc150d7940' }),
    Object.freeze({ name: 'E1M9', markerIndex: 94, markerSize: 0, totalDataBytes: 75124, dataSha256: 'd38066b5f560d6d98aafedd803e49f983ce3f55920f3414294085ca9a79e87c9' }),
  ]) as readonly ShareWareDoom1WadMapBundleOracleEntry[],
}) as ShareWareDoom1WadMapBundleOracle;

/**
 * Compute the SHA-256 hex digest of a map bundle's 10 data lumps
 * concatenated in canonical order (THINGS, LINEDEFS, SIDEDEFS,
 * VERTEXES, SEGS, SSECTORS, NODES, SECTORS, REJECT, BLOCKMAP).
 *
 * @param wadBuffer - Buffer holding the entire WAD file.
 * @param bundle - Resolved {@link MapLumpBundle}.
 */
export function hashMapBundleData(wadBuffer: Buffer, bundle: MapLumpBundle): string {
  const hash = createHash('sha256');
  for (const dataLump of bundle.dataLumps) {
    hash.update(wadBuffer.subarray(dataLump.offset, dataLump.offset + dataLump.size));
  }
  return hash.digest('hex');
}

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * map bundle inventory so the focused test can re-derive the values
 * from the live file every run and feed the result into the
 * cross-check.
 */
export interface ShareWareDoom1WadMapBundleSample {
  readonly mapBundleCount: number;
  readonly firstMapBundleIndex: number;
  readonly lastMapBundleIndex: number;
  readonly pinnedMapBundles: readonly {
    readonly name: string;
    readonly markerIndex: number;
    readonly markerSize: number;
    readonly totalDataBytes: number;
    readonly dataSha256: string;
  }[];
}

/**
 * Cross-check a shareware DOOM1.WAD map bundle sample against the
 * pinned oracle. Returns the list of failures by stable identifier;
 * an empty list means the live inventory matches the oracle
 * byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:map:<name>:not-found` when the sample is missing a
 *    pinned named map bundle.
 *  - `oracle:map:<name>:<field>:value-mismatch` for any oracle
 *    field on a pinned named map bundle whose live counterpart
 *    disagrees.
 */
export function crossCheckShareWareDoom1WadMapBundleSample(sample: ShareWareDoom1WadMapBundleSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'mapBundleCount' | 'firstMapBundleIndex' | 'lastMapBundleIndex'> = ['mapBundleCount', 'firstMapBundleIndex', 'lastMapBundleIndex'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  for (const oracleEntry of SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles) {
    const liveEntry = sample.pinnedMapBundles.find((e) => e.name === oracleEntry.name);
    if (!liveEntry) {
      failures.push(`oracle:map:${oracleEntry.name}:not-found`);
      continue;
    }
    const fields: ReadonlyArray<keyof ShareWareDoom1WadMapBundleOracleEntry> = ['markerIndex', 'markerSize', 'totalDataBytes', 'dataSha256'];
    for (const field of fields) {
      if (liveEntry[field] !== oracleEntry[field]) {
        failures.push(`oracle:map:${oracleEntry.name}:${field}:value-mismatch`);
      }
    }
  }

  return failures;
}
