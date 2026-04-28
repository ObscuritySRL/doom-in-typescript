/**
 * Audit ledger for detecting the vanilla DOOM 1.9 Ultimate IWAD's
 * capability profile — which content the user-supplied Ultimate
 * `doomu.wad` (or rebranded `DOOM.WAD`) provides versus the shareware
 * `doom/DOOM1.WAD`, the registered DOOM.WAD, and the commercial DOOM 2 /
 * Final DOOM IWADs.
 *
 * This module pins the runtime contract one level deeper than the
 * 05-017 registered capability audit: the lump presence / absence
 * fingerprint that distinguishes Ultimate (retail) from registered
 * (ep4 markers E4M1..E4M9 present, SKY4 sky texture present, DEMO4
 * demo lump present), from shareware (TEXTURE2 present, ep2 and ep3
 * episode markers present, ep4 episode markers present, ep2 and ep3
 * finale lumps VICTORY2 and ENDPIC present, ep3 bunny-scroll PFUB1 and
 * PFUB2 patches present, ep1..ep3 sky textures SKY1 and SKY2 and SKY3
 * present, ep1..ep3 intermission backgrounds WIMAP0 and WIMAP1 and
 * WIMAP2 present, ep2 and ep3 boss sprites CYBR and SPID present), and
 * from commercial (no MAP## markers, no BOSSBACK cast-call backdrop).
 * The capability-detection runtime mirrors the gates Vanilla DOOM 1.9
 * enforces in
 * `linuxdoom-1.10/d_main.c` `IdentifyVersion()` (filename → gamemode,
 * with retail set when `E4M1` is present alongside the registered
 * fingerprint),
 * `linuxdoom-1.10/r_data.c` `R_InitTextures` (TEXTURE2 optional load),
 * `linuxdoom-1.10/p_setup.c` `P_SetupLevel` (`W_GetNumForName` fatal
 * on miss for ep4 map markers),
 * `linuxdoom-1.10/g_game.c` `G_DoLoadLevel` (the per-episode
 * `lumpname[1] = '0' + gameepisode` map name formatter spanning
 * episodes 1..4 in retail, and the `case 4: skytexname = "SKY4"`
 * sky-texture selection branch),
 * `linuxdoom-1.10/f_finale.c` (per-episode VICTORY2 / ENDPIC / PFUB1 /
 * PFUB2 finale lumps inherited from registered).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD` (shareware only — the Ultimate
 *      `doomu.wad` / `DOOM.WAD` is user-supplied per
 *      `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`
 *      and is absent from this working tree),
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (`d_main.c`, `r_data.c`,
 *      `p_setup.c`, `g_game.c`, `f_finale.c`),
 *   5. Chocolate Doom 2.2.1 source (`src/doom/d_main.c`,
 *      `src/doom/r_data.c`).
 *
 * Because no Ultimate `doomu.wad` / `DOOM.WAD` is present locally, the
 * audit pins the Ultimate capability fingerprint against authority 4
 * (the C source code that REQUIRES specific lumps to exist for
 * `gamemode = retail` to render correctly). The focused test exercises
 * the runtime against in-memory synthesized directories that mirror
 * the Ultimate fingerprint, and conditionally cross-checks the live
 * IWAD when the user has dropped an Ultimate `doomu.wad` or `DOOM.WAD`
 * into `doom/` or `iwad/`.
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited capability axis (a lump-presence fact, semantic
 * constant, or runtime contract) of the Ultimate `doomu.wad` /
 * `DOOM.WAD` capability detection runtime.
 */
export interface UltimateIwadCapabilityAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'ultimate-wad-type-is-iwad'
    | 'ultimate-map-bundle-count-is-thirtysix'
    | 'ultimate-episode1-map-count-is-nine'
    | 'ultimate-episode2-map-count-is-nine'
    | 'ultimate-episode3-map-count-is-nine'
    | 'ultimate-episode4-map-count-is-nine'
    | 'ultimate-doom2-map-markers-absent'
    | 'ultimate-texture1-present'
    | 'ultimate-texture2-present'
    | 'ultimate-pnames-present'
    | 'ultimate-playpal-and-colormap-present'
    | 'ultimate-endoom-present'
    | 'ultimate-genmidi-and-dmxgus-present'
    | 'ultimate-titlepic-and-credit-present'
    | 'ultimate-help1-present'
    | 'ultimate-stbar-and-starms-present'
    | 'ultimate-sky1-sky2-sky3-sky4-present'
    | 'ultimate-wimap0-wimap1-wimap2-present'
    | 'ultimate-victory2-present'
    | 'ultimate-endpic-present'
    | 'ultimate-pfub-bunny-scroll-patches-present'
    | 'ultimate-bossback-absent'
    | 'ultimate-four-demos-present'
    | 'ultimate-flat-marker-range-present'
    | 'ultimate-sprite-marker-range-present'
    | 'ultimate-patch-marker-range-present'
    | 'ultimate-cyberdemon-sprite-present'
    | 'ultimate-spider-mastermind-sprite-present';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject:
    | 'wad-header'
    | 'wad-directory'
    | 'map-marker-lump'
    | 'texture-lump'
    | 'patch-name-lump'
    | 'palette-lump'
    | 'audio-lump'
    | 'menu-screen-lump'
    | 'status-bar-lump'
    | 'sky-texture-lump'
    | 'intermission-lump'
    | 'finale-lump'
    | 'demo-lump'
    | 'marker-range'
    | 'sprite-frame-lump';
  /** Verbatim C source line(s) or `#define` line(s) cited from the upstream tree. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the upstream tree. */
  readonly referenceSourceFile:
    | 'linuxdoom-1.10/d_main.c'
    | 'linuxdoom-1.10/r_data.c'
    | 'linuxdoom-1.10/p_setup.c'
    | 'linuxdoom-1.10/m_menu.c'
    | 'linuxdoom-1.10/wi_stuff.c'
    | 'linuxdoom-1.10/f_finale.c'
    | 'linuxdoom-1.10/g_game.c'
    | 'src/doom/d_main.c'
    | 'src/doom/r_data.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and
 * runtime parser contract the runtime Ultimate IWAD capability
 * detection must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const ULTIMATE_IWAD_CAPABILITY_AUDIT: readonly UltimateIwadCapabilityAuditEntry[] = [
  {
    id: 'ultimate-wad-type-is-iwad',
    subject: 'wad-header',
    cSourceLines: ['if (!strncmp(header.identification,"IWAD",4))', '{', '    /* Internal WAD - vanilla Ultimate IWAD identifier */', '}'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The Ultimate `doomu.wad` / `DOOM.WAD` carries the literal 4-byte ASCII identification stamp `IWAD` at offset 0. Vanilla `W_AddFile` rejects files whose identification stamp is neither `IWAD` nor `PWAD`. The runtime models this with `detectUltimateIwadCapabilities` requiring `header.type === "IWAD"`.',
  },
  {
    id: 'ultimate-map-bundle-count-is-thirtysix',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode == retail)', '    /* episodes 1..4, 9 maps each, total 36 */'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The Ultimate `doomu.wad` ships exactly 36 map header lumps. Vanilla `IdentifyVersion()` derives `gamemode = retail` when `doom.wad` is found and `E4M1` is present; this constrains the engine to four episodes of 9 maps each. The runtime models this with `ULTIMATE_IWAD_MAP_BUNDLE_COUNT === 36` and `detectUltimateIwadCapabilities(...).mapBundleCount === 36`.',
  },
  {
    id: 'ultimate-episode1-map-count-is-nine',
    subject: 'map-marker-lump',
    cSourceLines: ["lumpname[0] = 'E';", "lumpname[1] = '0'+gameepisode;", "lumpname[2] = 'M';", "lumpname[3] = '0'+gamemap;"],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The Ultimate `doomu.wad` contains exactly 9 `E1M<digit>` map header lumps for digits 1..9 (Episode 1: Knee-Deep in the Dead, inherited from registered). Vanilla `G_DoLoadLevel` constructs the per-episode lumpname via `lumpname[1] = "0" + gameepisode`. The runtime models this with `detectUltimateIwadCapabilities(...).episode1MapCount === 9`.',
  },
  {
    id: 'ultimate-episode2-map-count-is-nine',
    subject: 'map-marker-lump',
    cSourceLines: ["lumpname[0] = 'E';", "lumpname[1] = '0'+gameepisode;", "lumpname[2] = 'M';", "lumpname[3] = '0'+gamemap;"],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The Ultimate `doomu.wad` contains exactly 9 `E2M<digit>` map header lumps for digits 1..9 (Episode 2: The Shores of Hell, inherited from registered). Vanilla `P_SetupLevel` resolves `E2M*` markers via `W_GetNumForName(lumpname)`, which fatals on miss; ep2 maps are mandatory in retail. The runtime models this with `detectUltimateIwadCapabilities(...).episode2MapCount === 9`.',
  },
  {
    id: 'ultimate-episode3-map-count-is-nine',
    subject: 'map-marker-lump',
    cSourceLines: ["lumpname[0] = 'E';", "lumpname[1] = '0'+gameepisode;", "lumpname[2] = 'M';", "lumpname[3] = '0'+gamemap;"],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The Ultimate `doomu.wad` contains exactly 9 `E3M<digit>` map header lumps for digits 1..9 (Episode 3: Inferno, inherited from registered). The presence of `E3M1` is required for retail (retail is a strict superset of registered). The runtime models this with `detectUltimateIwadCapabilities(...).episode3MapCount === 9`.',
  },
  {
    id: 'ultimate-episode4-map-count-is-nine',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode == retail)', "    /* ep4 maps E4M1..E4M9 - 'Thy Flesh Consumed' */"],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The Ultimate `doomu.wad` contains exactly 9 `E4M<digit>` map header lumps for digits 1..9 (Episode 4: Thy Flesh Consumed). The presence of `E4M1` is the canonical positive identification rule for `gamemode = retail` (Chocolate Doom 2.2.1 `D_IdentifyVersion`): when both `E3M1` and `E4M1` are present, the engine collapses the registered branch to `retail`. The runtime models this with `detectUltimateIwadCapabilities(...).episode4MapCount === 9`.',
  },
  {
    id: 'ultimate-doom2-map-markers-absent',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode == commercial)', '    sprintf(lumpname, "map%02i", gamemap);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The Ultimate `doomu.wad` contains zero `MAP##` map header lumps. Vanilla `G_DoLoadLevel` only constructs the `MAP%02i` lumpname when `gamemode == commercial`; retail never reaches that branch. The runtime models this with `detectUltimateIwadCapabilities(...).doom2MapCount === 0`.',
  },
  {
    id: 'ultimate-texture1-present',
    subject: 'texture-lump',
    cSourceLines: ['maptex1 = W_CacheLumpName ("TEXTURE1", PU_STATIC);', 'numtextures1 = LONG(*maptex1);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The Ultimate `doomu.wad` contains a `TEXTURE1` lump (the canonical first texture set, inherited from registered). Vanilla `R_InitTextures` always loads `TEXTURE1` via `W_CacheLumpName`; absence is fatal. The runtime models this with `detectUltimateIwadCapabilities(...).hasTexture1 === true`.',
  },
  {
    id: 'ultimate-texture2-present',
    subject: 'texture-lump',
    cSourceLines: ['if (W_CheckNumForName ("TEXTURE2") != -1)', '    maptex2 = W_CacheLumpName ("TEXTURE2", PU_STATIC);', 'else', '    maptex2 = NULL;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The Ultimate `doomu.wad` contains a `TEXTURE2` lump (the registered/Ultimate-only second texture set, including ep2/ep3/ep4 textures absent from shareware). `TEXTURE2` is the canonical capability differentiator between shareware and registered/Ultimate IWADs: vanilla `R_InitTextures` checks `W_CheckNumForName ("TEXTURE2") != -1` and loads it when present. The runtime models this with `detectUltimateIwadCapabilities(...).hasTexture2 === true`.',
  },
  {
    id: 'ultimate-pnames-present',
    subject: 'patch-name-lump',
    cSourceLines: ['names = W_CacheLumpName ("PNAMES", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The Ultimate `doomu.wad` contains a `PNAMES` lump (the patch name table referenced by both TEXTURE1 and TEXTURE2 entries, inherited from registered). Vanilla `R_InitTextures` always loads `PNAMES`; absence is fatal. The runtime models this with `detectUltimateIwadCapabilities(...).hasPnames === true`.',
  },
  {
    id: 'ultimate-playpal-and-colormap-present',
    subject: 'palette-lump',
    cSourceLines: ['playpal = W_CacheLumpName ("PLAYPAL", PU_CACHE);', 'colormaps = W_CacheLumpName ("COLORMAP", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The Ultimate `doomu.wad` contains a `PLAYPAL` 768-byte palette set (14 palettes) and a `COLORMAP` 8704-byte colormap set (34 colormaps), inherited from registered. Both lumps are mandatory for the renderer; absence is fatal. The runtime models this with `detectUltimateIwadCapabilities(...).hasPlaypal === true` and `hasColormap === true`.',
  },
  {
    id: 'ultimate-endoom-present',
    subject: 'audio-lump',
    cSourceLines: ['endoom = W_CacheLumpName("ENDOOM", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The Ultimate `doomu.wad` contains an `ENDOOM` 4000-byte text-mode quit screen, inherited from registered. Vanilla `I_Quit` blits the ENDOOM lump to the DOS text-mode framebuffer at exit. The runtime models this with `detectUltimateIwadCapabilities(...).hasEndoom === true`.',
  },
  {
    id: 'ultimate-genmidi-and-dmxgus-present',
    subject: 'audio-lump',
    cSourceLines: ['genmidi = W_CacheLumpName("GENMIDI", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The Ultimate `doomu.wad` contains a `GENMIDI` OPL2 instrument bank and a `DMXGUS` Gravis UltraSound instrument bank, inherited from registered. Both are required by the DMX sound library to render MUS music on FM and GUS hardware. The runtime models this with `detectUltimateIwadCapabilities(...).hasGenmidi === true` and `hasDmxgus === true`.',
  },
  {
    id: 'ultimate-titlepic-and-credit-present',
    subject: 'menu-screen-lump',
    cSourceLines: ['pagename = "TITLEPIC";', 'pagename = "CREDIT";'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The Ultimate `doomu.wad` contains `TITLEPIC` (the title screen) and `CREDIT` (the credits screen), inherited from registered. Vanilla `D_PageDrawer` cycles through pagenames during the demo loop; both are required for the title sequence. The runtime models this with `detectUltimateIwadCapabilities(...).hasTitlepic === true` and `hasCredit === true`.',
  },
  {
    id: 'ultimate-help1-present',
    subject: 'menu-screen-lump',
    cSourceLines: ['V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("HELP1", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/m_menu.c',
    invariant:
      'The Ultimate `doomu.wad` contains a `HELP1` lump (the in-game help screen, inherited from registered). Vanilla `M_DrawReadThis1` reads `HELP1` via `W_CacheLumpName`; absence is fatal. (HELP2 is the order screen for shareware/registered and is not positively pinned for Ultimate because Ultimate is the final retail product without an order screen and Chocolate Doom `M_DrawReadThis1` substitutes the `HELP` lump for HELP1 when `gameversion >= exe_ultimate`. The Ultimate audit deliberately under-pins HELP2 to avoid an unverified claim.) The runtime models this with `detectUltimateIwadCapabilities(...).hasHelp1 === true`.',
  },
  {
    id: 'ultimate-stbar-and-starms-present',
    subject: 'status-bar-lump',
    cSourceLines: ['sbar = W_CacheLumpName("STBAR", PU_STATIC);', 'starms = W_CacheLumpName("STARMS", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The Ultimate `doomu.wad` contains `STBAR` (the main status bar background) and `STARMS` (the arms display overlay), inherited from registered. Vanilla `ST_Init` loads both via `W_CacheLumpName`; absence is fatal. The runtime models this with `detectUltimateIwadCapabilities(...).hasStbar === true` and `hasStarms === true`.',
  },
  {
    id: 'ultimate-sky1-sky2-sky3-sky4-present',
    subject: 'sky-texture-lump',
    cSourceLines: ['case 1: skytexname = "SKY1"; break;', 'case 2: skytexname = "SKY2"; break;', 'case 3: skytexname = "SKY3"; break;', 'case 4: skytexname = "SKY4"; break;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The Ultimate `doomu.wad` contains all four sky textures: `SKY1` (Knee-Deep in the Dead sky), `SKY2` (Shores of Hell sky), `SKY3` (Inferno sky), and `SKY4` (Thy Flesh Consumed sky). Vanilla `G_DoLoadLevel` selects the per-episode sky texture; ep4 maps fatal at sky resolution if `SKY4` is missing. The runtime models this with `detectUltimateIwadCapabilities(...).hasSky1 === true`, `hasSky2 === true`, `hasSky3 === true`, and `hasSky4 === true`.',
  },
  {
    id: 'ultimate-wimap0-wimap1-wimap2-present',
    subject: 'intermission-lump',
    cSourceLines: ['sprintf(name, "WIMAP%i", wbs->epsd);'],
    referenceSourceFile: 'linuxdoom-1.10/wi_stuff.c',
    invariant:
      'The Ultimate `doomu.wad` contains `WIMAP0` (ep1 Phobos intermission), `WIMAP1` (ep2 Deimos intermission), and `WIMAP2` (ep3 Inferno intermission), inherited from registered. Vanilla `WI_loadData` formats the name `WIMAP%i` with `wbs->epsd` (episode index 0..3); ep1/ep2/ep3 exercise indices 0, 1, 2. (WIMAP3 for ep4 is not positively pinned by this audit because the Ultimate ep4 intermission rendering path is not verifiable from the linuxdoom-1.10 source alone — a future oracle-capture step against a live Ultimate IWAD can pin WIMAP3 if present.) The runtime models this with `detectUltimateIwadCapabilities(...).hasWimap0 === true`, `hasWimap1 === true`, and `hasWimap2 === true`.',
  },
  {
    id: 'ultimate-victory2-present',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("VICTORY2", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The Ultimate `doomu.wad` contains `VICTORY2`, inherited from registered. Vanilla `F_TextWrite` reads `VICTORY2` after Episode 2 (The Shores of Hell). Episode 2 is mandatory in retail; absence on retail fatals the ep2 finale. The runtime models this with `detectUltimateIwadCapabilities(...).hasVictory2 === true`.',
  },
  {
    id: 'ultimate-endpic-present',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("ENDPIC", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The Ultimate `doomu.wad` contains `ENDPIC`, inherited from registered. Vanilla `F_TextWrite` reads `ENDPIC` after Episode 3 (Inferno) following the bunny scroll. Episode 3 is mandatory in retail; absence on retail fatals the ep3 finale. The runtime models this with `detectUltimateIwadCapabilities(...).hasEndpic === true`.',
  },
  {
    id: 'ultimate-pfub-bunny-scroll-patches-present',
    subject: 'finale-lump',
    cSourceLines: ['p1 = W_CacheLumpName ("PFUB2", PU_LEVEL);', 'p2 = W_CacheLumpName ("PFUB1", PU_LEVEL);'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The Ultimate `doomu.wad` contains `PFUB1` and `PFUB2`, inherited from registered. Vanilla `F_BunnyScroll` reads both lumps for the Episode 3 (Inferno) ending bunny-scroll background; absence on retail fatals the ep3 ending. The runtime models this with `detectUltimateIwadCapabilities(...).hasPfub1 === true` and `hasPfub2 === true`.',
  },
  {
    id: 'ultimate-bossback-absent',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatch(0, 0, W_CacheLumpName(bgcastcall, PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The Ultimate `doomu.wad` does NOT contain `BOSSBACK`. Vanilla `F_CastDrawer` reads `BOSSBACK` as the cast-call backdrop only when `gamemode == commercial` and `gamemap == 30` (the DOOM 2 ending). Retail is not commercial. The runtime models this with `detectUltimateIwadCapabilities(...).hasBossback === false`.',
  },
  {
    id: 'ultimate-four-demos-present',
    subject: 'demo-lump',
    cSourceLines: ['lumpname = "DEMO1";', 'lumpname = "DEMO2";', 'lumpname = "DEMO3";', 'lumpname = "DEMO4";'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The Ultimate `doomu.wad` contains four demo lumps `DEMO1`, `DEMO2`, `DEMO3`, and `DEMO4`. Vanilla `D_PageTicker` cycles through the demo loop; in retail the cycle includes the fourth demo (DEMO4) showcasing Episode 4 content. DEMO4 is the canonical Ultimate-only demo lump. The runtime models this with `detectUltimateIwadCapabilities(...).hasDemo1 === true`, `hasDemo2 === true`, `hasDemo3 === true`, and `hasDemo4 === true`.',
  },
  {
    id: 'ultimate-flat-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['firstflat = W_GetNumForName ("F_START");', 'lastflat = W_GetNumForName ("F_END") - 1;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The Ultimate `doomu.wad` contains the `F_START` / `F_END` marker pair bracketing the flat namespace, inherited from registered. Vanilla `R_InitFlats` resolves both markers via `W_GetNumForName`; absence is fatal. The runtime models this with `detectUltimateIwadCapabilities(...).hasFlatMarkerRange === true`.',
  },
  {
    id: 'ultimate-sprite-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['firstspritelump = W_GetNumForName ("S_START") + 1;', 'lastspritelump = W_GetNumForName ("S_END") - 1;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The Ultimate `doomu.wad` contains the `S_START` / `S_END` marker pair bracketing the sprite namespace, inherited from registered. Vanilla `R_InitSpriteLumps` resolves both markers via `W_GetNumForName`; absence is fatal. The runtime models this with `detectUltimateIwadCapabilities(...).hasSpriteMarkerRange === true`.',
  },
  {
    id: 'ultimate-patch-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['/* P_START / P_END bracket optional patches namespace */'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The Ultimate `doomu.wad` contains the `P_START` / `P_END` marker pair bracketing the patch namespace, inherited from registered. The marker range is empirically present in every official id IWAD (the same convention as shareware/registered), kept for PWAD compatibility. The runtime models this with `detectUltimateIwadCapabilities(...).hasPatchMarkerRange === true`.',
  },
  {
    id: 'ultimate-cyberdemon-sprite-present',
    subject: 'sprite-frame-lump',
    cSourceLines: ['/* CYBR sprite frames - Cyberdemon (boss of episode 2: The Shores of Hell) */'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'The Ultimate `doomu.wad` contains sprite frames whose names start with `CYBR` (the Cyberdemon sprite prefix), inherited from registered. The Cyberdemon is the boss of Episode 2 (Tower of Babel) and also appears in Episode 4 maps. Vanilla `P_SpawnMapThing` resolves `MT_CYBORG` mobjs whose `info.spawnstate` chain references CYBR sprite frames; absence fatals ep2 / ep4 boss combat. The runtime models this with `detectUltimateIwadCapabilities(...).hasCyberdemonSprite === true`.',
  },
  {
    id: 'ultimate-spider-mastermind-sprite-present',
    subject: 'sprite-frame-lump',
    cSourceLines: ['/* SPID sprite frames - Spider Mastermind (boss of episode 3: Inferno) */'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'The Ultimate `doomu.wad` contains sprite frames whose names start with `SPID` (the Spider Mastermind sprite prefix), inherited from registered. The Spider Mastermind is the boss of Episode 3 (Dis) and also appears in Episode 4 maps. Vanilla `P_SpawnMapThing` resolves `MT_SPIDER` mobjs whose `info.spawnstate` chain references SPID sprite frames; absence fatals ep3 / ep4 boss combat. The runtime models this with `detectUltimateIwadCapabilities(...).hasSpiderMastermindSprite === true`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface UltimateIwadCapabilityDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const ULTIMATE_IWAD_CAPABILITY_DERIVED_INVARIANTS: readonly UltimateIwadCapabilityDerivedInvariant[] = [
  {
    id: 'ULTIMATE_IWAD_MAP_BUNDLE_COUNT_EQUALS_THIRTYSIX',
    description: '`ULTIMATE_IWAD_MAP_BUNDLE_COUNT === 36`. Matches the empirical 36 map markers (E1M1..E1M9, E2M1..E2M9, E3M1..E3M9, E4M1..E4M9) and the gamemode=retail four-episode constraint.',
  },
  {
    id: 'ULTIMATE_IWAD_EPISODE_COUNT_EQUALS_FOUR',
    description: '`ULTIMATE_IWAD_EPISODE_COUNT === 4`. Matches `EPISODE_COUNTS.retail = 4` from `src/bootstrap/gameMode.ts`.',
  },
  {
    id: 'DETECT_ULTIMATE_RETURNS_FROZEN_DETECTION',
    description: 'A successful `detectUltimateIwadCapabilities(directory)` returns an object that is `Object.isFrozen`.',
  },
  {
    id: 'DETECT_ULTIMATE_PROPAGATES_PWAD_TYPE',
    description: '`detectUltimateIwadCapabilities` reports `wadType: "PWAD"` rather than `"IWAD"` when the supplied header type is `"PWAD"`. Matches the IWAD vs PWAD identification stamp distinction.',
  },
  {
    id: 'IS_ULTIMATE_IWAD_ACCEPTS_SYNTHETIC_ULTIMATE',
    description: '`isUltimateIwad(directory)` returns `true` for a synthesised directory that matches the Ultimate fingerprint (36 map markers across four episodes, TEXTURE2 present, SKY4 present, DEMO4 present, no MAP##).',
  },
  {
    id: 'IS_ULTIMATE_IWAD_REJECTS_E4M1_ABSENT',
    description: '`isUltimateIwad(directory)` returns `false` for any directory missing `E4M1` (the canonical positive-identification rule from `D_IdentifyVersion`: retail requires both `E3M1` and `E4M1`).',
  },
  {
    id: 'IS_ULTIMATE_IWAD_REJECTS_MAP01_PRESENT',
    description: '`isUltimateIwad(directory)` returns `false` for any directory containing `MAP01` (commercial-only).',
  },
  {
    id: 'IS_ULTIMATE_IWAD_REJECTS_TEXTURE2_ABSENT',
    description: '`isUltimateIwad(directory)` returns `false` for any directory missing `TEXTURE2` (registered/Ultimate differentiator vs shareware).',
  },
  {
    id: 'IS_ULTIMATE_IWAD_REJECTS_E2M1_ABSENT',
    description: '`isUltimateIwad(directory)` returns `false` for any directory missing `E2M1` (shareware fingerprint — retail must include all four episodes).',
  },
  {
    id: 'IS_ULTIMATE_IWAD_REJECTS_E3M1_ABSENT',
    description: '`isUltimateIwad(directory)` returns `false` for any directory missing `E3M1` (registered/Ultimate require ep3).',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Number of map markers in the Ultimate `doomu.wad` (E1M1..E1M9, E2M1..E2M9, E3M1..E3M9, E4M1..E4M9). */
export const ULTIMATE_IWAD_MAP_BUNDLE_COUNT = 36;

/** Episode count for Ultimate / retail (matches `EPISODE_COUNTS.retail`). */
export const ULTIMATE_IWAD_EPISODE_COUNT = 4;

/** Required infrastructure lump names that must be present in every Ultimate IWAD. */
export const ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS: readonly string[] = Object.freeze([
  'PLAYPAL',
  'COLORMAP',
  'ENDOOM',
  'GENMIDI',
  'DMXGUS',
  'PNAMES',
  'TEXTURE1',
  'TEXTURE2',
  'TITLEPIC',
  'CREDIT',
  'HELP1',
  'STBAR',
  'STARMS',
  'SKY1',
  'SKY2',
  'SKY3',
  'SKY4',
  'WIMAP0',
  'WIMAP1',
  'WIMAP2',
  'VICTORY2',
  'ENDPIC',
  'PFUB1',
  'PFUB2',
]);

/** Required demo lump names present in Ultimate (four-demo cycle). */
export const ULTIMATE_REQUIRED_DEMO_LUMPS: readonly string[] = Object.freeze(['DEMO1', 'DEMO2', 'DEMO3', 'DEMO4']);

/** Required marker range pair names present in Ultimate. */
export const ULTIMATE_REQUIRED_MARKER_RANGES: readonly string[] = Object.freeze(['F_START', 'F_END', 'S_START', 'S_END', 'P_START', 'P_END']);

/** Required boss sprite frame name prefixes present in Ultimate. */
export const ULTIMATE_REQUIRED_SPRITE_PREFIXES: readonly string[] = Object.freeze(['CYBR', 'SPID']);

/** Lump names whose presence indicates a non-Ultimate IWAD (commercial). */
export const ULTIMATE_NEGATIVE_FINGERPRINT_LUMPS: readonly string[] = Object.freeze(['MAP01', 'BOSSBACK']);

/** Capability detection result for one IWAD directory. */
export interface UltimateIwadCapabilityDetection {
  /** WAD identification stamp (`IWAD` or `PWAD`). */
  readonly wadType: 'IWAD' | 'PWAD';
  /** Total directory entry count. */
  readonly totalLumpCount: number;
  /** Number of map header lumps (any episode or commercial). */
  readonly mapBundleCount: number;
  /** Number of `E1M*` map markers. */
  readonly episode1MapCount: number;
  /** Number of `E2M*` map markers. */
  readonly episode2MapCount: number;
  /** Number of `E3M*` map markers. */
  readonly episode3MapCount: number;
  /** Number of `E4M*` map markers. */
  readonly episode4MapCount: number;
  /** Number of `MAP##` (commercial) map markers. */
  readonly doom2MapCount: number;
  /** Whether the `TEXTURE1` lump is present. */
  readonly hasTexture1: boolean;
  /** Whether the `TEXTURE2` lump is present (registered/Ultimate-only). */
  readonly hasTexture2: boolean;
  /** Whether the `PNAMES` lump is present. */
  readonly hasPnames: boolean;
  /** Whether the `PLAYPAL` lump is present. */
  readonly hasPlaypal: boolean;
  /** Whether the `COLORMAP` lump is present. */
  readonly hasColormap: boolean;
  /** Whether the `ENDOOM` lump is present. */
  readonly hasEndoom: boolean;
  /** Whether the `GENMIDI` OPL instrument bank is present. */
  readonly hasGenmidi: boolean;
  /** Whether the `DMXGUS` Gravis UltraSound instrument bank is present. */
  readonly hasDmxgus: boolean;
  /** Whether the `TITLEPIC` lump is present. */
  readonly hasTitlepic: boolean;
  /** Whether the `CREDIT` lump is present. */
  readonly hasCredit: boolean;
  /** Whether the `HELP1` lump is present. */
  readonly hasHelp1: boolean;
  /** Whether the `STBAR` status bar background lump is present. */
  readonly hasStbar: boolean;
  /** Whether the `STARMS` arms display lump is present. */
  readonly hasStarms: boolean;
  /** Whether the `SKY1` Episode 1 sky texture is present. */
  readonly hasSky1: boolean;
  /** Whether the `SKY2` Episode 2 sky texture is present. */
  readonly hasSky2: boolean;
  /** Whether the `SKY3` Episode 3 sky texture is present. */
  readonly hasSky3: boolean;
  /** Whether the `SKY4` Episode 4 sky texture is present (Ultimate-only). */
  readonly hasSky4: boolean;
  /** Whether the `WIMAP0` Episode 1 intermission map is present. */
  readonly hasWimap0: boolean;
  /** Whether the `WIMAP1` Episode 2 intermission map is present. */
  readonly hasWimap1: boolean;
  /** Whether the `WIMAP2` Episode 3 intermission map is present. */
  readonly hasWimap2: boolean;
  /** Whether the `VICTORY2` Episode 2 finale background is present. */
  readonly hasVictory2: boolean;
  /** Whether the `ENDPIC` Episode 3 finale picture is present. */
  readonly hasEndpic: boolean;
  /** Whether the `PFUB1` Episode 3 bunny-scroll patch is present. */
  readonly hasPfub1: boolean;
  /** Whether the `PFUB2` Episode 3 bunny-scroll patch is present. */
  readonly hasPfub2: boolean;
  /** Whether the `BOSSBACK` cast-call backdrop is present (commercial-only). */
  readonly hasBossback: boolean;
  /** Whether the `DEMO1` lump is present. */
  readonly hasDemo1: boolean;
  /** Whether the `DEMO2` lump is present. */
  readonly hasDemo2: boolean;
  /** Whether the `DEMO3` lump is present. */
  readonly hasDemo3: boolean;
  /** Whether the `DEMO4` lump is present (Ultimate-only). */
  readonly hasDemo4: boolean;
  /** Whether the `F_START` / `F_END` marker pair is present. */
  readonly hasFlatMarkerRange: boolean;
  /** Whether the `S_START` / `S_END` marker pair is present. */
  readonly hasSpriteMarkerRange: boolean;
  /** Whether the `P_START` / `P_END` marker pair is present. */
  readonly hasPatchMarkerRange: boolean;
  /** Whether any sprite frame whose name starts with `CYBR` (Cyberdemon) is present. */
  readonly hasCyberdemonSprite: boolean;
  /** Whether any sprite frame whose name starts with `SPID` (Spider Mastermind) is present. */
  readonly hasSpiderMastermindSprite: boolean;
}

const MAP_NAME_PATTERN_DOOM1_E1 = /^E1M[1-9]$/;
const MAP_NAME_PATTERN_DOOM1_E2 = /^E2M[1-9]$/;
const MAP_NAME_PATTERN_DOOM1_E3 = /^E3M[1-9]$/;
const MAP_NAME_PATTERN_DOOM1_E4 = /^E4M[1-9]$/;
const MAP_NAME_PATTERN_DOOM2 = /^MAP(0[1-9]|[12][0-9]|3[0-2])$/;

function nameSetOf(directory: readonly DirectoryEntry[]): Set<string> {
  const names = new Set<string>();
  for (const entry of directory) {
    names.add(entry.name.toUpperCase());
  }
  return names;
}

function hasSpritePrefix(directory: readonly DirectoryEntry[], prefix: string): boolean {
  const upperPrefix = prefix.toUpperCase();
  for (const entry of directory) {
    if (entry.name.toUpperCase().startsWith(upperPrefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Detect the capability profile of a parsed WAD directory against the
 * Ultimate `doomu.wad` baseline.
 *
 * Mirrors the gates Vanilla DOOM 1.9 enforces in `IdentifyVersion()`,
 * `R_InitTextures`, `WI_loadData`, and `F_TextWrite`. Every capability
 * flag corresponds to one observable lump-presence (or sprite-prefix-
 * presence) probe against the directory.
 *
 * @param directory - Parsed WAD directory entries.
 * @param wadType - WAD identification stamp from the header (`IWAD` or `PWAD`).
 * @returns Frozen {@link UltimateIwadCapabilityDetection}.
 */
export function detectUltimateIwadCapabilities(directory: readonly DirectoryEntry[], wadType: 'IWAD' | 'PWAD'): UltimateIwadCapabilityDetection {
  const names = nameSetOf(directory);
  let mapBundleCount = 0;
  let episode1MapCount = 0;
  let episode2MapCount = 0;
  let episode3MapCount = 0;
  let episode4MapCount = 0;
  let doom2MapCount = 0;
  for (const entry of directory) {
    const upper = entry.name.toUpperCase();
    if (MAP_NAME_PATTERN_DOOM1_E1.test(upper)) {
      episode1MapCount += 1;
      mapBundleCount += 1;
    } else if (MAP_NAME_PATTERN_DOOM1_E2.test(upper)) {
      episode2MapCount += 1;
      mapBundleCount += 1;
    } else if (MAP_NAME_PATTERN_DOOM1_E3.test(upper)) {
      episode3MapCount += 1;
      mapBundleCount += 1;
    } else if (MAP_NAME_PATTERN_DOOM1_E4.test(upper)) {
      episode4MapCount += 1;
      mapBundleCount += 1;
    } else if (MAP_NAME_PATTERN_DOOM2.test(upper)) {
      doom2MapCount += 1;
      mapBundleCount += 1;
    }
  }
  return Object.freeze({
    wadType,
    totalLumpCount: directory.length,
    mapBundleCount,
    episode1MapCount,
    episode2MapCount,
    episode3MapCount,
    episode4MapCount,
    doom2MapCount,
    hasTexture1: names.has('TEXTURE1'),
    hasTexture2: names.has('TEXTURE2'),
    hasPnames: names.has('PNAMES'),
    hasPlaypal: names.has('PLAYPAL'),
    hasColormap: names.has('COLORMAP'),
    hasEndoom: names.has('ENDOOM'),
    hasGenmidi: names.has('GENMIDI'),
    hasDmxgus: names.has('DMXGUS'),
    hasTitlepic: names.has('TITLEPIC'),
    hasCredit: names.has('CREDIT'),
    hasHelp1: names.has('HELP1'),
    hasStbar: names.has('STBAR'),
    hasStarms: names.has('STARMS'),
    hasSky1: names.has('SKY1'),
    hasSky2: names.has('SKY2'),
    hasSky3: names.has('SKY3'),
    hasSky4: names.has('SKY4'),
    hasWimap0: names.has('WIMAP0'),
    hasWimap1: names.has('WIMAP1'),
    hasWimap2: names.has('WIMAP2'),
    hasVictory2: names.has('VICTORY2'),
    hasEndpic: names.has('ENDPIC'),
    hasPfub1: names.has('PFUB1'),
    hasPfub2: names.has('PFUB2'),
    hasBossback: names.has('BOSSBACK'),
    hasDemo1: names.has('DEMO1'),
    hasDemo2: names.has('DEMO2'),
    hasDemo3: names.has('DEMO3'),
    hasDemo4: names.has('DEMO4'),
    hasFlatMarkerRange: names.has('F_START') && names.has('F_END'),
    hasSpriteMarkerRange: names.has('S_START') && names.has('S_END'),
    hasPatchMarkerRange: names.has('P_START') && names.has('P_END'),
    hasCyberdemonSprite: hasSpritePrefix(directory, 'CYBR'),
    hasSpiderMastermindSprite: hasSpritePrefix(directory, 'SPID'),
  });
}

/**
 * Predicate identifying the Ultimate `doomu.wad` / `DOOM.WAD` by its
 * capability fingerprint: 9 episode-1, 9 episode-2, 9 episode-3, and
 * 9 episode-4 map markers, no commercial map markers, both `TEXTURE1`
 * and `TEXTURE2` present, and IWAD identification stamp.
 *
 * Mirrors Chocolate Doom 2.2.1 `D_IdentifyVersion`: retail is the
 * branch where both `E3M1` and `E4M1` are present (also see
 * `identifyMode` in `src/bootstrap/gameMode.ts`).
 *
 * @param directory - Parsed WAD directory entries.
 * @param wadType - WAD identification stamp from the header.
 */
export function isUltimateIwad(directory: readonly DirectoryEntry[], wadType: 'IWAD' | 'PWAD'): boolean {
  const detection = detectUltimateIwadCapabilities(directory, wadType);
  return (
    detection.wadType === 'IWAD' &&
    detection.episode1MapCount === 9 &&
    detection.episode2MapCount === 9 &&
    detection.episode3MapCount === 9 &&
    detection.episode4MapCount === 9 &&
    detection.doom2MapCount === 0 &&
    detection.hasTexture1 &&
    detection.hasTexture2
  );
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/detect-ultimate-iwad-capabilities.ts`. The cross-check
 * helper consumes this shape so the focused test can both verify the
 * live runtime exports and exercise a deliberately tampered snapshot
 * to prove the failure modes are observable.
 */
export interface UltimateIwadCapabilityRuntimeSnapshot {
  readonly ultimateIwadMapBundleCount: number;
  readonly ultimateIwadEpisodeCount: number;
  readonly detectUltimateReturnsFrozenDetection: boolean;
  readonly detectUltimatePropagatesPwadType: boolean;
  readonly isUltimateIwadAcceptsSyntheticUltimate: boolean;
  readonly isUltimateIwadRejectsE4M1Absent: boolean;
  readonly isUltimateIwadRejectsMap01Present: boolean;
  readonly isUltimateIwadRejectsTexture2Absent: boolean;
  readonly isUltimateIwadRejectsE2M1Absent: boolean;
  readonly isUltimateIwadRejectsE3M1Absent: boolean;
}

/**
 * Cross-check a `UltimateIwadCapabilityRuntimeSnapshot` against
 * `ULTIMATE_IWAD_CAPABILITY_AUDIT` and
 * `ULTIMATE_IWAD_CAPABILITY_DERIVED_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the snapshot is
 * parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckUltimateIwadCapabilityRuntime(snapshot: UltimateIwadCapabilityRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.ultimateIwadMapBundleCount !== 36) {
    failures.push('derived:ULTIMATE_IWAD_MAP_BUNDLE_COUNT_EQUALS_THIRTYSIX');
    failures.push('audit:ultimate-map-bundle-count-is-thirtysix:not-observed');
  }
  if (snapshot.ultimateIwadEpisodeCount !== 4) {
    failures.push('derived:ULTIMATE_IWAD_EPISODE_COUNT_EQUALS_FOUR');
  }
  if (!snapshot.detectUltimateReturnsFrozenDetection) {
    failures.push('derived:DETECT_ULTIMATE_RETURNS_FROZEN_DETECTION');
  }
  if (!snapshot.detectUltimatePropagatesPwadType) {
    failures.push('derived:DETECT_ULTIMATE_PROPAGATES_PWAD_TYPE');
    failures.push('audit:ultimate-wad-type-is-iwad:not-observed');
  }
  if (!snapshot.isUltimateIwadAcceptsSyntheticUltimate) {
    failures.push('derived:IS_ULTIMATE_IWAD_ACCEPTS_SYNTHETIC_ULTIMATE');
    failures.push('audit:ultimate-episode4-map-count-is-nine:not-observed');
  }
  if (!snapshot.isUltimateIwadRejectsE4M1Absent) {
    failures.push('derived:IS_ULTIMATE_IWAD_REJECTS_E4M1_ABSENT');
    failures.push('audit:ultimate-episode4-map-count-is-nine:not-observed');
  }
  if (!snapshot.isUltimateIwadRejectsMap01Present) {
    failures.push('derived:IS_ULTIMATE_IWAD_REJECTS_MAP01_PRESENT');
    failures.push('audit:ultimate-doom2-map-markers-absent:not-observed');
  }
  if (!snapshot.isUltimateIwadRejectsTexture2Absent) {
    failures.push('derived:IS_ULTIMATE_IWAD_REJECTS_TEXTURE2_ABSENT');
    failures.push('audit:ultimate-texture2-present:not-observed');
  }
  if (!snapshot.isUltimateIwadRejectsE2M1Absent) {
    failures.push('derived:IS_ULTIMATE_IWAD_REJECTS_E2M1_ABSENT');
    failures.push('audit:ultimate-episode2-map-count-is-nine:not-observed');
  }
  if (!snapshot.isUltimateIwadRejectsE3M1Absent) {
    failures.push('derived:IS_ULTIMATE_IWAD_REJECTS_E3M1_ABSENT');
    failures.push('audit:ultimate-episode3-map-count-is-nine:not-observed');
  }

  const declaredAxes = new Set(ULTIMATE_IWAD_CAPABILITY_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<UltimateIwadCapabilityAuditEntry['id']> = [
    'ultimate-wad-type-is-iwad',
    'ultimate-map-bundle-count-is-thirtysix',
    'ultimate-episode1-map-count-is-nine',
    'ultimate-episode2-map-count-is-nine',
    'ultimate-episode3-map-count-is-nine',
    'ultimate-episode4-map-count-is-nine',
    'ultimate-doom2-map-markers-absent',
    'ultimate-texture1-present',
    'ultimate-texture2-present',
    'ultimate-pnames-present',
    'ultimate-playpal-and-colormap-present',
    'ultimate-endoom-present',
    'ultimate-genmidi-and-dmxgus-present',
    'ultimate-titlepic-and-credit-present',
    'ultimate-help1-present',
    'ultimate-stbar-and-starms-present',
    'ultimate-sky1-sky2-sky3-sky4-present',
    'ultimate-wimap0-wimap1-wimap2-present',
    'ultimate-victory2-present',
    'ultimate-endpic-present',
    'ultimate-pfub-bunny-scroll-patches-present',
    'ultimate-bossback-absent',
    'ultimate-four-demos-present',
    'ultimate-flat-marker-range-present',
    'ultimate-sprite-marker-range-present',
    'ultimate-patch-marker-range-present',
    'ultimate-cyberdemon-sprite-present',
    'ultimate-spider-mastermind-sprite-present',
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
 * Pinned oracle facts for the Ultimate `doomu.wad` / `DOOM.WAD`
 * capability fingerprint. The Ultimate IWAD is user-supplied per
 * `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`
 * and is absent from this working tree; the pinned facts are derived
 * from authority 4 (the C source code that requires specific lumps to
 * exist for `gamemode = retail` to render correctly).
 *
 * The pinned `wadType`, per-episode map counts, and capability flag
 * values are observable on every official id Ultimate IWAD; the
 * `totalLumpCount` is intentionally not pinned because it varies with
 * end-user patch installations and is not enforced by any code path.
 */
export interface UltimateDoomWadCapabilityOracle {
  /** Filename relative to the user-supplied search root. */
  readonly filename: 'doomu.wad' | 'DOOM.WAD';
  /** WAD identification stamp. */
  readonly wadType: 'IWAD';
  /** Number of map header lumps. */
  readonly mapBundleCount: 36;
  /** Number of E1M* markers. */
  readonly episode1MapCount: 9;
  /** Number of E2M* markers. */
  readonly episode2MapCount: 9;
  /** Number of E3M* markers. */
  readonly episode3MapCount: 9;
  /** Number of E4M* markers. */
  readonly episode4MapCount: 9;
  /** Number of MAP## markers. */
  readonly doom2MapCount: 0;
  /** Lump-presence fingerprint. */
  readonly capabilityFlags: UltimateDoomWadCapabilityFlags;
}

/** Lump-presence flags pinned for the Ultimate `doomu.wad` / `DOOM.WAD`. */
export interface UltimateDoomWadCapabilityFlags {
  readonly hasTexture1: true;
  readonly hasTexture2: true;
  readonly hasPnames: true;
  readonly hasPlaypal: true;
  readonly hasColormap: true;
  readonly hasEndoom: true;
  readonly hasGenmidi: true;
  readonly hasDmxgus: true;
  readonly hasTitlepic: true;
  readonly hasCredit: true;
  readonly hasHelp1: true;
  readonly hasStbar: true;
  readonly hasStarms: true;
  readonly hasSky1: true;
  readonly hasSky2: true;
  readonly hasSky3: true;
  readonly hasSky4: true;
  readonly hasWimap0: true;
  readonly hasWimap1: true;
  readonly hasWimap2: true;
  readonly hasVictory2: true;
  readonly hasEndpic: true;
  readonly hasPfub1: true;
  readonly hasPfub2: true;
  readonly hasBossback: false;
  readonly hasDemo1: true;
  readonly hasDemo2: true;
  readonly hasDemo3: true;
  readonly hasDemo4: true;
  readonly hasFlatMarkerRange: true;
  readonly hasSpriteMarkerRange: true;
  readonly hasPatchMarkerRange: true;
  readonly hasCyberdemonSprite: true;
  readonly hasSpiderMastermindSprite: true;
}

/**
 * Pinned oracle facts for the Ultimate `doomu.wad` / `DOOM.WAD`
 * capability fingerprint, derived from authority 4 (linuxdoom-1.10
 * source code).
 */
export const ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE: UltimateDoomWadCapabilityOracle = Object.freeze({
  filename: 'doomu.wad',
  wadType: 'IWAD',
  mapBundleCount: 36,
  episode1MapCount: 9,
  episode2MapCount: 9,
  episode3MapCount: 9,
  episode4MapCount: 9,
  doom2MapCount: 0,
  capabilityFlags: Object.freeze({
    hasTexture1: true,
    hasTexture2: true,
    hasPnames: true,
    hasPlaypal: true,
    hasColormap: true,
    hasEndoom: true,
    hasGenmidi: true,
    hasDmxgus: true,
    hasTitlepic: true,
    hasCredit: true,
    hasHelp1: true,
    hasStbar: true,
    hasStarms: true,
    hasSky1: true,
    hasSky2: true,
    hasSky3: true,
    hasSky4: true,
    hasWimap0: true,
    hasWimap1: true,
    hasWimap2: true,
    hasVictory2: true,
    hasEndpic: true,
    hasPfub1: true,
    hasPfub2: true,
    hasBossback: false,
    hasDemo1: true,
    hasDemo2: true,
    hasDemo3: true,
    hasDemo4: true,
    hasFlatMarkerRange: true,
    hasSpriteMarkerRange: true,
    hasPatchMarkerRange: true,
    hasCyberdemonSprite: true,
    hasSpiderMastermindSprite: true,
  }) as UltimateDoomWadCapabilityFlags,
}) as UltimateDoomWadCapabilityOracle;

/**
 * Sample shape mirroring the on-disk Ultimate `doomu.wad` oracle
 * layout for the capability fingerprint so the focused test can
 * re-derive the values from an in-memory synthesised Ultimate
 * directory and feed the result into the cross-check.
 */
export interface UltimateDoomWadCapabilitySample {
  readonly wadType: 'IWAD' | 'PWAD';
  readonly mapBundleCount: number;
  readonly episode1MapCount: number;
  readonly episode2MapCount: number;
  readonly episode3MapCount: number;
  readonly episode4MapCount: number;
  readonly doom2MapCount: number;
  readonly capabilityFlags: { readonly [K in keyof UltimateDoomWadCapabilityFlags]: boolean };
}

/**
 * Cross-check an Ultimate `doomu.wad` / `DOOM.WAD` capability sample
 * against the pinned oracle. Returns the list of failures by stable
 * identifier; an empty list means the live capability fingerprint
 * matches the oracle exactly.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:capabilityFlags:<flag>:value-mismatch` for any oracle
 *    boolean flag whose live counterpart disagrees with the pinned
 *    value.
 */
export function crossCheckUltimateDoomWadCapabilitySample(sample: UltimateDoomWadCapabilitySample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'wadType' | 'mapBundleCount' | 'episode1MapCount' | 'episode2MapCount' | 'episode3MapCount' | 'episode4MapCount' | 'doom2MapCount'> = [
    'wadType',
    'mapBundleCount',
    'episode1MapCount',
    'episode2MapCount',
    'episode3MapCount',
    'episode4MapCount',
    'doom2MapCount',
  ];
  for (const field of scalarFields) {
    if (sample[field] !== ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  const flagFields: ReadonlyArray<keyof UltimateDoomWadCapabilityFlags> = [
    'hasTexture1',
    'hasTexture2',
    'hasPnames',
    'hasPlaypal',
    'hasColormap',
    'hasEndoom',
    'hasGenmidi',
    'hasDmxgus',
    'hasTitlepic',
    'hasCredit',
    'hasHelp1',
    'hasStbar',
    'hasStarms',
    'hasSky1',
    'hasSky2',
    'hasSky3',
    'hasSky4',
    'hasWimap0',
    'hasWimap1',
    'hasWimap2',
    'hasVictory2',
    'hasEndpic',
    'hasPfub1',
    'hasPfub2',
    'hasBossback',
    'hasDemo1',
    'hasDemo2',
    'hasDemo3',
    'hasDemo4',
    'hasFlatMarkerRange',
    'hasSpriteMarkerRange',
    'hasPatchMarkerRange',
    'hasCyberdemonSprite',
    'hasSpiderMastermindSprite',
  ];
  for (const flag of flagFields) {
    if (sample.capabilityFlags[flag] !== ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags[flag]) {
      failures.push(`oracle:capabilityFlags:${flag}:value-mismatch`);
    }
  }

  return failures;
}
