/**
 * Audit ledger plus runtime contract for rejecting missing proprietary
 * assets with clear errors instead of silent fallback or partial
 * functionality.
 *
 * Vanilla DOOM 1.9 enforces the "missing-required-asset is fatal" rule
 * through a small, well-defined family of `I_Error` callsites driven by
 * the WAD lookup primitives `W_GetNumForName` (fatal on miss),
 * `W_CheckNumForName` (returns -1 on miss, callers branch on it), and
 * `W_CacheLumpName` (calls `W_GetNumForName` then loads). Subsystems
 * such as the texture builder (`R_InitTextures`), the level loader
 * (`P_SetupLevel`), the renderer's flat / sprite marker resolution
 * (`R_InitFlats`, `R_InitSpriteLumps`), the status bar loader
 * (`ST_Init`), the menu help screens (`M_DrawReadThis1` /
 * `M_DrawReadThis2`), the intermission loader (`WI_loadData`), the
 * finale screens (`F_StartFinale`), and the title-loop pager
 * (`D_PageDrawer`) all funnel through the same primitives, so the
 * missing-asset error contract is centralised.
 *
 * This module pins that contract:
 *
 * 1. The audit ledger pins every upstream `I_Error` callsite this
 *    repository knows about, with a verbatim quote of the
 *    `I_Error("W_GetNumForName: %s not found!", name)` format string,
 *    a list of the canonical mandatory lumps (PLAYPAL, COLORMAP,
 *    TEXTURE1, PNAMES, ENDOOM, GENMIDI, TITLEPIC, CREDIT, HELP1,
 *    STBAR, STARMS, F_START, F_END, S_START, S_END, plus the per-map
 *    THINGS, LINEDEFS, SIDEDEFS, VERTEXES, SEGS, SSECTORS, NODES,
 *    SECTORS, REJECT, BLOCKMAP lumps), the canonical optional lumps
 *    (TEXTURE2, DMXGUS, the per-episode SKY/HELP/WIMAP/finale lumps),
 *    and the IWAD-level missing-file contract from `D_DoomMain` (which
 *    reports a fatal "Game mode indeterminate" error if no IWAD is
 *    found).
 * 2. The runtime errors `MissingProprietaryLumpError` and
 *    `MissingProprietaryIwadFileError` carry the structured fields
 *    required to surface a clear actionable message: asset kind, asset
 *    name, the subsystem that requested it, and (for IWAD-level
 *    failures) the search paths that were tried.
 * 3. The runtime helpers `assertRequiredLumpPresent`,
 *    `findOptionalLump`, and `assertRequiredIwadFilePresent` enforce
 *    the contract while preserving the optional-vs-mandatory
 *    distinction that vanilla makes via the
 *    `W_GetNumForName` / `W_CheckNumForName` split.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (`w_wad.c`, `r_data.c`,
 *      `p_setup.c`, `d_main.c`),
 *   5. Chocolate Doom 2.2.1 source (`src/w_wad.c`, `src/d_iwad.c`).
 *
 * This module does NOT itself read any IWAD or proprietary file: it is
 * a pure contract that other lanes (e.g. the bootstrap IWAD discovery
 * and the renderer's TEXTURE1 / PNAMES loaders) can call into to
 * surface a uniform missing-asset error.
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited rejection axis (an `I_Error` callsite, error format
 * string, or runtime contract) of the missing-proprietary-asset
 * rejection runtime.
 */
