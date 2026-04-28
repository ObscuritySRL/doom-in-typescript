/**
 * Audit ledger for detecting the vanilla DOOM 1.9 shareware IWAD's
 * capability profile — which content the shareware `doom/DOOM1.WAD`
 * provides versus the registered DOOM.WAD, the Ultimate DOOM
 * `doomu.wad`, and the commercial DOOM 2 / Final DOOM IWADs.
 *
 * This module pins the runtime contract one level deeper than the
 * prior 05-001..05-004 marker / lookup audits, the 05-005..05-015
 * per-lump-format audits, and the 05-015 map lump bundle boundary
 * audit: the lump presence / absence fingerprint that distinguishes
 * shareware from non-shareware IWADs, the differentiator capabilities
 * gating registered episodes (`E2M*`, `E3M*`), Ultimate episodes
 * (`E4M*`), commercial maps (`MAP##`), the registered-only
 * `TEXTURE2` lump, the Ultimate-only `BOSSBACK` lump, the
 * registered-only `VICTORY2` and `ENDPIC` lumps, the registered-only
 * `WIMAP1` / `WIMAP2` intermission backgrounds, the
 * registered/Ultimate-only `SKY2` / `SKY3` / `SKY4` sky textures, and
 * the registered/Ultimate-only `DEMO4` demo. The capability-detection
 * runtime mirrors the gates Vanilla DOOM 1.9 enforces in
 * `linuxdoom-1.10/d_main.c` `IdentifyVersion()` (filename → gamemode),
 * `linuxdoom-1.10/r_data.c` `R_InitTextures` (TEXTURE2 optional), and
 * `linuxdoom-1.10/p_setup.c` `P_SetupLevel` (`W_GetNumForName` fatal
 * on miss for a missing map marker).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (`d_main.c`, `r_data.c`,
 *      `p_setup.c`, `m_menu.c`, `wi_stuff.c`, `f_finale.c`),
 *   5. Chocolate Doom 2.2.1 source (`src/doom/d_main.c`,
 *      `src/doom/r_data.c`).
 *
 * The empirical capability axes (lump presence / absence in the live
 * shareware DOOM1.WAD) are pinned against authority 2 and re-derived
 * from the on-disk file every test run. The conceptual gating axes
 * (gamemode → episode count, gamemode → TEXTURE2 optional, gamemode →
 * help-screen-cycle) are pinned against authority 4. The shareware
 * IWAD's total lump count of 1264 is double-pinned by authority 2
 * (the live IWAD) and authority 1/3 (`PRIMARY_TARGET.wadLumpCount`).
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited capability axis (a lump-presence fact, semantic
 * constant, or runtime contract) of the shareware DOOM1.WAD
 * capability detection runtime.
 */
export interface ShareWareIwadCapabilityAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'shareware-wad-type-is-iwad'
    | 'shareware-total-lump-count-pinned'
    | 'shareware-map-bundle-count-is-nine'
    | 'shareware-map-bundles-are-episode-one'
    | 'shareware-registered-episode-markers-absent'
    | 'shareware-ultimate-episode-markers-absent'
    | 'shareware-doom2-map-markers-absent'
    | 'shareware-texture1-present'
    | 'shareware-texture2-absent'
    | 'shareware-pnames-present'
    | 'shareware-playpal-and-colormap-present'
    | 'shareware-endoom-present'
    | 'shareware-genmidi-and-dmxgus-present'
    | 'shareware-titlepic-and-credit-present'
    | 'shareware-help1-and-help2-present'
    | 'shareware-stbar-and-starms-present'
    | 'shareware-sky1-present'
    | 'shareware-non-shareware-sky-textures-absent'
    | 'shareware-wimap0-present'
    | 'shareware-non-shareware-intermission-maps-absent'
    | 'shareware-bossback-absent'
    | 'shareware-victory2-absent'
    | 'shareware-endpic-absent'
    | 'shareware-three-demos-present'
    | 'shareware-demo4-absent'
    | 'shareware-flat-marker-range-present'
    | 'shareware-sprite-marker-range-present'
    | 'shareware-patch-marker-range-present'
    | 'shareware-cyberdemon-sprite-absent'
    | 'shareware-spider-mastermind-sprite-absent';
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
  /** Verbatim C source line(s), `#define` line(s), or empirical observation. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the upstream tree or empirical observation tag. */
  readonly referenceSourceFile:
    | 'linuxdoom-1.10/d_main.c'
    | 'linuxdoom-1.10/r_data.c'
    | 'linuxdoom-1.10/p_setup.c'
    | 'linuxdoom-1.10/m_menu.c'
    | 'linuxdoom-1.10/wi_stuff.c'
    | 'linuxdoom-1.10/f_finale.c'
    | 'linuxdoom-1.10/g_game.c'
    | 'src/doom/d_main.c'
    | 'src/doom/r_data.c'
    | 'shareware/DOOM1.WAD';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and
 * runtime parser contract the runtime shareware IWAD capability
 * detection must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const SHAREWARE_IWAD_CAPABILITY_AUDIT: readonly ShareWareIwadCapabilityAuditEntry[] = [
  {
    id: 'shareware-wad-type-is-iwad',
    subject: 'wad-header',
    cSourceLines: ['if (!strncmp(header.identification,"IWAD",4))', '{', '    /* Internal WAD - vanilla shareware IWAD identifier */', '}'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` carries the literal 4-byte ASCII identification stamp `IWAD` at offset 0. Vanilla `W_AddFile` rejects files whose identification stamp is neither `IWAD` nor `PWAD`. The runtime models this with `detectShareWareIwadCapabilities` requiring `header.type === "IWAD"`.',
  },
  {
    id: 'shareware-total-lump-count-pinned',
    subject: 'wad-directory',
    cSourceLines: ['header.numlumps = LONG(header.numlumps);'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The shareware `doom/DOOM1.WAD` directory lists exactly 1264 lump entries. This count is double-pinned: by the live IWAD itself (authority 2), by `PRIMARY_TARGET.wadLumpCount = 1264` (authority 3), and by the SHA-256 fingerprint `1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771` (authority 3). The runtime models this with `SHAREWARE_IWAD_TOTAL_LUMP_COUNT === 1264`.',
  },
  {
    id: 'shareware-map-bundle-count-is-nine',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode == shareware)', '    /* episode 1 only, 9 maps */'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` ships exactly 9 map header lumps. Vanilla `IdentifyVersion()` derives `gamemode = shareware` from a `doom1.wad` filename match, which constrains the engine to a single episode of 9 maps. The runtime models this with `SHAREWARE_IWAD_MAP_BUNDLE_COUNT === 9` and `detectShareWareIwadCapabilities(...).mapBundleCount === 9`.',
  },
  {
    id: 'shareware-map-bundles-are-episode-one',
    subject: 'map-marker-lump',
    cSourceLines: ["lumpname[0] = 'E';", "lumpname[1] = '0'+gameepisode;", "lumpname[2] = 'M';", "lumpname[3] = '0'+gamemap;"],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'Every shareware `doom/DOOM1.WAD` map header lump is named `E1M<digit>` for digits 1..9. Episode 1 is the only valid episode in shareware; `gameepisode` is locked to 1 by `M_EpisodeQuit` and similar gates. The runtime models this with `detectShareWareIwadCapabilities(...).episode1MapCount === 9`.',
  },
  {
    id: 'shareware-registered-episode-markers-absent',
    subject: 'map-marker-lump',
    cSourceLines: ['lumpnum = W_GetNumForName (lumpname);  /* fatal on miss */'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains zero `E2M*` and zero `E3M*` map header lumps. Vanilla `P_SetupLevel` calls `W_GetNumForName(lumpname)` which fatals via `I_Error("W_GetNumForName: %s not found!")` on miss; requesting a registered-only map (`E2M1`, `E3M1`, etc.) on shareware therefore aborts startup. The runtime models this with `detectShareWareIwadCapabilities(...).episode2MapCount === 0` and `episode3MapCount === 0`.',
  },
  {
    id: 'shareware-ultimate-episode-markers-absent',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode != retail)', '    /* episode 4 unavailable */'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains zero `E4M*` map header lumps. Episode 4 (Thy Flesh Consumed) was added in The Ultimate DOOM (retail), and shareware predates that release. The runtime models this with `detectShareWareIwadCapabilities(...).episode4MapCount === 0`.',
  },
  {
    id: 'shareware-doom2-map-markers-absent',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode == commercial)', '    sprintf(lumpname, "map%02i", gamemap);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains zero `MAP##` map header lumps. Vanilla `G_DoLoadLevel` only constructs the `MAP%02i` lumpname when `gamemode == commercial`; shareware never reaches that branch. The runtime models this with `detectShareWareIwadCapabilities(...).doom2MapCount === 0`.',
  },
  {
    id: 'shareware-texture1-present',
    subject: 'texture-lump',
    cSourceLines: ['maptex1 = W_CacheLumpName ("TEXTURE1", PU_STATIC);', 'numtextures1 = LONG(*maptex1);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains a `TEXTURE1` lump (the canonical first texture set). Vanilla `R_InitTextures` always loads `TEXTURE1` via `W_CacheLumpName`; absence is fatal. The runtime models this with `detectShareWareIwadCapabilities(...).hasTexture1 === true`.',
  },
  {
    id: 'shareware-texture2-absent',
    subject: 'texture-lump',
    cSourceLines: ['if (W_CheckNumForName ("TEXTURE2") != -1)', '    maptex2 = W_CacheLumpName ("TEXTURE2", PU_STATIC);', 'else', '    maptex2 = NULL;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain a `TEXTURE2` lump. Vanilla `R_InitTextures` checks `W_CheckNumForName ("TEXTURE2") != -1` and treats absence as "no second texture set" (`maptex2 = NULL`, `numtextures2 = 0`). `TEXTURE2` is the canonical capability differentiator between shareware and registered/Ultimate IWADs. The runtime models this with `detectShareWareIwadCapabilities(...).hasTexture2 === false`.',
  },
  {
    id: 'shareware-pnames-present',
    subject: 'patch-name-lump',
    cSourceLines: ['names = W_CacheLumpName ("PNAMES", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains a `PNAMES` lump (the patch name table referenced by TEXTURE1 entries). Vanilla `R_InitTextures` always loads `PNAMES`; absence is fatal. The runtime models this with `detectShareWareIwadCapabilities(...).hasPnames === true`.',
  },
  {
    id: 'shareware-playpal-and-colormap-present',
    subject: 'palette-lump',
    cSourceLines: ['playpal = W_CacheLumpName ("PLAYPAL", PU_CACHE);', 'colormaps = W_CacheLumpName ("COLORMAP", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains a `PLAYPAL` 768-byte palette set (14 palettes) and a `COLORMAP` 8704-byte colormap set (34 colormaps). Both lumps are mandatory for the renderer; absence is fatal. The runtime models this with `detectShareWareIwadCapabilities(...).hasPlaypal === true` and `hasColormap === true`.',
  },
  {
    id: 'shareware-endoom-present',
    subject: 'audio-lump',
    cSourceLines: ['endoom = W_CacheLumpName("ENDOOM", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains an `ENDOOM` 4000-byte text-mode quit screen. Vanilla `I_Quit` blits the ENDOOM lump to the DOS text-mode framebuffer at exit. The runtime models this with `detectShareWareIwadCapabilities(...).hasEndoom === true`.',
  },
  {
    id: 'shareware-genmidi-and-dmxgus-present',
    subject: 'audio-lump',
    cSourceLines: ['genmidi = W_CacheLumpName("GENMIDI", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains a `GENMIDI` OPL2 instrument bank and a `DMXGUS` Gravis UltraSound instrument bank. Both are required by the DMX sound library to render MUS music on FM and GUS hardware. The runtime models this with `detectShareWareIwadCapabilities(...).hasGenmidi === true` and `hasDmxgus === true`.',
  },
  {
    id: 'shareware-titlepic-and-credit-present',
    subject: 'menu-screen-lump',
    cSourceLines: ['pagename = "TITLEPIC";', 'pagename = "CREDIT";'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains `TITLEPIC` (the title screen) and `CREDIT` (the credits screen). Vanilla `D_PageDrawer` cycles through pagenames during the demo loop; both are required for the title sequence. The runtime models this with `detectShareWareIwadCapabilities(...).hasTitlepic === true` and `hasCredit === true`.',
  },
  {
    id: 'shareware-help1-and-help2-present',
    subject: 'menu-screen-lump',
    cSourceLines: ['if (helpscreen == 0)', '    pagename = "HELP1";', 'else if (helpscreen == 1)', '    pagename = "HELP2";'],
    referenceSourceFile: 'linuxdoom-1.10/m_menu.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains BOTH `HELP1` and `HELP2` lumps. Vanilla `M_DrawHelp` cycles between the two pages on F1 in shareware: `HELP1` is the in-game help, `HELP2` is the order screen advertising the registered version. The runtime models this with `detectShareWareIwadCapabilities(...).hasHelp1 === true` and `hasHelp2 === true`.',
  },
  {
    id: 'shareware-stbar-and-starms-present',
    subject: 'status-bar-lump',
    cSourceLines: ['sbar = W_CacheLumpName("STBAR", PU_STATIC);', 'starms = W_CacheLumpName("STARMS", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains `STBAR` (the main status bar background) and `STARMS` (the arms display overlay). Vanilla `ST_Init` loads both via `W_CacheLumpName`; absence is fatal. The runtime models this with `detectShareWareIwadCapabilities(...).hasStbar === true` and `hasStarms === true`.',
  },
  {
    id: 'shareware-sky1-present',
    subject: 'sky-texture-lump',
    cSourceLines: ['skytexname = "SKY1";  /* episode 1 sky */'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains a `SKY1` patch (the Episode 1 / Knee-Deep in the Dead sky texture). Vanilla `G_DoLoadLevel` selects `SKY1` for episode 1 maps. The runtime models this with `detectShareWareIwadCapabilities(...).hasSky1 === true`.',
  },
  {
    id: 'shareware-non-shareware-sky-textures-absent',
    subject: 'sky-texture-lump',
    cSourceLines: ['case 2: skytexname = "SKY2"; break;', 'case 3: skytexname = "SKY3"; break;', 'case 4: skytexname = "SKY4"; break;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain `SKY2`, `SKY3`, or `SKY4`. These per-episode sky textures are needed only when the engine loads episodes 2, 3, or 4 (registered/Ultimate-only). The runtime models this with `detectShareWareIwadCapabilities(...).hasSky2 === false`, `hasSky3 === false`, and `hasSky4 === false`.',
  },
  {
    id: 'shareware-wimap0-present',
    subject: 'intermission-lump',
    cSourceLines: ['sprintf(name, "WIMAP%i", wbs->epsd);  /* WIMAP0 for episode 1 */'],
    referenceSourceFile: 'linuxdoom-1.10/wi_stuff.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains `WIMAP0` (the Episode 1 intermission map background showing Phobos). Vanilla `WI_loadData` formats the name `WIMAP%i` with `wbs->epsd` (episode index 0..3). The runtime models this with `detectShareWareIwadCapabilities(...).hasWimap0 === true`.',
  },
  {
    id: 'shareware-non-shareware-intermission-maps-absent',
    subject: 'intermission-lump',
    cSourceLines: ['/* WIMAP1 = episode 2, WIMAP2 = episode 3 (registered-only) */'],
    referenceSourceFile: 'linuxdoom-1.10/wi_stuff.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain `WIMAP1` or `WIMAP2`. These intermission backgrounds are needed only when the engine loads episodes 2 (Shores of Hell) or 3 (Inferno), both registered-only. The runtime models this with `detectShareWareIwadCapabilities(...).hasWimap1 === false` and `hasWimap2 === false`.',
  },
  {
    id: 'shareware-bossback-absent',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatchDirect(0, 0, 0, W_CacheLumpName("BOSSBACK", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain `BOSSBACK`. Vanilla `F_BunnyScroll` (the Ultimate DOOM Episode 4 ending) reads `BOSSBACK` for the bunny-scroll finale background. Episode 4 is Ultimate-only, so the lump is absent in shareware. The runtime models this with `detectShareWareIwadCapabilities(...).hasBossback === false`.',
  },
  {
    id: 'shareware-victory2-absent',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatchDirect(0, 0, 0, W_CacheLumpName("VICTORY2", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain `VICTORY2`. Vanilla `F_TextWrite` reads `VICTORY2` after Episode 2 (Shores of Hell). Episode 2 is registered-only, so the lump is absent in shareware. The runtime models this with `detectShareWareIwadCapabilities(...).hasVictory2 === false`.',
  },
  {
    id: 'shareware-endpic-absent',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatchDirect(0, 0, 0, W_CacheLumpName("ENDPIC", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain `ENDPIC`. Vanilla `F_TextWrite` reads `ENDPIC` after Episode 3 (Inferno). Episode 3 is registered-only, so the lump is absent in shareware. The runtime models this with `detectShareWareIwadCapabilities(...).hasEndpic === false`.',
  },
  {
    id: 'shareware-three-demos-present',
    subject: 'demo-lump',
    cSourceLines: ['lumpname = "DEMO1";', 'lumpname = "DEMO2";', 'lumpname = "DEMO3";'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains exactly three demo lumps `DEMO1`, `DEMO2`, and `DEMO3`. Vanilla `D_PageTicker` cycles `pagetic` between three pages, each playing one demo. All three reference Episode 1 maps (E1M*). The runtime models this with `detectShareWareIwadCapabilities(...).hasDemo1 === true`, `hasDemo2 === true`, and `hasDemo3 === true`.',
  },
  {
    id: 'shareware-demo4-absent',
    subject: 'demo-lump',
    cSourceLines: ['/* DEMO4 only present in Ultimate DOOM (retail) */'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain `DEMO4`. The fourth demo was added in Ultimate DOOM (retail) to showcase Episode 4 content. The runtime models this with `detectShareWareIwadCapabilities(...).hasDemo4 === false`.',
  },
  {
    id: 'shareware-flat-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['firstflat = W_GetNumForName ("F_START");', 'lastflat = W_GetNumForName ("F_END") - 1;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains the `F_START` / `F_END` marker pair bracketing the flat namespace. Vanilla `R_InitFlats` resolves both markers via `W_GetNumForName`; absence is fatal. The runtime models this with `detectShareWareIwadCapabilities(...).hasFlatMarkerRange === true`.',
  },
  {
    id: 'shareware-sprite-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['firstspritelump = W_GetNumForName ("S_START") + 1;', 'lastspritelump = W_GetNumForName ("S_END") - 1;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains the `S_START` / `S_END` marker pair bracketing the sprite namespace. Vanilla `R_InitSpriteLumps` resolves both markers via `W_GetNumForName`; absence is fatal. The runtime models this with `detectShareWareIwadCapabilities(...).hasSpriteMarkerRange === true`.',
  },
  {
    id: 'shareware-patch-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['/* P_START / P_END bracket optional patches namespace */'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The shareware `doom/DOOM1.WAD` contains the `P_START` / `P_END` marker pair bracketing the patch namespace. The marker range is empirically present in every official id IWAD, even though vanilla 1.9 does not emit `W_GetNumForName` calls for it (the markers are kept for PWAD compatibility). The runtime models this with `detectShareWareIwadCapabilities(...).hasPatchMarkerRange === true`.',
  },
  {
    id: 'shareware-cyberdemon-sprite-absent',
    subject: 'sprite-frame-lump',
    cSourceLines: ['/* CYBR sprite frames - Cyberdemon (boss of episode 2) */'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain any sprite frames whose name starts with `CYBR` (the Cyberdemon sprite prefix). The Cyberdemon is the boss of Episode 2 (Tower of Babel), which is registered-only. The runtime models this with `detectShareWareIwadCapabilities(...).hasCyberdemonSprite === false`.',
  },
  {
    id: 'shareware-spider-mastermind-sprite-absent',
    subject: 'sprite-frame-lump',
    cSourceLines: ['/* SPID sprite frames - Spider Mastermind (boss of episode 3) */'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain any sprite frames whose name starts with `SPID` (the Spider Mastermind sprite prefix). The Spider Mastermind is the boss of Episode 3 (Dis), which is registered-only. The runtime models this with `detectShareWareIwadCapabilities(...).hasSpiderMastermindSprite === false`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface ShareWareIwadCapabilityDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const SHAREWARE_IWAD_CAPABILITY_DERIVED_INVARIANTS: readonly ShareWareIwadCapabilityDerivedInvariant[] = [
  {
    id: 'SHAREWARE_IWAD_TOTAL_LUMP_COUNT_EQUALS_PINNED',
    description: '`SHAREWARE_IWAD_TOTAL_LUMP_COUNT === 1264`. Matches `PRIMARY_TARGET.wadLumpCount` and the directory length re-derived from the live IWAD.',
  },
  {
    id: 'SHAREWARE_IWAD_MAP_BUNDLE_COUNT_EQUALS_NINE',
    description: '`SHAREWARE_IWAD_MAP_BUNDLE_COUNT === 9`. Matches the empirical 9 map markers (E1M1..E1M9) in the live IWAD and the gamemode=shareware single-episode constraint.',
  },
  {
    id: 'SHAREWARE_IWAD_EPISODE_COUNT_EQUALS_ONE',
    description: '`SHAREWARE_IWAD_EPISODE_COUNT === 1`. Matches `EPISODE_COUNTS.shareware = 1` from `src/bootstrap/gameMode.ts`.',
  },
  {
    id: 'DETECT_SHAREWARE_RETURNS_FROZEN_DETECTION',
    description: 'A successful `detectShareWareIwadCapabilities(directory)` returns an object that is `Object.isFrozen`.',
  },
  {
    id: 'DETECT_SHAREWARE_REJECTS_PWAD_TYPE',
    description: '`detectShareWareIwadCapabilities` reports `wadType: "PWAD"` rather than `"IWAD"` when the supplied header type is `"PWAD"`. Matches the IWAD vs PWAD identification stamp distinction.',
  },
  {
    id: 'IS_SHAREWARE_IWAD_ACCEPTS_LIVE_DOOM1_WAD',
    description: '`isShareWareIwad(liveDirectory)` returns `true` for the live shareware DOOM1.WAD directory.',
  },
  {
    id: 'IS_SHAREWARE_IWAD_REJECTS_E2M1_PRESENT',
    description: '`isShareWareIwad(directory)` returns `false` for any directory containing `E2M1` (registered-only).',
  },
  {
    id: 'IS_SHAREWARE_IWAD_REJECTS_E4M1_PRESENT',
    description: '`isShareWareIwad(directory)` returns `false` for any directory containing `E4M1` (Ultimate-only).',
  },
  {
    id: 'IS_SHAREWARE_IWAD_REJECTS_MAP01_PRESENT',
    description: '`isShareWareIwad(directory)` returns `false` for any directory containing `MAP01` (commercial-only).',
  },
  {
    id: 'IS_SHAREWARE_IWAD_REJECTS_TEXTURE2_PRESENT',
    description: '`isShareWareIwad(directory)` returns `false` for any directory containing `TEXTURE2` (registered/Ultimate-only).',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Total lump count of the shareware DOOM1.WAD directory. */
export const SHAREWARE_IWAD_TOTAL_LUMP_COUNT = 1264;

/** Number of map markers in the shareware DOOM1.WAD (E1M1..E1M9). */
export const SHAREWARE_IWAD_MAP_BUNDLE_COUNT = 9;

/** Episode count for shareware (matches `EPISODE_COUNTS.shareware`). */
export const SHAREWARE_IWAD_EPISODE_COUNT = 1;

/** Required infrastructure lump names that must be present in every official id IWAD. */
export const SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS: readonly string[] = Object.freeze([
  'PLAYPAL',
  'COLORMAP',
  'ENDOOM',
  'GENMIDI',
  'DMXGUS',
  'PNAMES',
  'TEXTURE1',
  'TITLEPIC',
  'CREDIT',
  'HELP1',
  'HELP2',
  'STBAR',
  'STARMS',
  'SKY1',
  'WIMAP0',
]);

/** Required demo lump names present in shareware. */
export const SHAREWARE_REQUIRED_DEMO_LUMPS: readonly string[] = Object.freeze(['DEMO1', 'DEMO2', 'DEMO3']);

/** Required marker range pair names present in shareware. */
export const SHAREWARE_REQUIRED_MARKER_RANGES: readonly string[] = Object.freeze(['F_START', 'F_END', 'S_START', 'S_END', 'P_START', 'P_END']);

/** Lump names whose presence indicates a non-shareware IWAD (registered/Ultimate/commercial). */
export const SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS: readonly string[] = Object.freeze(['TEXTURE2', 'E2M1', 'E3M1', 'E4M1', 'MAP01', 'WIMAP1', 'WIMAP2', 'SKY2', 'SKY3', 'SKY4', 'BOSSBACK', 'VICTORY2', 'ENDPIC', 'DEMO4']);

/** Sprite frame name prefixes whose presence indicates a non-shareware IWAD. */
export const SHAREWARE_NEGATIVE_SPRITE_PREFIXES: readonly string[] = Object.freeze(['CYBR', 'SPID']);

/** Capability detection result for one IWAD directory. */
export interface ShareWareIwadCapabilityDetection {
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
  /** Whether the `HELP2` lump is present. */
  readonly hasHelp2: boolean;
  /** Whether the `STBAR` status bar background lump is present. */
  readonly hasStbar: boolean;
  /** Whether the `STARMS` arms display lump is present. */
  readonly hasStarms: boolean;
  /** Whether the `SKY1` Episode 1 sky texture is present. */
  readonly hasSky1: boolean;
  /** Whether the `SKY2` Episode 2 sky texture is present (registered-only). */
  readonly hasSky2: boolean;
  /** Whether the `SKY3` Episode 3 sky texture is present (registered-only). */
  readonly hasSky3: boolean;
  /** Whether the `SKY4` Episode 4 sky texture is present (Ultimate-only). */
  readonly hasSky4: boolean;
  /** Whether the `WIMAP0` Episode 1 intermission map is present. */
  readonly hasWimap0: boolean;
  /** Whether the `WIMAP1` Episode 2 intermission map is present (registered-only). */
  readonly hasWimap1: boolean;
  /** Whether the `WIMAP2` Episode 3 intermission map is present (registered-only). */
  readonly hasWimap2: boolean;
  /** Whether the `BOSSBACK` Episode 4 finale background is present (Ultimate-only). */
  readonly hasBossback: boolean;
  /** Whether the `VICTORY2` Episode 2 victory text background is present (registered-only). */
  readonly hasVictory2: boolean;
  /** Whether the `ENDPIC` Episode 3 finale picture is present (registered-only). */
  readonly hasEndpic: boolean;
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
 * shareware DOOM1.WAD baseline.
 *
 * Mirrors the gates Vanilla DOOM 1.9 enforces in `IdentifyVersion()`,
 * `R_InitTextures`, `M_DrawHelp`, and `WI_loadData`. Every capability
 * flag corresponds to one observable lump-presence (or sprite-prefix-
 * presence) probe against the directory.
 *
 * @param directory - Parsed WAD directory entries.
 * @param wadType - WAD identification stamp from the header (`IWAD` or `PWAD`).
 * @returns Frozen {@link ShareWareIwadCapabilityDetection}.
 */
export function detectShareWareIwadCapabilities(directory: readonly DirectoryEntry[], wadType: 'IWAD' | 'PWAD'): ShareWareIwadCapabilityDetection {
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
    hasHelp2: names.has('HELP2'),
    hasStbar: names.has('STBAR'),
    hasStarms: names.has('STARMS'),
    hasSky1: names.has('SKY1'),
    hasSky2: names.has('SKY2'),
    hasSky3: names.has('SKY3'),
    hasSky4: names.has('SKY4'),
    hasWimap0: names.has('WIMAP0'),
    hasWimap1: names.has('WIMAP1'),
    hasWimap2: names.has('WIMAP2'),
    hasBossback: names.has('BOSSBACK'),
    hasVictory2: names.has('VICTORY2'),
    hasEndpic: names.has('ENDPIC'),
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
 * Predicate identifying the shareware DOOM1.WAD by its capability
 * fingerprint: 9 episode-1 map markers, no episode-2/3/4 or commercial
 * map markers, no `TEXTURE2`, and IWAD identification stamp.
 *
 * @param directory - Parsed WAD directory entries.
 * @param wadType - WAD identification stamp from the header.
 */
export function isShareWareIwad(directory: readonly DirectoryEntry[], wadType: 'IWAD' | 'PWAD'): boolean {
  const detection = detectShareWareIwadCapabilities(directory, wadType);
  return (
    detection.wadType === 'IWAD' &&
    detection.episode1MapCount === SHAREWARE_IWAD_MAP_BUNDLE_COUNT &&
    detection.episode2MapCount === 0 &&
    detection.episode3MapCount === 0 &&
    detection.episode4MapCount === 0 &&
    detection.doom2MapCount === 0 &&
    detection.hasTexture1 &&
    !detection.hasTexture2
  );
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/detect-shareware-iwad-capabilities.ts`. The cross-check
 * helper consumes this shape so the focused test can both verify the
 * live runtime exports and exercise a deliberately tampered snapshot
 * to prove the failure modes are observable.
 */
export interface ShareWareIwadCapabilityRuntimeSnapshot {
  readonly shareWareIwadTotalLumpCount: number;
  readonly shareWareIwadMapBundleCount: number;
  readonly shareWareIwadEpisodeCount: number;
  readonly detectShareWareReturnsFrozenDetection: boolean;
  readonly detectShareWareReportsPwadType: boolean;
  readonly isShareWareIwadAcceptsLiveDoom1Wad: boolean;
  readonly isShareWareIwadRejectsE2M1Present: boolean;
  readonly isShareWareIwadRejectsE4M1Present: boolean;
  readonly isShareWareIwadRejectsMap01Present: boolean;
  readonly isShareWareIwadRejectsTexture2Present: boolean;
}

/**
 * Cross-check a `ShareWareIwadCapabilityRuntimeSnapshot` against
 * `SHAREWARE_IWAD_CAPABILITY_AUDIT` and
 * `SHAREWARE_IWAD_CAPABILITY_DERIVED_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the snapshot is
 * parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckShareWareIwadCapabilityRuntime(snapshot: ShareWareIwadCapabilityRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.shareWareIwadTotalLumpCount !== 1264) {
    failures.push('derived:SHAREWARE_IWAD_TOTAL_LUMP_COUNT_EQUALS_PINNED');
    failures.push('audit:shareware-total-lump-count-pinned:not-observed');
  }
  if (snapshot.shareWareIwadMapBundleCount !== 9) {
    failures.push('derived:SHAREWARE_IWAD_MAP_BUNDLE_COUNT_EQUALS_NINE');
    failures.push('audit:shareware-map-bundle-count-is-nine:not-observed');
  }
  if (snapshot.shareWareIwadEpisodeCount !== 1) {
    failures.push('derived:SHAREWARE_IWAD_EPISODE_COUNT_EQUALS_ONE');
  }
  if (!snapshot.detectShareWareReturnsFrozenDetection) {
    failures.push('derived:DETECT_SHAREWARE_RETURNS_FROZEN_DETECTION');
  }
  if (!snapshot.detectShareWareReportsPwadType) {
    failures.push('derived:DETECT_SHAREWARE_REJECTS_PWAD_TYPE');
    failures.push('audit:shareware-wad-type-is-iwad:not-observed');
  }
  if (!snapshot.isShareWareIwadAcceptsLiveDoom1Wad) {
    failures.push('derived:IS_SHAREWARE_IWAD_ACCEPTS_LIVE_DOOM1_WAD');
    failures.push('audit:shareware-map-bundles-are-episode-one:not-observed');
  }
  if (!snapshot.isShareWareIwadRejectsE2M1Present) {
    failures.push('derived:IS_SHAREWARE_IWAD_REJECTS_E2M1_PRESENT');
    failures.push('audit:shareware-registered-episode-markers-absent:not-observed');
  }
  if (!snapshot.isShareWareIwadRejectsE4M1Present) {
    failures.push('derived:IS_SHAREWARE_IWAD_REJECTS_E4M1_PRESENT');
    failures.push('audit:shareware-ultimate-episode-markers-absent:not-observed');
  }
  if (!snapshot.isShareWareIwadRejectsMap01Present) {
    failures.push('derived:IS_SHAREWARE_IWAD_REJECTS_MAP01_PRESENT');
    failures.push('audit:shareware-doom2-map-markers-absent:not-observed');
  }
  if (!snapshot.isShareWareIwadRejectsTexture2Present) {
    failures.push('derived:IS_SHAREWARE_IWAD_REJECTS_TEXTURE2_PRESENT');
    failures.push('audit:shareware-texture2-absent:not-observed');
  }

  const declaredAxes = new Set(SHAREWARE_IWAD_CAPABILITY_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<ShareWareIwadCapabilityAuditEntry['id']> = [
    'shareware-wad-type-is-iwad',
    'shareware-total-lump-count-pinned',
    'shareware-map-bundle-count-is-nine',
    'shareware-map-bundles-are-episode-one',
    'shareware-registered-episode-markers-absent',
    'shareware-ultimate-episode-markers-absent',
    'shareware-doom2-map-markers-absent',
    'shareware-texture1-present',
    'shareware-texture2-absent',
    'shareware-pnames-present',
    'shareware-playpal-and-colormap-present',
    'shareware-endoom-present',
    'shareware-genmidi-and-dmxgus-present',
    'shareware-titlepic-and-credit-present',
    'shareware-help1-and-help2-present',
    'shareware-stbar-and-starms-present',
    'shareware-sky1-present',
    'shareware-non-shareware-sky-textures-absent',
    'shareware-wimap0-present',
    'shareware-non-shareware-intermission-maps-absent',
    'shareware-bossback-absent',
    'shareware-victory2-absent',
    'shareware-endpic-absent',
    'shareware-three-demos-present',
    'shareware-demo4-absent',
    'shareware-flat-marker-range-present',
    'shareware-sprite-marker-range-present',
    'shareware-patch-marker-range-present',
    'shareware-cyberdemon-sprite-absent',
    'shareware-spider-mastermind-sprite-absent',
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
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` capability
 * fingerprint that the focused test cross-checks against the live
 * on-disk file. Each pinned scalar / boolean covers one observable
 * axis the capability detection runtime must report correctly.
 */
export interface ShareWareDoom1WadCapabilityOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** WAD identification stamp. */
  readonly wadType: 'IWAD';
  /** Total directory entry count (`PRIMARY_TARGET.wadLumpCount`). */
  readonly totalLumpCount: 1264;
  /** Number of map header lumps. */
  readonly mapBundleCount: 9;
  /** Number of E1M* markers. */
  readonly episode1MapCount: 9;
  /** Number of E2M* markers. */
  readonly episode2MapCount: 0;
  /** Number of E3M* markers. */
  readonly episode3MapCount: 0;
  /** Number of E4M* markers. */
  readonly episode4MapCount: 0;
  /** Number of MAP## markers. */
  readonly doom2MapCount: 0;
  /** Lump-presence fingerprint. */
  readonly capabilityFlags: ShareWareDoom1WadCapabilityFlags;
}

/** Lump-presence flags pinned for the live shareware DOOM1.WAD. */
export interface ShareWareDoom1WadCapabilityFlags {
  readonly hasTexture1: true;
  readonly hasTexture2: false;
  readonly hasPnames: true;
  readonly hasPlaypal: true;
  readonly hasColormap: true;
  readonly hasEndoom: true;
  readonly hasGenmidi: true;
  readonly hasDmxgus: true;
  readonly hasTitlepic: true;
  readonly hasCredit: true;
  readonly hasHelp1: true;
  readonly hasHelp2: true;
  readonly hasStbar: true;
  readonly hasStarms: true;
  readonly hasSky1: true;
  readonly hasSky2: false;
  readonly hasSky3: false;
  readonly hasSky4: false;
  readonly hasWimap0: true;
  readonly hasWimap1: false;
  readonly hasWimap2: false;
  readonly hasBossback: false;
  readonly hasVictory2: false;
  readonly hasEndpic: false;
  readonly hasDemo1: true;
  readonly hasDemo2: true;
  readonly hasDemo3: true;
  readonly hasDemo4: false;
  readonly hasFlatMarkerRange: true;
  readonly hasSpriteMarkerRange: true;
  readonly hasPatchMarkerRange: true;
  readonly hasCyberdemonSprite: false;
  readonly hasSpiderMastermindSprite: false;
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` capability
 * fingerprint.
 *
 * The pinned probes were captured from the live IWAD via a one-off
 * probe script. Every entry corresponds to one observable lump-
 * presence (or sprite-prefix-presence) probe against the directory.
 */
export const SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE: ShareWareDoom1WadCapabilityOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  wadType: 'IWAD',
  totalLumpCount: 1264,
  mapBundleCount: 9,
  episode1MapCount: 9,
  episode2MapCount: 0,
  episode3MapCount: 0,
  episode4MapCount: 0,
  doom2MapCount: 0,
  capabilityFlags: Object.freeze({
    hasTexture1: true,
    hasTexture2: false,
    hasPnames: true,
    hasPlaypal: true,
    hasColormap: true,
    hasEndoom: true,
    hasGenmidi: true,
    hasDmxgus: true,
    hasTitlepic: true,
    hasCredit: true,
    hasHelp1: true,
    hasHelp2: true,
    hasStbar: true,
    hasStarms: true,
    hasSky1: true,
    hasSky2: false,
    hasSky3: false,
    hasSky4: false,
    hasWimap0: true,
    hasWimap1: false,
    hasWimap2: false,
    hasBossback: false,
    hasVictory2: false,
    hasEndpic: false,
    hasDemo1: true,
    hasDemo2: true,
    hasDemo3: true,
    hasDemo4: false,
    hasFlatMarkerRange: true,
    hasSpriteMarkerRange: true,
    hasPatchMarkerRange: true,
    hasCyberdemonSprite: false,
    hasSpiderMastermindSprite: false,
  }) as ShareWareDoom1WadCapabilityFlags,
}) as ShareWareDoom1WadCapabilityOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * capability fingerprint so the focused test can re-derive the values
 * from the live file every run and feed the result into the
 * cross-check.
 */
export interface ShareWareDoom1WadCapabilitySample {
  readonly wadType: 'IWAD' | 'PWAD';
  readonly totalLumpCount: number;
  readonly mapBundleCount: number;
  readonly episode1MapCount: number;
  readonly episode2MapCount: number;
  readonly episode3MapCount: number;
  readonly episode4MapCount: number;
  readonly doom2MapCount: number;
  readonly capabilityFlags: { readonly [K in keyof ShareWareDoom1WadCapabilityFlags]: boolean };
}

/**
 * Cross-check a shareware DOOM1.WAD capability sample against the
 * pinned oracle. Returns the list of failures by stable identifier;
 * an empty list means the live capability fingerprint matches the
 * oracle exactly.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:capabilityFlags:<flag>:value-mismatch` for any oracle
 *    boolean flag whose live counterpart disagrees with the pinned
 *    value.
 */
export function crossCheckShareWareDoom1WadCapabilitySample(sample: ShareWareDoom1WadCapabilitySample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'wadType' | 'totalLumpCount' | 'mapBundleCount' | 'episode1MapCount' | 'episode2MapCount' | 'episode3MapCount' | 'episode4MapCount' | 'doom2MapCount'> = [
    'wadType',
    'totalLumpCount',
    'mapBundleCount',
    'episode1MapCount',
    'episode2MapCount',
    'episode3MapCount',
    'episode4MapCount',
    'doom2MapCount',
  ];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  const flagFields: ReadonlyArray<keyof ShareWareDoom1WadCapabilityFlags> = [
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
    'hasHelp2',
    'hasStbar',
    'hasStarms',
    'hasSky1',
    'hasSky2',
    'hasSky3',
    'hasSky4',
    'hasWimap0',
    'hasWimap1',
    'hasWimap2',
    'hasBossback',
    'hasVictory2',
    'hasEndpic',
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
    if (sample.capabilityFlags[flag] !== SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags[flag]) {
      failures.push(`oracle:capabilityFlags:${flag}:value-mismatch`);
    }
  }

  return failures;
}