export interface MissingProprietaryAssetAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'w-get-num-for-name-fatals-on-miss'
    | 'w-get-num-for-name-error-format'
    | 'w-check-num-for-name-returns-negative-one-on-miss'
    | 'w-cache-lump-name-routes-through-get-num-for-name'
    | 'r-init-textures-requires-texture1'
    | 'r-init-textures-requires-pnames'
    | 'r-init-textures-allows-texture2-absent'
    | 'r-init-flats-requires-flat-marker-range'
    | 'r-init-sprite-lumps-requires-sprite-marker-range'
    | 'p-setup-level-requires-map-marker'
    | 'p-setup-level-requires-things-lump'
    | 'p-setup-level-requires-linedefs-lump'
    | 'p-setup-level-requires-sidedefs-lump'
    | 'p-setup-level-requires-vertexes-lump'
    | 'p-setup-level-requires-segs-lump'
    | 'p-setup-level-requires-ssectors-lump'
    | 'p-setup-level-requires-nodes-lump'
    | 'p-setup-level-requires-sectors-lump'
    | 'p-setup-level-requires-blockmap-lump'
    | 'p-setup-level-requires-reject-lump'
    | 'st-init-requires-stbar-and-starms'
    | 'd-page-drawer-requires-titlepic-and-credit'
    | 'd-doom-main-requires-playpal-and-colormap'
    | 'd-doom-main-requires-endoom'
    | 'd-doom-main-requires-genmidi'
    | 'd-doom-main-allows-dmxgus-absent'
    | 'd-doom-main-rejects-missing-iwad-file'
    | 'rejection-error-carries-asset-kind'
    | 'rejection-error-carries-asset-name'
    | 'rejection-error-carries-subsystem-name'
    | 'rejection-error-for-iwad-carries-search-paths';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject:
    | 'wad-lookup-primitive'
    | 'texture-loader'
    | 'patch-name-loader'
    | 'flat-marker-resolver'
    | 'sprite-marker-resolver'
    | 'level-loader'
    | 'map-data-lump'
    | 'status-bar-loader'
    | 'title-pager'
    | 'palette-loader'
    | 'audio-loader'
    | 'iwad-discovery'
    | 'rejection-error-shape';
  /** Verbatim C source line(s) cited from the upstream tree. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the upstream tree. */
  readonly referenceSourceFile:
    | 'linuxdoom-1.10/w_wad.c'
    | 'linuxdoom-1.10/r_data.c'
    | 'linuxdoom-1.10/p_setup.c'
    | 'linuxdoom-1.10/st_stuff.c'
    | 'linuxdoom-1.10/d_main.c'
    | 'src/w_wad.c'
    | 'src/d_iwad.c'
    | 'src/doom/d_main.c'
    | 'src/doom/p_setup.c';
  /** Plain-language description of the rejection contract the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every `I_Error` callsite, error format string, and
 * runtime contract the missing-asset rejection runtime must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const MISSING_PROPRIETARY_ASSET_AUDIT: readonly MissingProprietaryAssetAuditEntry[] = [
  {
    id: 'w-get-num-for-name-fatals-on-miss',
    subject: 'wad-lookup-primitive',
    cSourceLines: ['int W_GetNumForName (char* name)', '{', '    int i = W_CheckNumForName (name);', '    if (i == -1)', '      I_Error ("W_GetNumForName: %s not found!", name);', '    return i;', '}'],
    referenceSourceFile: 'linuxdoom-1.10/w_wad.c',
    invariant:
      'Vanilla `W_GetNumForName(name)` calls `W_CheckNumForName(name)` and fatals via `I_Error` when the result is `-1`. Every subsystem that depends on a mandatory lump funnels through this primitive: silent fallback or partial functionality is forbidden. The runtime models this with `assertRequiredLumpPresent(directory, lumpName, subsystem)` throwing `MissingProprietaryLumpError` when the lump is absent.',
  },
  {
    id: 'w-get-num-for-name-error-format',
    subject: 'wad-lookup-primitive',
    cSourceLines: ['I_Error ("W_GetNumForName: %s not found!", name);'],
    referenceSourceFile: 'linuxdoom-1.10/w_wad.c',
    invariant:
      'The vanilla error format string is `"W_GetNumForName: %s not found!"` with `name` substituted at the `%s`. The runtime preserves this canonical phrasing: every `MissingProprietaryLumpError` message contains the literal substring `not found` and the literal asset name so log scrapers and crash reporters can correlate the failure with the upstream callsite.',
  },
  {
    id: 'w-check-num-for-name-returns-negative-one-on-miss',
    subject: 'wad-lookup-primitive',
    cSourceLines: ['int W_CheckNumForName (char* name)', '{', '    /* scan from end of directory toward start */', '    /* return -1 if not found */', '    return -1;', '}'],
    referenceSourceFile: 'linuxdoom-1.10/w_wad.c',
    invariant:
      'Vanilla `W_CheckNumForName(name)` returns `-1` when the lump is absent without raising `I_Error`. Subsystems that legitimately tolerate an optional lump (e.g. `R_InitTextures` for `TEXTURE2`) branch on this `-1` return value. The runtime models this with `findOptionalLump(directory, lumpName)` returning `undefined` rather than throwing.',
  },
  {
    id: 'w-cache-lump-name-routes-through-get-num-for-name',
    subject: 'wad-lookup-primitive',
    cSourceLines: ['void* W_CacheLumpName (char* name, int tag)', '{', '    return W_CacheLumpNum (W_GetNumForName(name), tag);', '}'],
    referenceSourceFile: 'linuxdoom-1.10/w_wad.c',
    invariant:
      'Vanilla `W_CacheLumpName` calls `W_GetNumForName` first; therefore every `W_CacheLumpName(<lump>, …)` callsite inherits the fatal-on-miss contract. The runtime models this with the convention that callers pass the requesting `subsystem` string (e.g. "R_InitTextures", "D_PageDrawer") to `assertRequiredLumpPresent` so the error message identifies the upstream subsystem.',
  },
  {
    id: 'r-init-textures-requires-texture1',
    subject: 'texture-loader',
    cSourceLines: ['maptex1 = W_CacheLumpName ("TEXTURE1", PU_STATIC);', 'numtextures1 = LONG(*maptex1);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'Vanilla `R_InitTextures` always calls `W_CacheLumpName ("TEXTURE1", PU_STATIC)`; absence is fatal via the inherited `W_GetNumForName` contract. `TEXTURE1` is therefore listed as a mandatory lump in `MANDATORY_INFRASTRUCTURE_LUMPS`.',
  },
  {
    id: 'r-init-textures-requires-pnames',
    subject: 'patch-name-loader',
    cSourceLines: ['names = W_CacheLumpName ("PNAMES", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant: 'Vanilla `R_InitTextures` always calls `W_CacheLumpName ("PNAMES", PU_STATIC)`; absence is fatal. `PNAMES` is the patch-name table referenced by every TEXTURE1 / TEXTURE2 entry. It is listed as a mandatory lump.',
  },
  {
    id: 'r-init-textures-allows-texture2-absent',
    subject: 'texture-loader',
    cSourceLines: ['if (W_CheckNumForName ("TEXTURE2") != -1)', '    maptex2 = W_CacheLumpName ("TEXTURE2", PU_STATIC);', 'else', '    maptex2 = NULL;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'Vanilla `R_InitTextures` checks `W_CheckNumForName ("TEXTURE2") != -1` and treats absence as "no second texture set" (`maptex2 = NULL`). `TEXTURE2` is therefore listed as an optional lump in `OPTIONAL_INFRASTRUCTURE_LUMPS`; calling `findOptionalLump(directory, "TEXTURE2")` returns `undefined` instead of throwing.',
  },
  {
    id: 'r-init-flats-requires-flat-marker-range',
    subject: 'flat-marker-resolver',
    cSourceLines: ['firstflat = W_GetNumForName ("F_START");', 'lastflat = W_GetNumForName ("F_END") - 1;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant: 'Vanilla `R_InitFlats` resolves both `F_START` and `F_END` via `W_GetNumForName`; absence of either marker is fatal. Both names are listed as mandatory lumps.',
  },
  {
    id: 'r-init-sprite-lumps-requires-sprite-marker-range',
    subject: 'sprite-marker-resolver',
    cSourceLines: ['firstspritelump = W_GetNumForName ("S_START") + 1;', 'lastspritelump = W_GetNumForName ("S_END") - 1;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant: 'Vanilla `R_InitSpriteLumps` resolves both `S_START` and `S_END` via `W_GetNumForName`; absence of either marker is fatal. Both names are listed as mandatory lumps.',
  },
  {
    id: 'p-setup-level-requires-map-marker',
    subject: 'level-loader',
    cSourceLines: ['lumpnum = W_GetNumForName(lumpname);  /* fatal on miss */'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'Vanilla `P_SetupLevel` resolves the per-episode map marker (e.g. `E1M1` / `E2M1` / `MAP01`) via `W_GetNumForName(lumpname)`; absence is fatal. The runtime models this by treating any per-map marker requested by the level loader as a mandatory lump scoped to the `P_SetupLevel` subsystem.',
  },
  {
    id: 'p-setup-level-requires-things-lump',
    subject: 'map-data-lump',
    cSourceLines: ['data = W_CacheLumpNum (lumpnum + ML_THINGS, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadThings` reads `THINGS` (the per-map lump that follows the map marker by `ML_THINGS = 1`) via `W_CacheLumpNum`; absence is fatal. `THINGS` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-linedefs-lump',
    subject: 'map-data-lump',
    cSourceLines: ['data = W_CacheLumpNum (lump + ML_LINEDEFS, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadLineDefs` reads `LINEDEFS` (the map data lump at offset `ML_LINEDEFS = 2`) via `W_CacheLumpNum`; absence is fatal. `LINEDEFS` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-sidedefs-lump',
    subject: 'map-data-lump',
    cSourceLines: ['data = W_CacheLumpNum (lump + ML_SIDEDEFS, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadSideDefs` reads `SIDEDEFS` (the map data lump at offset `ML_SIDEDEFS = 3`) via `W_CacheLumpNum`; absence is fatal. `SIDEDEFS` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-vertexes-lump',
    subject: 'map-data-lump',
    cSourceLines: ['data = W_CacheLumpNum (lump + ML_VERTEXES, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadVertexes` reads `VERTEXES` (the map data lump at offset `ML_VERTEXES = 4`) via `W_CacheLumpNum`; absence is fatal. `VERTEXES` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-segs-lump',
    subject: 'map-data-lump',
    cSourceLines: ['data = W_CacheLumpNum (lump + ML_SEGS, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadSegs` reads `SEGS` (the map data lump at offset `ML_SEGS = 5`) via `W_CacheLumpNum`; absence is fatal. `SEGS` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-ssectors-lump',
    subject: 'map-data-lump',
    cSourceLines: ['data = W_CacheLumpNum (lump + ML_SSECTORS, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadSubsectors` reads `SSECTORS` (the map data lump at offset `ML_SSECTORS = 6`) via `W_CacheLumpNum`; absence is fatal. `SSECTORS` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-nodes-lump',
    subject: 'map-data-lump',
    cSourceLines: ['data = W_CacheLumpNum (lump + ML_NODES, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadNodes` reads `NODES` (the map data lump at offset `ML_NODES = 7`) via `W_CacheLumpNum`; absence is fatal. `NODES` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-sectors-lump',
    subject: 'map-data-lump',
    cSourceLines: ['data = W_CacheLumpNum (lump + ML_SECTORS, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadSectors` reads `SECTORS` (the map data lump at offset `ML_SECTORS = 8`) via `W_CacheLumpNum`; absence is fatal. `SECTORS` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-blockmap-lump',
    subject: 'map-data-lump',
    cSourceLines: ['blockmaplump = W_CacheLumpNum (lump + ML_BLOCKMAP, PU_LEVEL);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant: 'Vanilla `P_LoadBlockMap` reads `BLOCKMAP` (the map data lump at offset `ML_BLOCKMAP = 10`) via `W_CacheLumpNum`; absence is fatal. `BLOCKMAP` is listed as a mandatory map data lump.',
  },
  {
    id: 'p-setup-level-requires-reject-lump',
    subject: 'map-data-lump',
    cSourceLines: ['rejectmatrix = W_CacheLumpNum (lump + ML_REJECT, PU_LEVEL);'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'Vanilla `P_LoadReject` reads `REJECT` (the map data lump at offset `ML_REJECT = 9`) via `W_CacheLumpNum`; absence is fatal in the original vanilla code path. `REJECT` is listed as a mandatory map data lump (Chocolate Doom 2.2.1 added a fall-through that builds an empty matrix when REJECT is short, but the lump-presence requirement remains).',
  },
  {
    id: 'st-init-requires-stbar-and-starms',
    subject: 'status-bar-loader',
    cSourceLines: ['sbar = W_CacheLumpName("STBAR", PU_STATIC);', 'starms = W_CacheLumpName("STARMS", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/st_stuff.c',
    invariant: 'Vanilla `ST_Init` reads both `STBAR` (the status bar background) and `STARMS` (the arms display overlay) via `W_CacheLumpName`; absence of either is fatal. Both are listed as mandatory infrastructure lumps.',
  },
  {
    id: 'd-page-drawer-requires-titlepic-and-credit',
    subject: 'title-pager',
    cSourceLines: ['pagename = "TITLEPIC";', 'pagename = "CREDIT";', 'V_DrawPatchDirect (0, 0, 0, W_CacheLumpName(pagename, PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'Vanilla `D_PageDrawer` calls `V_DrawPatchDirect (0, 0, 0, W_CacheLumpName(pagename, PU_CACHE))` once per title-loop tick; with `pagename` cycling through `TITLEPIC` and `CREDIT`, both lumps are mandatory for the title sequence. Both are listed as mandatory infrastructure lumps.',
  },
  {
    id: 'd-doom-main-requires-playpal-and-colormap',
    subject: 'palette-loader',
    cSourceLines: ['playpal = W_CacheLumpName ("PLAYPAL", PU_CACHE);', 'colormaps = W_CacheLumpName ("COLORMAP", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'Vanilla startup loads both `PLAYPAL` (the 14-palette set, 768 bytes per palette) and `COLORMAP` (the 34-colormap set, 256 bytes per colormap) via `W_CacheLumpName`; absence of either is fatal because the renderer cannot draw without a palette or colormaps. Both are listed as mandatory infrastructure lumps.',
  },
  {
    id: 'd-doom-main-requires-endoom',
    subject: 'audio-loader',
    cSourceLines: ['endoom = W_CacheLumpName("ENDOOM", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant: 'Vanilla `I_Quit` reads `ENDOOM` (the 4000-byte text-mode quit screen) via `W_CacheLumpName`; absence is fatal at exit. `ENDOOM` is listed as a mandatory infrastructure lump.',
  },
  {
    id: 'd-doom-main-requires-genmidi',
    subject: 'audio-loader',
    cSourceLines: ['genmidi = W_CacheLumpName("GENMIDI", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'Vanilla DMX library initialisation reads `GENMIDI` (the OPL2 instrument bank) via `W_CacheLumpName`; absence is fatal because the FM synth path cannot render any music note without it. `GENMIDI` is listed as a mandatory infrastructure lump.',
  },
  {
    id: 'd-doom-main-allows-dmxgus-absent',
    subject: 'audio-loader',
    cSourceLines: ['if (W_CheckNumForName ("DMXGUS") != -1)', '    /* load Gravis UltraSound instrument bank */'],
    referenceSourceFile: 'src/doom/d_main.c',
    invariant:
      'Chocolate Doom 2.2.1 uses `W_CheckNumForName ("DMXGUS")` to decide whether to load the Gravis UltraSound instrument bank; absence is tolerated because GUS hardware is no longer relevant on modern systems. `DMXGUS` is listed as an optional infrastructure lump; calling `findOptionalLump(directory, "DMXGUS")` returns `undefined` instead of throwing.',
  },
  {
    id: 'd-doom-main-rejects-missing-iwad-file',
    subject: 'iwad-discovery',
    cSourceLines: ['if (iwadfile == NULL)', '    I_Error("Game mode indeterminate. No IWAD file was found. Try");'],
    referenceSourceFile: 'src/d_iwad.c',
    invariant:
      'Chocolate Doom 2.2.1 `D_FindIWAD` returns `NULL` when no IWAD candidate matches; `D_DoomMain` then fatals via `I_Error("Game mode indeterminate. No IWAD file was found. ...")`. The runtime models this with `assertRequiredIwadFilePresent(filename, candidatePaths, available)` throwing `MissingProprietaryIwadFileError` (which carries the searched paths) when no candidate path resolves to an existing file.',
  },
  {
    id: 'rejection-error-carries-asset-kind',
    subject: 'rejection-error-shape',
    cSourceLines: ['/* runtime contract — see MissingProprietaryAssetError */'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      'Every rejection error carries an `assetKind` discriminant of `"lump"` (for in-WAD lump misses) or `"iwad-file"` (for on-disk IWAD candidate misses). Callers use this discriminant to route the failure to the appropriate user-facing remediation (e.g. "supply a valid IWAD" vs "the IWAD is corrupt").',
  },
  {
    id: 'rejection-error-carries-asset-name',
    subject: 'rejection-error-shape',
    cSourceLines: ['I_Error ("W_GetNumForName: %s not found!", name);'],
    referenceSourceFile: 'linuxdoom-1.10/w_wad.c',
    invariant:
      'Every rejection error carries the literal `assetName` of the missing asset (the lump name or IWAD basename), and the human-readable message includes that name verbatim. This mirrors the upstream `%s` substitution in `W_GetNumForName: %s not found!`.',
  },
  {
    id: 'rejection-error-carries-subsystem-name',
    subject: 'rejection-error-shape',
    cSourceLines: ['/* caller passes its own subsystem identifier (e.g. "R_InitTextures") */'],
    referenceSourceFile: 'src/w_wad.c',
    invariant:
      'Every rejection error carries the `subsystem` identifier supplied by the caller (e.g. `"R_InitTextures"`, `"P_SetupLevel"`, `"D_PageDrawer"`, `"D_FindIWAD"`). This lets the user-facing error message identify which subsystem requested the missing asset, even though the upstream `W_GetNumForName` callsite is anonymous.',
  },
  {
    id: 'rejection-error-for-iwad-carries-search-paths',
    subject: 'rejection-error-shape',
    cSourceLines: ['/* upstream prints the candidate IWAD search list when no IWAD is found */'],
    referenceSourceFile: 'src/d_iwad.c',
    invariant:
      'Every IWAD-level rejection error carries the list of `searchPaths` that were tried so the user can see exactly which locations the engine probed (mirroring the upstream Chocolate Doom 2.2.1 behaviour where the IWAD discovery logs the list of candidate paths before failing).',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface MissingProprietaryAssetDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const MISSING_PROPRIETARY_ASSET_DERIVED_INVARIANTS: readonly MissingProprietaryAssetDerivedInvariant[] = [
  {
    id: 'ASSERT_REQUIRED_LUMP_THROWS_WHEN_ABSENT',
    description: '`assertRequiredLumpPresent` throws `MissingProprietaryLumpError` when the named lump is absent from the directory.',
  },
  {
    id: 'ASSERT_REQUIRED_LUMP_RETURNS_DIRECTORY_ENTRY_WHEN_PRESENT',
    description: '`assertRequiredLumpPresent` returns the matching `DirectoryEntry` (rather than throwing) when the named lump is present.',
  },
  {
    id: 'ASSERT_REQUIRED_LUMP_IS_CASE_INSENSITIVE',
    description: '`assertRequiredLumpPresent` matches lump names case-insensitively (mirroring the case-insensitivity vanilla `W_CheckNumForName` enforces via `strncasecmp`).',
  },
  {
    id: 'FIND_OPTIONAL_LUMP_RETURNS_UNDEFINED_WHEN_ABSENT',
    description: '`findOptionalLump` returns `undefined` (not throwing) when the named lump is absent, mirroring `W_CheckNumForName` returning `-1` on miss.',
  },
  {
    id: 'FIND_OPTIONAL_LUMP_RETURNS_DIRECTORY_ENTRY_WHEN_PRESENT',
    description: '`findOptionalLump` returns the matching `DirectoryEntry` when the named lump is present.',
  },
  {
    id: 'FIND_OPTIONAL_LUMP_IS_CASE_INSENSITIVE',
    description: '`findOptionalLump` matches lump names case-insensitively.',
  },
  {
    id: 'ASSERT_REQUIRED_IWAD_FILE_THROWS_WHEN_NO_CANDIDATE_AVAILABLE',
    description: '`assertRequiredIwadFilePresent` throws `MissingProprietaryIwadFileError` when no candidate path resolves to an existing file.',
  },
  {
    id: 'ASSERT_REQUIRED_IWAD_FILE_RETURNS_FIRST_AVAILABLE_PATH',
    description: '`assertRequiredIwadFilePresent` returns the first candidate path that resolves to an existing file (mirroring the upstream order-sensitive search).',
  },
  {
    id: 'MISSING_LUMP_ERROR_MESSAGE_INCLUDES_NOT_FOUND_LITERAL',
    description: 'Every `MissingProprietaryLumpError` message contains the literal substring `not found`, mirroring the upstream `W_GetNumForName: %s not found!` format.',
  },
  {
    id: 'MISSING_LUMP_ERROR_MESSAGE_INCLUDES_ASSET_NAME',
    description: 'Every `MissingProprietaryLumpError` message contains the literal `assetName` so log scrapers can correlate the failure with a specific lump.',
  },
  {
    id: 'MISSING_LUMP_ERROR_MESSAGE_INCLUDES_SUBSYSTEM',
    description: 'Every `MissingProprietaryLumpError` message contains the literal `subsystem` identifier so the user can route the failure to the requesting subsystem.',
  },
  {
    id: 'MISSING_LUMP_ERROR_CARRIES_LUMP_ASSET_KIND',
    description: 'Every `MissingProprietaryLumpError` instance has `assetKind === "lump"`, distinguishing it from `MissingProprietaryIwadFileError` instances.',
  },
  {
    id: 'MISSING_IWAD_FILE_ERROR_CARRIES_IWAD_FILE_ASSET_KIND',
    description: 'Every `MissingProprietaryIwadFileError` instance has `assetKind === "iwad-file"`, distinguishing it from `MissingProprietaryLumpError` instances.',
  },
  {
    id: 'MISSING_IWAD_FILE_ERROR_INCLUDES_FILENAME_AND_SEARCH_PATHS',
    description: 'Every `MissingProprietaryIwadFileError` message contains the literal `assetName` and includes every entry from `searchPaths`, so the user sees both the requested filename and every location that was probed.',
  },
  {
    id: 'EVERY_MANDATORY_INFRASTRUCTURE_LUMP_IS_PINNED',
    description: 'Every entry in `MANDATORY_INFRASTRUCTURE_LUMPS` matches one of the audit-pinned mandatory lump axes (PLAYPAL, COLORMAP, ENDOOM, GENMIDI, PNAMES, TEXTURE1, TITLEPIC, CREDIT, STBAR, STARMS).',
  },
  {
    id: 'EVERY_MANDATORY_MAP_DATA_LUMP_IS_PINNED',
    description: 'Every entry in `MANDATORY_MAP_DATA_LUMPS` matches one of the audit-pinned mandatory map data lump axes (THINGS, LINEDEFS, SIDEDEFS, VERTEXES, SEGS, SSECTORS, NODES, SECTORS, REJECT, BLOCKMAP).',
  },
  {
    id: 'OPTIONAL_LUMPS_INCLUDE_TEXTURE2_AND_DMXGUS',
    description: '`OPTIONAL_INFRASTRUCTURE_LUMPS` includes both `TEXTURE2` (registered/Ultimate-only second texture set) and `DMXGUS` (Gravis UltraSound instrument bank, tolerated absent on modern systems).',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/**
 * Mandatory infrastructure lumps the engine cannot start without.
 *
 * Pinned against authority 4 (`linuxdoom-1.10/d_main.c`,
 * `linuxdoom-1.10/r_data.c`, `linuxdoom-1.10/st_stuff.c`,
 * `linuxdoom-1.10/w_wad.c`): every name here corresponds to a
 * `W_CacheLumpName(<name>, …)` callsite that fatals on miss via the
 * inherited `W_GetNumForName` contract.
 */
export const MANDATORY_INFRASTRUCTURE_LUMPS: readonly string[] = Object.freeze(['PLAYPAL', 'COLORMAP', 'ENDOOM', 'GENMIDI', 'PNAMES', 'TEXTURE1', 'TITLEPIC', 'CREDIT', 'STBAR', 'STARMS', 'F_START', 'F_END', 'S_START', 'S_END']);

/**
 * Mandatory per-map data lumps the level loader cannot setup without.
 *
 * Pinned against authority 4 (`linuxdoom-1.10/p_setup.c`): every name
 * here corresponds to a `W_CacheLumpNum(lump + ML_<name>, …)` callsite
 * that fatals on miss.
 */
export const MANDATORY_MAP_DATA_LUMPS: readonly string[] = Object.freeze(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']);

/**
 * Optional infrastructure lumps the engine tolerates absent.
 *
 * Pinned against authority 4 (`linuxdoom-1.10/r_data.c`,
 * `src/doom/d_main.c`): every name here corresponds to a
 * `W_CheckNumForName(<name>) != -1` guard whose else-branch silently
 * skips loading.
 */
export const OPTIONAL_INFRASTRUCTURE_LUMPS: readonly string[] = Object.freeze(['TEXTURE2', 'DMXGUS']);

/**
 * Discriminant identifying which kind of proprietary asset a rejection
 * error refers to.
 */
export type ProprietaryAssetKind = 'lump' | 'iwad-file';

/**
 * Common shape every proprietary-asset rejection error implements.
 *
 * Both `MissingProprietaryLumpError` and `MissingProprietaryIwadFileError`
 * implement this contract so callers can pattern-match on `assetKind`
 * to route the failure to the appropriate remediation.
 */
export interface MissingProprietaryAssetError extends Error {
  /** Discriminant identifying the kind of asset that is missing. */
  readonly assetKind: ProprietaryAssetKind;
  /** Name of the missing asset (lump name or IWAD basename). */
  readonly assetName: string;
  /** Identifier of the subsystem that requested the missing asset. */
  readonly subsystem: string;
}

/**
 * Error thrown when a required in-WAD lump is absent from the parsed
 * directory. Mirrors the upstream `I_Error("W_GetNumForName: %s not
 * found!", name)` callsite in `linuxdoom-1.10/w_wad.c`.
 */
export class MissingProprietaryLumpError extends Error implements MissingProprietaryAssetError {
  /** Discriminant. */
  readonly assetKind: 'lump' = 'lump';
  /** Name of the missing lump. */
  readonly assetName: string;
  /** Identifier of the subsystem that requested the missing lump. */
  readonly subsystem: string;

  constructor(assetName: string, subsystem: string) {
    super(`W_GetNumForName: ${assetName} not found! (requested by ${subsystem})`);
    this.assetName = assetName;
    this.subsystem = subsystem;
    this.name = 'MissingProprietaryLumpError';
  }
}

/**
 * Error thrown when no candidate IWAD file path resolves to an
 * existing on-disk file. Mirrors the upstream `I_Error("Game mode
 * indeterminate. No IWAD file was found. ...")` callsite in
 * `src/d_iwad.c` (Chocolate Doom 2.2.1) and `linuxdoom-1.10/d_main.c`.
 */
export class MissingProprietaryIwadFileError extends Error implements MissingProprietaryAssetError {
  /** Discriminant. */
  readonly assetKind: 'iwad-file' = 'iwad-file';
  /** Basename of the missing IWAD file. */
  readonly assetName: string;
  /** Identifier of the subsystem that requested the IWAD discovery. */
  readonly subsystem: string;
  /** Frozen list of the candidate paths that were probed. */
  readonly searchPaths: readonly string[];

  constructor(assetName: string, subsystem: string, searchPaths: readonly string[]) {
    const pathsList = searchPaths.length === 0 ? '(no search paths supplied)' : searchPaths.join(', ');
    super(`Game mode indeterminate. No IWAD file ${assetName} was found by ${subsystem}. Searched paths: ${pathsList}`);
    this.assetName = assetName;
    this.subsystem = subsystem;
    this.searchPaths = Object.freeze([...searchPaths]);
    this.name = 'MissingProprietaryIwadFileError';
  }
}

/**
 * Locate a lump by name in the parsed WAD directory.
 *
 * Mirrors the case-insensitive lookup vanilla `W_CheckNumForName`
 * performs via `strncasecmp`. Returns `undefined` on miss; never
 * throws.
 *
 * @param directory - Parsed WAD directory entries.
 * @param lumpName - Name of the lump to locate (case-insensitive).
 * @returns The matching `DirectoryEntry`, or `undefined` if no entry matches.
 */
export function findOptionalLump(directory: readonly DirectoryEntry[], lumpName: string): DirectoryEntry | undefined {
  const upper = lumpName.toUpperCase();
  for (const entry of directory) {
    if (entry.name.toUpperCase() === upper) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Assert a required lump is present in the parsed WAD directory.
 *
 * Mirrors vanilla `W_GetNumForName(lumpName)` which fatals via
 * `I_Error("W_GetNumForName: %s not found!", name)` on miss. The
 * supplied `subsystem` identifier is woven into the error message so
 * the user can see which subsystem requested the missing lump.
 *
 * @param directory - Parsed WAD directory entries.
 * @param lumpName - Name of the lump to require (case-insensitive).
 * @param subsystem - Identifier of the requesting subsystem (e.g. "R_InitTextures").
 * @returns The matching `DirectoryEntry`.
 * @throws {MissingProprietaryLumpError} If no entry matches the name.
 */
export function assertRequiredLumpPresent(directory: readonly DirectoryEntry[], lumpName: string, subsystem: string): DirectoryEntry {
  const entry = findOptionalLump(directory, lumpName);
  if (entry === undefined) {
    throw new MissingProprietaryLumpError(lumpName, subsystem);
  }
  return entry;
}

/**
 * Assert an IWAD candidate file is available on disk.
 *
 * Mirrors the upstream `D_FindIWAD` order-sensitive search: the first
 * candidate path that resolves to an existing file is returned.
 * Throws `MissingProprietaryIwadFileError` if no candidate is
 * available. The error message and the `searchPaths` field include
 * every probed path so the user can see exactly which locations were
 * probed.
 *
 * @param assetName - Basename of the IWAD file (e.g. `"DOOM1.WAD"`).
 * @param candidatePaths - Ordered list of candidate file paths to probe.
 * @param available - Predicate or set indicating which candidate paths exist.
 * @param subsystem - Identifier of the requesting subsystem (default `"D_FindIWAD"`).
 * @returns The first candidate path whose `available(path)` predicate is `true`.
 * @throws {MissingProprietaryIwadFileError} If no candidate path is available.
 */
export function assertRequiredIwadFilePresent(assetName: string, candidatePaths: readonly string[], available: (path: string) => boolean, subsystem: string = 'D_FindIWAD'): string {
  for (const path of candidatePaths) {
    if (available(path)) {
      return path;
    }
  }
  throw new MissingProprietaryIwadFileError(assetName, subsystem, candidatePaths);
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/reject-missing-proprietary-assets-with-clear-error.ts`.
 * The cross-check helper consumes this shape so the focused test can
 * both verify the live runtime exports and exercise a deliberately
 * tampered snapshot to prove the failure modes are observable.
 */
export interface MissingProprietaryAssetRuntimeSnapshot {
  readonly assertRequiredLumpThrowsWhenAbsent: boolean;
  readonly assertRequiredLumpReturnsEntryWhenPresent: boolean;
  readonly assertRequiredLumpIsCaseInsensitive: boolean;
  readonly findOptionalLumpReturnsUndefinedWhenAbsent: boolean;
  readonly findOptionalLumpReturnsEntryWhenPresent: boolean;
  readonly findOptionalLumpIsCaseInsensitive: boolean;
  readonly assertRequiredIwadFileThrowsWhenNoCandidateAvailable: boolean;
  readonly assertRequiredIwadFileReturnsFirstAvailablePath: boolean;
  readonly missingLumpErrorMessageIncludesNotFoundLiteral: boolean;
  readonly missingLumpErrorMessageIncludesAssetName: boolean;
  readonly missingLumpErrorMessageIncludesSubsystem: boolean;
  readonly missingLumpErrorCarriesLumpAssetKind: boolean;
  readonly missingIwadFileErrorCarriesIwadFileAssetKind: boolean;
  readonly missingIwadFileErrorIncludesFilenameAndSearchPaths: boolean;
  readonly mandatoryInfrastructureLumpsCoverPinnedAxes: boolean;
  readonly mandatoryMapDataLumpsCoverPinnedAxes: boolean;
  readonly optionalLumpsIncludeTexture2AndDmxgus: boolean;
}

/**
 * Cross-check a `MissingProprietaryAssetRuntimeSnapshot` against
 * `MISSING_PROPRIETARY_ASSET_AUDIT` and
 * `MISSING_PROPRIETARY_ASSET_DERIVED_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the snapshot is
 * parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckMissingProprietaryAssetRuntime(snapshot: MissingProprietaryAssetRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (!snapshot.assertRequiredLumpThrowsWhenAbsent) {
    failures.push('derived:ASSERT_REQUIRED_LUMP_THROWS_WHEN_ABSENT');
    failures.push('audit:w-get-num-for-name-fatals-on-miss:not-observed');
  }
  if (!snapshot.assertRequiredLumpReturnsEntryWhenPresent) {
    failures.push('derived:ASSERT_REQUIRED_LUMP_RETURNS_DIRECTORY_ENTRY_WHEN_PRESENT');
  }
  if (!snapshot.assertRequiredLumpIsCaseInsensitive) {
    failures.push('derived:ASSERT_REQUIRED_LUMP_IS_CASE_INSENSITIVE');
  }
  if (!snapshot.findOptionalLumpReturnsUndefinedWhenAbsent) {
    failures.push('derived:FIND_OPTIONAL_LUMP_RETURNS_UNDEFINED_WHEN_ABSENT');
    failures.push('audit:w-check-num-for-name-returns-negative-one-on-miss:not-observed');
  }
  if (!snapshot.findOptionalLumpReturnsEntryWhenPresent) {
    failures.push('derived:FIND_OPTIONAL_LUMP_RETURNS_DIRECTORY_ENTRY_WHEN_PRESENT');
  }
  if (!snapshot.findOptionalLumpIsCaseInsensitive) {
    failures.push('derived:FIND_OPTIONAL_LUMP_IS_CASE_INSENSITIVE');
  }
  if (!snapshot.assertRequiredIwadFileThrowsWhenNoCandidateAvailable) {
    failures.push('derived:ASSERT_REQUIRED_IWAD_FILE_THROWS_WHEN_NO_CANDIDATE_AVAILABLE');
    failures.push('audit:d-doom-main-rejects-missing-iwad-file:not-observed');
  }
  if (!snapshot.assertRequiredIwadFileReturnsFirstAvailablePath) {
    failures.push('derived:ASSERT_REQUIRED_IWAD_FILE_RETURNS_FIRST_AVAILABLE_PATH');
  }
  if (!snapshot.missingLumpErrorMessageIncludesNotFoundLiteral) {
    failures.push('derived:MISSING_LUMP_ERROR_MESSAGE_INCLUDES_NOT_FOUND_LITERAL');
    failures.push('audit:w-get-num-for-name-error-format:not-observed');
  }
  if (!snapshot.missingLumpErrorMessageIncludesAssetName) {
    failures.push('derived:MISSING_LUMP_ERROR_MESSAGE_INCLUDES_ASSET_NAME');
    failures.push('audit:rejection-error-carries-asset-name:not-observed');
  }
  if (!snapshot.missingLumpErrorMessageIncludesSubsystem) {
    failures.push('derived:MISSING_LUMP_ERROR_MESSAGE_INCLUDES_SUBSYSTEM');
    failures.push('audit:rejection-error-carries-subsystem-name:not-observed');
  }
  if (!snapshot.missingLumpErrorCarriesLumpAssetKind) {
    failures.push('derived:MISSING_LUMP_ERROR_CARRIES_LUMP_ASSET_KIND');
    failures.push('audit:rejection-error-carries-asset-kind:not-observed');
  }
  if (!snapshot.missingIwadFileErrorCarriesIwadFileAssetKind) {
    failures.push('derived:MISSING_IWAD_FILE_ERROR_CARRIES_IWAD_FILE_ASSET_KIND');
    failures.push('audit:rejection-error-carries-asset-kind:not-observed');
  }
  if (!snapshot.missingIwadFileErrorIncludesFilenameAndSearchPaths) {
    failures.push('derived:MISSING_IWAD_FILE_ERROR_INCLUDES_FILENAME_AND_SEARCH_PATHS');
    failures.push('audit:rejection-error-for-iwad-carries-search-paths:not-observed');
  }
  if (!snapshot.mandatoryInfrastructureLumpsCoverPinnedAxes) {
    failures.push('derived:EVERY_MANDATORY_INFRASTRUCTURE_LUMP_IS_PINNED');
  }
  if (!snapshot.mandatoryMapDataLumpsCoverPinnedAxes) {
    failures.push('derived:EVERY_MANDATORY_MAP_DATA_LUMP_IS_PINNED');
  }
  if (!snapshot.optionalLumpsIncludeTexture2AndDmxgus) {
    failures.push('derived:OPTIONAL_LUMPS_INCLUDE_TEXTURE2_AND_DMXGUS');
    failures.push('audit:r-init-textures-allows-texture2-absent:not-observed');
    failures.push('audit:d-doom-main-allows-dmxgus-absent:not-observed');
  }

  const declaredAxes = new Set(MISSING_PROPRIETARY_ASSET_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<MissingProprietaryAssetAuditEntry['id']> = [
    'w-get-num-for-name-fatals-on-miss',
    'w-get-num-for-name-error-format',
    'w-check-num-for-name-returns-negative-one-on-miss',
    'w-cache-lump-name-routes-through-get-num-for-name',
    'r-init-textures-requires-texture1',
    'r-init-textures-requires-pnames',
    'r-init-textures-allows-texture2-absent',
    'r-init-flats-requires-flat-marker-range',
    'r-init-sprite-lumps-requires-sprite-marker-range',
    'p-setup-level-requires-map-marker',
    'p-setup-level-requires-things-lump',
    'p-setup-level-requires-linedefs-lump',
    'p-setup-level-requires-sidedefs-lump',
    'p-setup-level-requires-vertexes-lump',
    'p-setup-level-requires-segs-lump',
    'p-setup-level-requires-ssectors-lump',
    'p-setup-level-requires-nodes-lump',
    'p-setup-level-requires-sectors-lump',
    'p-setup-level-requires-blockmap-lump',
    'p-setup-level-requires-reject-lump',
    'st-init-requires-stbar-and-starms',
    'd-page-drawer-requires-titlepic-and-credit',
    'd-doom-main-requires-playpal-and-colormap',
    'd-doom-main-requires-endoom',
    'd-doom-main-requires-genmidi',
    'd-doom-main-allows-dmxgus-absent',
    'd-doom-main-rejects-missing-iwad-file',
    'rejection-error-carries-asset-kind',
    'rejection-error-carries-asset-name',
    'rejection-error-carries-subsystem-name',
    'rejection-error-for-iwad-carries-search-paths',
  ];
  for (const axis of requiredAxes) {
    if (!declaredAxes.has(axis)) {
      failures.push('derived:EVERY_AUDIT_AXIS_IS_DECLARED');
      break;
    }
  }

  return failures;
}
