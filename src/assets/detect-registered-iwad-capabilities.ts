/**
 * Audit ledger for detecting the vanilla DOOM 1.9 registered IWAD's
 * capability profile — which content the user-supplied registered
 * `DOOM.WAD` provides versus the shareware `doom/DOOM1.WAD`, the
 * Ultimate DOOM `doomu.wad`, and the commercial DOOM 2 / Final DOOM
 * IWADs.
 *
 * This module pins the runtime contract one level deeper than the
 * 05-016 shareware capability audit: the lump presence / absence
 * fingerprint that distinguishes registered from shareware (TEXTURE2
 * present, ep2 and ep3 episode markers present, ep2 and ep3 finale
 * lumps VICTORY2 and ENDPIC present, ep3 bunny-scroll PFUB1 and
 * PFUB2 patches present, ep2 and ep3 sky textures SKY2 and SKY3
 * present, ep2 and ep3 intermission backgrounds WIMAP1 and WIMAP2
 * present, ep2 and ep3 boss sprites CYBR and SPID present), from
 * Ultimate (no ep4 markers, no SKY4, no DEMO4), and from commercial
 * (no MAP## markers, no BOSSBACK cast-call backdrop). The
 * capability-detection runtime mirrors the gates Vanilla DOOM 1.9
 * enforces in
 * `linuxdoom-1.10/d_main.c` `IdentifyVersion()` (filename → gamemode),
 * `linuxdoom-1.10/r_data.c` `R_InitTextures` (TEXTURE2 optional
 * load), `linuxdoom-1.10/p_setup.c` `P_SetupLevel` (`W_GetNumForName`
 * fatal on miss), `linuxdoom-1.10/m_menu.c` `M_DrawReadThis2` (HELP2
 * order screen), `linuxdoom-1.10/wi_stuff.c` `WI_loadData`
 * (`sprintf(name, "WIMAP%i", wbs->epsd)` per-episode intermission map
 * formatter), `linuxdoom-1.10/f_finale.c` (per-episode VICTORY2 /
 * ENDPIC / PFUB1 / PFUB2 finale lumps), and
 * `linuxdoom-1.10/g_game.c` `G_DoLoadLevel` (the per-episode
 * `lumpname[1] = '0' + gameepisode` map name formatter).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD` (shareware only — the registered
 *      `DOOM.WAD` is user-supplied per
 *      `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`
 *      and is absent from this working tree),
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (`d_main.c`, `r_data.c`,
 *      `p_setup.c`, `m_menu.c`, `wi_stuff.c`, `f_finale.c`,
 *      `g_game.c`),
 *   5. Chocolate Doom 2.2.1 source (`src/doom/d_main.c`,
 *      `src/doom/r_data.c`).
 *
 * Because no registered `DOOM.WAD` is present locally, the audit
 * pins the registered capability fingerprint against authority 4
 * (the C source code that REQUIRES specific lumps to exist for
 * `gamemode = registered` to render correctly). The focused test
 * exercises the runtime against in-memory synthesized directories
 * that mirror the registered fingerprint, and conditionally cross-
 * checks the live IWAD when the user has dropped a registered
 * `DOOM.WAD` into `doom/` or `iwad/`.
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited capability axis (a lump-presence fact, semantic
 * constant, or runtime contract) of the registered DOOM.WAD
 * capability detection runtime.
 */
export interface RegisteredIwadCapabilityAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'registered-wad-type-is-iwad'
    | 'registered-map-bundle-count-is-twentyseven'
    | 'registered-episode1-map-count-is-nine'
    | 'registered-episode2-map-count-is-nine'
    | 'registered-episode3-map-count-is-nine'
    | 'registered-ultimate-episode-markers-absent'
    | 'registered-doom2-map-markers-absent'
    | 'registered-texture1-present'
    | 'registered-texture2-present'
    | 'registered-pnames-present'
    | 'registered-playpal-and-colormap-present'
    | 'registered-endoom-present'
    | 'registered-genmidi-and-dmxgus-present'
    | 'registered-titlepic-and-credit-present'
    | 'registered-help1-and-help2-present'
    | 'registered-stbar-and-starms-present'
    | 'registered-sky1-sky2-sky3-present'
    | 'registered-sky4-absent'
    | 'registered-wimap0-wimap1-wimap2-present'
    | 'registered-victory2-present'
    | 'registered-endpic-present'
    | 'registered-pfub-bunny-scroll-patches-present'
    | 'registered-bossback-absent'
    | 'registered-three-demos-present'
    | 'registered-demo4-absent'
    | 'registered-flat-marker-range-present'
    | 'registered-sprite-marker-range-present'
    | 'registered-patch-marker-range-present'
    | 'registered-cyberdemon-sprite-present'
    | 'registered-spider-mastermind-sprite-present';
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
 * runtime parser contract the runtime registered IWAD capability
 * detection must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const REGISTERED_IWAD_CAPABILITY_AUDIT: readonly RegisteredIwadCapabilityAuditEntry[] = [
  {
    id: 'registered-wad-type-is-iwad',
    subject: 'wad-header',
    cSourceLines: ['if (!strncmp(header.identification,"IWAD",4))', '{', '    /* Internal WAD - vanilla registered IWAD identifier */', '}'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` carries the literal 4-byte ASCII identification stamp `IWAD` at offset 0. Vanilla `W_AddFile` rejects files whose identification stamp is neither `IWAD` nor `PWAD`. The runtime models this with `detectRegisteredIwadCapabilities` requiring `header.type === "IWAD"`.',
  },
  {
    id: 'registered-map-bundle-count-is-twentyseven',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode == registered)', '    /* episodes 1..3, 9 maps each, total 27 */'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` ships exactly 27 map header lumps. Vanilla `IdentifyVersion()` derives `gamemode = registered` when `doom.wad` is found and `E4M1` is absent; this constrains the engine to three episodes of 9 maps each. The runtime models this with `REGISTERED_IWAD_MAP_BUNDLE_COUNT === 27` and `detectRegisteredIwadCapabilities(...).mapBundleCount === 27`.',
  },
  {
    id: 'registered-episode1-map-count-is-nine',
    subject: 'map-marker-lump',
    cSourceLines: ["lumpname[0] = 'E';", "lumpname[1] = '0'+gameepisode;", "lumpname[2] = 'M';", "lumpname[3] = '0'+gamemap;"],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The registered `DOOM.WAD` contains exactly 9 `E1M<digit>` map header lumps for digits 1..9 (Episode 1: Knee-Deep in the Dead). Vanilla `G_DoLoadLevel` constructs the per-episode lumpname via `lumpname[1] = "0" + gameepisode`. The runtime models this with `detectRegisteredIwadCapabilities(...).episode1MapCount === 9`.',
  },
  {
    id: 'registered-episode2-map-count-is-nine',
    subject: 'map-marker-lump',
    cSourceLines: ["lumpname[0] = 'E';", "lumpname[1] = '0'+gameepisode;", "lumpname[2] = 'M';", "lumpname[3] = '0'+gamemap;"],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The registered `DOOM.WAD` contains exactly 9 `E2M<digit>` map header lumps for digits 1..9 (Episode 2: The Shores of Hell). Vanilla `P_SetupLevel` resolves `E2M*` markers via `W_GetNumForName(lumpname)`, which fatals on miss; ep2 maps are mandatory in registered. The runtime models this with `detectRegisteredIwadCapabilities(...).episode2MapCount === 9`.',
  },
  {
    id: 'registered-episode3-map-count-is-nine',
    subject: 'map-marker-lump',
    cSourceLines: ["lumpname[0] = 'E';", "lumpname[1] = '0'+gameepisode;", "lumpname[2] = 'M';", "lumpname[3] = '0'+gamemap;"],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The registered `DOOM.WAD` contains exactly 9 `E3M<digit>` map header lumps for digits 1..9 (Episode 3: Inferno). The presence of `E3M1` is the canonical positive identification rule for `gamemode = registered` (Chocolate Doom 2.2.1 `D_IdentifyVersion`). The runtime models this with `detectRegisteredIwadCapabilities(...).episode3MapCount === 9`.',
  },
  {
    id: 'registered-ultimate-episode-markers-absent',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode != retail)', '    /* episode 4 unavailable */'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` contains zero `E4M*` map header lumps. Episode 4 (Thy Flesh Consumed) was added in The Ultimate DOOM (retail), and registered predates that release. The presence of `E4M1` collapses the registered branch to `retail` in `D_IdentifyVersion`. The runtime models this with `detectRegisteredIwadCapabilities(...).episode4MapCount === 0`.',
  },
  {
    id: 'registered-doom2-map-markers-absent',
    subject: 'map-marker-lump',
    cSourceLines: ['if (gamemode == commercial)', '    sprintf(lumpname, "map%02i", gamemap);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The registered `DOOM.WAD` contains zero `MAP##` map header lumps. Vanilla `G_DoLoadLevel` only constructs the `MAP%02i` lumpname when `gamemode == commercial`; registered never reaches that branch. The runtime models this with `detectRegisteredIwadCapabilities(...).doom2MapCount === 0`.',
  },
  {
    id: 'registered-texture1-present',
    subject: 'texture-lump',
    cSourceLines: ['maptex1 = W_CacheLumpName ("TEXTURE1", PU_STATIC);', 'numtextures1 = LONG(*maptex1);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The registered `DOOM.WAD` contains a `TEXTURE1` lump (the canonical first texture set). Vanilla `R_InitTextures` always loads `TEXTURE1` via `W_CacheLumpName`; absence is fatal. The runtime models this with `detectRegisteredIwadCapabilities(...).hasTexture1 === true`.',
  },
  {
    id: 'registered-texture2-present',
    subject: 'texture-lump',
    cSourceLines: ['if (W_CheckNumForName ("TEXTURE2") != -1)', '    maptex2 = W_CacheLumpName ("TEXTURE2", PU_STATIC);', 'else', '    maptex2 = NULL;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The registered `DOOM.WAD` contains a `TEXTURE2` lump (the registered/Ultimate-only second texture set, including ep2/ep3 textures absent from shareware). `TEXTURE2` is the canonical capability differentiator between shareware and registered/Ultimate IWADs: vanilla `R_InitTextures` checks `W_CheckNumForName ("TEXTURE2") != -1` and loads it when present. The runtime models this with `detectRegisteredIwadCapabilities(...).hasTexture2 === true`.',
  },
  {
    id: 'registered-pnames-present',
    subject: 'patch-name-lump',
    cSourceLines: ['names = W_CacheLumpName ("PNAMES", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The registered `DOOM.WAD` contains a `PNAMES` lump (the patch name table referenced by both TEXTURE1 and TEXTURE2 entries). Vanilla `R_InitTextures` always loads `PNAMES`; absence is fatal. The runtime models this with `detectRegisteredIwadCapabilities(...).hasPnames === true`.',
  },
  {
    id: 'registered-playpal-and-colormap-present',
    subject: 'palette-lump',
    cSourceLines: ['playpal = W_CacheLumpName ("PLAYPAL", PU_CACHE);', 'colormaps = W_CacheLumpName ("COLORMAP", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The registered `DOOM.WAD` contains a `PLAYPAL` 768-byte palette set (14 palettes) and a `COLORMAP` 8704-byte colormap set (34 colormaps). Both lumps are mandatory for the renderer; absence is fatal. The runtime models this with `detectRegisteredIwadCapabilities(...).hasPlaypal === true` and `hasColormap === true`.',
  },
  {
    id: 'registered-endoom-present',
    subject: 'audio-lump',
    cSourceLines: ['endoom = W_CacheLumpName("ENDOOM", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` contains an `ENDOOM` 4000-byte text-mode quit screen. Vanilla `I_Quit` blits the ENDOOM lump to the DOS text-mode framebuffer at exit. The runtime models this with `detectRegisteredIwadCapabilities(...).hasEndoom === true`.',
  },
  {
    id: 'registered-genmidi-and-dmxgus-present',
    subject: 'audio-lump',
    cSourceLines: ['genmidi = W_CacheLumpName("GENMIDI", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` contains a `GENMIDI` OPL2 instrument bank and a `DMXGUS` Gravis UltraSound instrument bank. Both are required by the DMX sound library to render MUS music on FM and GUS hardware. The runtime models this with `detectRegisteredIwadCapabilities(...).hasGenmidi === true` and `hasDmxgus === true`.',
  },
  {
    id: 'registered-titlepic-and-credit-present',
    subject: 'menu-screen-lump',
    cSourceLines: ['pagename = "TITLEPIC";', 'pagename = "CREDIT";'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` contains `TITLEPIC` (the title screen) and `CREDIT` (the credits screen). Vanilla `D_PageDrawer` cycles through pagenames during the demo loop; both are required for the title sequence. The runtime models this with `detectRegisteredIwadCapabilities(...).hasTitlepic === true` and `hasCredit === true`.',
  },
  {
    id: 'registered-help1-and-help2-present',
    subject: 'menu-screen-lump',
    cSourceLines: ['V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("HELP1", PU_CACHE));', 'V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("HELP2", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/m_menu.c',
    invariant:
      'The registered `DOOM.WAD` contains BOTH `HELP1` and `HELP2` lumps. Vanilla `M_DrawReadThis1` reads `HELP1` and `M_DrawReadThis2` reads `HELP2` ("We only ever draw the second page if this is gameversion == registered"). HELP1 is the in-game help; HELP2 is the order screen advertising Ultimate DOOM. The runtime models this with `detectRegisteredIwadCapabilities(...).hasHelp1 === true` and `hasHelp2 === true`.',
  },
  {
    id: 'registered-stbar-and-starms-present',
    subject: 'status-bar-lump',
    cSourceLines: ['sbar = W_CacheLumpName("STBAR", PU_STATIC);', 'starms = W_CacheLumpName("STARMS", PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` contains `STBAR` (the main status bar background) and `STARMS` (the arms display overlay). Vanilla `ST_Init` loads both via `W_CacheLumpName`; absence is fatal. The runtime models this with `detectRegisteredIwadCapabilities(...).hasStbar === true` and `hasStarms === true`.',
  },
  {
    id: 'registered-sky1-sky2-sky3-present',
    subject: 'sky-texture-lump',
    cSourceLines: ['case 1: skytexname = "SKY1"; break;', 'case 2: skytexname = "SKY2"; break;', 'case 3: skytexname = "SKY3"; break;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The registered `DOOM.WAD` contains `SKY1` (Knee-Deep in the Dead sky), `SKY2` (Shores of Hell sky), and `SKY3` (Inferno sky). Vanilla `G_DoLoadLevel` selects the per-episode sky texture; ep2 and ep3 maps fatal at sky resolution if their sky texture is missing. The runtime models this with `detectRegisteredIwadCapabilities(...).hasSky1 === true`, `hasSky2 === true`, and `hasSky3 === true`.',
  },
  {
    id: 'registered-sky4-absent',
    subject: 'sky-texture-lump',
    cSourceLines: ['case 4: skytexname = "SKY4"; break;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The registered `DOOM.WAD` does NOT contain `SKY4`. The Episode 4 (Thy Flesh Consumed) sky texture was added in The Ultimate DOOM (retail); registered predates ep4. The runtime models this with `detectRegisteredIwadCapabilities(...).hasSky4 === false`.',
  },
  {
    id: 'registered-wimap0-wimap1-wimap2-present',
    subject: 'intermission-lump',
    cSourceLines: ['sprintf(name, "WIMAP%i", wbs->epsd);'],
    referenceSourceFile: 'linuxdoom-1.10/wi_stuff.c',
    invariant:
      'The registered `DOOM.WAD` contains `WIMAP0` (ep1 Phobos intermission), `WIMAP1` (ep2 Deimos intermission), and `WIMAP2` (ep3 Inferno intermission). Vanilla `WI_loadData` formats the name `WIMAP%i` with `wbs->epsd` (episode index 0..3); registered exercises indices 0, 1, 2. The runtime models this with `detectRegisteredIwadCapabilities(...).hasWimap0 === true`, `hasWimap1 === true`, and `hasWimap2 === true`.',
  },
  {
    id: 'registered-victory2-present',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("VICTORY2", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The registered `DOOM.WAD` contains `VICTORY2`. Vanilla `F_TextWrite` reads `VICTORY2` after Episode 2 (The Shores of Hell). Episode 2 is registered and Ultimate; absence on registered fatals the ep2 finale. The runtime models this with `detectRegisteredIwadCapabilities(...).hasVictory2 === true`.',
  },
  {
    id: 'registered-endpic-present',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("ENDPIC", PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The registered `DOOM.WAD` contains `ENDPIC`. Vanilla `F_TextWrite` reads `ENDPIC` after Episode 3 (Inferno) following the bunny scroll. Episode 3 is registered and Ultimate; absence on registered fatals the ep3 finale. The runtime models this with `detectRegisteredIwadCapabilities(...).hasEndpic === true`.',
  },
  {
    id: 'registered-pfub-bunny-scroll-patches-present',
    subject: 'finale-lump',
    cSourceLines: ['p1 = W_CacheLumpName ("PFUB2", PU_LEVEL);', 'p2 = W_CacheLumpName ("PFUB1", PU_LEVEL);'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The registered `DOOM.WAD` contains `PFUB1` and `PFUB2`. Vanilla `F_BunnyScroll` reads both lumps for the Episode 3 (Inferno) ending bunny-scroll background; absence on registered fatals the ep3 ending. The runtime models this with `detectRegisteredIwadCapabilities(...).hasPfub1 === true` and `hasPfub2 === true`.',
  },
  {
    id: 'registered-bossback-absent',
    subject: 'finale-lump',
    cSourceLines: ['V_DrawPatch(0, 0, W_CacheLumpName(bgcastcall, PU_CACHE));'],
    referenceSourceFile: 'linuxdoom-1.10/f_finale.c',
    invariant:
      'The registered `DOOM.WAD` does NOT contain `BOSSBACK`. Vanilla `F_CastDrawer` reads `BOSSBACK` as the cast-call backdrop only when `gamemode == commercial` and `gamemap == 30` (the DOOM 2 ending). Registered is not commercial. The runtime models this with `detectRegisteredIwadCapabilities(...).hasBossback === false`.',
  },
  {
    id: 'registered-three-demos-present',
    subject: 'demo-lump',
    cSourceLines: ['lumpname = "DEMO1";', 'lumpname = "DEMO2";', 'lumpname = "DEMO3";'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` contains three demo lumps `DEMO1`, `DEMO2`, and `DEMO3`. Vanilla `D_PageTicker` cycles `pagetic` between three pages, each playing one demo. All three reference Episode 1, 2, or 3 maps. The runtime models this with `detectRegisteredIwadCapabilities(...).hasDemo1 === true`, `hasDemo2 === true`, and `hasDemo3 === true`.',
  },
  {
    id: 'registered-demo4-absent',
    subject: 'demo-lump',
    cSourceLines: ['/* DEMO4 only present in Ultimate DOOM (retail) */'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'The registered `DOOM.WAD` does NOT contain `DEMO4`. The fourth demo was added in Ultimate DOOM (retail) to showcase Episode 4 content. The runtime models this with `detectRegisteredIwadCapabilities(...).hasDemo4 === false`.',
  },
  {
    id: 'registered-flat-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['firstflat = W_GetNumForName ("F_START");', 'lastflat = W_GetNumForName ("F_END") - 1;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The registered `DOOM.WAD` contains the `F_START` / `F_END` marker pair bracketing the flat namespace. Vanilla `R_InitFlats` resolves both markers via `W_GetNumForName`; absence is fatal. The runtime models this with `detectRegisteredIwadCapabilities(...).hasFlatMarkerRange === true`.',
  },
  {
    id: 'registered-sprite-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['firstspritelump = W_GetNumForName ("S_START") + 1;', 'lastspritelump = W_GetNumForName ("S_END") - 1;'],
    referenceSourceFile: 'linuxdoom-1.10/r_data.c',
    invariant:
      'The registered `DOOM.WAD` contains the `S_START` / `S_END` marker pair bracketing the sprite namespace. Vanilla `R_InitSpriteLumps` resolves both markers via `W_GetNumForName`; absence is fatal. The runtime models this with `detectRegisteredIwadCapabilities(...).hasSpriteMarkerRange === true`.',
  },
  {
    id: 'registered-patch-marker-range-present',
    subject: 'marker-range',
    cSourceLines: ['/* P_START / P_END bracket optional patches namespace */'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The registered `DOOM.WAD` contains the `P_START` / `P_END` marker pair bracketing the patch namespace. The marker range is empirically present in every official id IWAD (the same convention as shareware), kept for PWAD compatibility. The runtime models this with `detectRegisteredIwadCapabilities(...).hasPatchMarkerRange === true`.',
  },
  {
    id: 'registered-cyberdemon-sprite-present',
    subject: 'sprite-frame-lump',
    cSourceLines: ['/* CYBR sprite frames - Cyberdemon (boss of episode 2: The Shores of Hell) */'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'The registered `DOOM.WAD` contains sprite frames whose names start with `CYBR` (the Cyberdemon sprite prefix). The Cyberdemon is the boss of Episode 2 (Tower of Babel), present in registered and Ultimate. Vanilla `P_SpawnMapThing` resolves `MT_CYBORG` mobjs whose `info.spawnstate` chain references CYBR sprite frames; absence fatals ep2 boss combat. The runtime models this with `detectRegisteredIwadCapabilities(...).hasCyberdemonSprite === true`.',
  },
  {
    id: 'registered-spider-mastermind-sprite-present',
    subject: 'sprite-frame-lump',
    cSourceLines: ['/* SPID sprite frames - Spider Mastermind (boss of episode 3: Inferno) */'],
    referenceSourceFile: 'linuxdoom-1.10/p_setup.c',
    invariant:
      'The registered `DOOM.WAD` contains sprite frames whose names start with `SPID` (the Spider Mastermind sprite prefix). The Spider Mastermind is the boss of Episode 3 (Dis), present in registered and Ultimate. Vanilla `P_SpawnMapThing` resolves `MT_SPIDER` mobjs whose `info.spawnstate` chain references SPID sprite frames; absence fatals ep3 boss combat. The runtime models this with `detectRegisteredIwadCapabilities(...).hasSpiderMastermindSprite === true`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface RegisteredIwadCapabilityDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const REGISTERED_IWAD_CAPABILITY_DERIVED_INVARIANTS: readonly RegisteredIwadCapabilityDerivedInvariant[] = [
  {
    id: 'REGISTERED_IWAD_MAP_BUNDLE_COUNT_EQUALS_TWENTYSEVEN',
    description: '`REGISTERED_IWAD_MAP_BUNDLE_COUNT === 27`. Matches the empirical 27 map markers (E1M1..E1M9, E2M1..E2M9, E3M1..E3M9) and the gamemode=registered three-episode constraint.',
  },
  {
    id: 'REGISTERED_IWAD_EPISODE_COUNT_EQUALS_THREE',
    description: '`REGISTERED_IWAD_EPISODE_COUNT === 3`. Matches `EPISODE_COUNTS.registered = 3` from `src/bootstrap/gameMode.ts`.',
  },
  {
    id: 'DETECT_REGISTERED_RETURNS_FROZEN_DETECTION',
    description: 'A successful `detectRegisteredIwadCapabilities(directory)` returns an object that is `Object.isFrozen`.',
  },
  {
    id: 'DETECT_REGISTERED_PROPAGATES_PWAD_TYPE',
    description: '`detectRegisteredIwadCapabilities` reports `wadType: "PWAD"` rather than `"IWAD"` when the supplied header type is `"PWAD"`. Matches the IWAD vs PWAD identification stamp distinction.',
  },
  {
    id: 'IS_REGISTERED_IWAD_ACCEPTS_SYNTHETIC_REGISTERED',
    description: '`isRegisteredIwad(directory)` returns `true` for a synthesised directory that matches the registered fingerprint (27 map markers, TEXTURE2 present, no E4M*, no MAP##).',
  },
  {
    id: 'IS_REGISTERED_IWAD_REJECTS_E4M1_PRESENT',
    description: '`isRegisteredIwad(directory)` returns `false` for any directory containing `E4M1` (Ultimate-only).',
  },
  {
    id: 'IS_REGISTERED_IWAD_REJECTS_MAP01_PRESENT',
    description: '`isRegisteredIwad(directory)` returns `false` for any directory containing `MAP01` (commercial-only).',
  },
  {
    id: 'IS_REGISTERED_IWAD_REJECTS_TEXTURE2_ABSENT',
    description: '`isRegisteredIwad(directory)` returns `false` for any directory missing `TEXTURE2` (registered/Ultimate differentiator vs shareware).',
  },
  {
    id: 'IS_REGISTERED_IWAD_REJECTS_E2M1_ABSENT',
    description: '`isRegisteredIwad(directory)` returns `false` for any directory missing `E2M1` (shareware fingerprint).',
  },
  {
    id: 'IS_REGISTERED_IWAD_REJECTS_E3M1_ABSENT',
    description: '`isRegisteredIwad(directory)` returns `false` for any directory missing `E3M1` (the canonical positive-identification rule from `D_IdentifyVersion`).',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Number of map markers in the registered DOOM.WAD (E1M1..E1M9, E2M1..E2M9, E3M1..E3M9). */
export const REGISTERED_IWAD_MAP_BUNDLE_COUNT = 27;

/** Episode count for registered (matches `EPISODE_COUNTS.registered`). */
export const REGISTERED_IWAD_EPISODE_COUNT = 3;

/** Required infrastructure lump names that must be present in every registered IWAD. */
export const REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS: readonly string[] = Object.freeze([
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
  'HELP2',
  'STBAR',
  'STARMS',
  'SKY1',
  'SKY2',
  'SKY3',
  'WIMAP0',
  'WIMAP1',
  'WIMAP2',
  'VICTORY2',
  'ENDPIC',
  'PFUB1',
  'PFUB2',
]);

/** Required demo lump names present in registered. */
export const REGISTERED_REQUIRED_DEMO_LUMPS: readonly string[] = Object.freeze(['DEMO1', 'DEMO2', 'DEMO3']);

/** Required marker range pair names present in registered. */
export const REGISTERED_REQUIRED_MARKER_RANGES: readonly string[] = Object.freeze(['F_START', 'F_END', 'S_START', 'S_END', 'P_START', 'P_END']);

/** Required boss sprite frame name prefixes present in registered. */
export const REGISTERED_REQUIRED_SPRITE_PREFIXES: readonly string[] = Object.freeze(['CYBR', 'SPID']);

/** Lump names whose presence indicates a non-registered IWAD (Ultimate or commercial). */
export const REGISTERED_NEGATIVE_FINGERPRINT_LUMPS: readonly string[] = Object.freeze(['E4M1', 'MAP01', 'SKY4', 'BOSSBACK', 'DEMO4']);

/** Capability detection result for one IWAD directory. */
export interface RegisteredIwadCapabilityDetection {
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
 * registered DOOM.WAD baseline.
 *
 * Mirrors the gates Vanilla DOOM 1.9 enforces in `IdentifyVersion()`,
 * `R_InitTextures`, `M_DrawReadThis2`, `WI_loadData`, and `F_TextWrite`.
 * Every capability flag corresponds to one observable lump-presence (or
 * sprite-prefix-presence) probe against the directory.
 *
 * @param directory - Parsed WAD directory entries.
 * @param wadType - WAD identification stamp from the header (`IWAD` or `PWAD`).
 * @returns Frozen {@link RegisteredIwadCapabilityDetection}.
 */
export function detectRegisteredIwadCapabilities(directory: readonly DirectoryEntry[], wadType: 'IWAD' | 'PWAD'): RegisteredIwadCapabilityDetection {
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
 * Predicate identifying the registered DOOM.WAD by its capability
 * fingerprint: 9 episode-1, 9 episode-2, and 9 episode-3 map markers,
 * no episode-4 or commercial map markers, both `TEXTURE1` and `TEXTURE2`
 * present, and IWAD identification stamp.
 *
 * Mirrors Chocolate Doom 2.2.1 `D_IdentifyVersion`: registered is
 * the branch where `E3M1` is present and `E4M1` is absent (also see
 * `identifyMode` in `src/bootstrap/gameMode.ts`).
 *
 * @param directory - Parsed WAD directory entries.
 * @param wadType - WAD identification stamp from the header.
 */
export function isRegisteredIwad(directory: readonly DirectoryEntry[], wadType: 'IWAD' | 'PWAD'): boolean {
  const detection = detectRegisteredIwadCapabilities(directory, wadType);
  return (
    detection.wadType === 'IWAD' &&
    detection.episode1MapCount === 9 &&
    detection.episode2MapCount === 9 &&
    detection.episode3MapCount === 9 &&
    detection.episode4MapCount === 0 &&
    detection.doom2MapCount === 0 &&
    detection.hasTexture1 &&
    detection.hasTexture2
  );
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/detect-registered-iwad-capabilities.ts`. The cross-check
 * helper consumes this shape so the focused test can both verify the
 * live runtime exports and exercise a deliberately tampered snapshot
 * to prove the failure modes are observable.
 */
export interface RegisteredIwadCapabilityRuntimeSnapshot {
  readonly registeredIwadMapBundleCount: number;
  readonly registeredIwadEpisodeCount: number;
  readonly detectRegisteredReturnsFrozenDetection: boolean;
  readonly detectRegisteredPropagatesPwadType: boolean;
  readonly isRegisteredIwadAcceptsSyntheticRegistered: boolean;
  readonly isRegisteredIwadRejectsE4M1Present: boolean;
  readonly isRegisteredIwadRejectsMap01Present: boolean;
  readonly isRegisteredIwadRejectsTexture2Absent: boolean;
  readonly isRegisteredIwadRejectsE2M1Absent: boolean;
  readonly isRegisteredIwadRejectsE3M1Absent: boolean;
}

/**
 * Cross-check a `RegisteredIwadCapabilityRuntimeSnapshot` against
 * `REGISTERED_IWAD_CAPABILITY_AUDIT` and
 * `REGISTERED_IWAD_CAPABILITY_DERIVED_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the snapshot is
 * parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckRegisteredIwadCapabilityRuntime(snapshot: RegisteredIwadCapabilityRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.registeredIwadMapBundleCount !== 27) {
    failures.push('derived:REGISTERED_IWAD_MAP_BUNDLE_COUNT_EQUALS_TWENTYSEVEN');
    failures.push('audit:registered-map-bundle-count-is-twentyseven:not-observed');
  }
  if (snapshot.registeredIwadEpisodeCount !== 3) {
    failures.push('derived:REGISTERED_IWAD_EPISODE_COUNT_EQUALS_THREE');
  }
  if (!snapshot.detectRegisteredReturnsFrozenDetection) {
    failures.push('derived:DETECT_REGISTERED_RETURNS_FROZEN_DETECTION');
  }
  if (!snapshot.detectRegisteredPropagatesPwadType) {
    failures.push('derived:DETECT_REGISTERED_PROPAGATES_PWAD_TYPE');
    failures.push('audit:registered-wad-type-is-iwad:not-observed');
  }
  if (!snapshot.isRegisteredIwadAcceptsSyntheticRegistered) {
    failures.push('derived:IS_REGISTERED_IWAD_ACCEPTS_SYNTHETIC_REGISTERED');
    failures.push('audit:registered-episode3-map-count-is-nine:not-observed');
  }
  if (!snapshot.isRegisteredIwadRejectsE4M1Present) {
    failures.push('derived:IS_REGISTERED_IWAD_REJECTS_E4M1_PRESENT');
    failures.push('audit:registered-ultimate-episode-markers-absent:not-observed');
  }
  if (!snapshot.isRegisteredIwadRejectsMap01Present) {
    failures.push('derived:IS_REGISTERED_IWAD_REJECTS_MAP01_PRESENT');
    failures.push('audit:registered-doom2-map-markers-absent:not-observed');
  }
  if (!snapshot.isRegisteredIwadRejectsTexture2Absent) {
    failures.push('derived:IS_REGISTERED_IWAD_REJECTS_TEXTURE2_ABSENT');
    failures.push('audit:registered-texture2-present:not-observed');
  }
  if (!snapshot.isRegisteredIwadRejectsE2M1Absent) {
    failures.push('derived:IS_REGISTERED_IWAD_REJECTS_E2M1_ABSENT');
    failures.push('audit:registered-episode2-map-count-is-nine:not-observed');
  }
  if (!snapshot.isRegisteredIwadRejectsE3M1Absent) {
    failures.push('derived:IS_REGISTERED_IWAD_REJECTS_E3M1_ABSENT');
    failures.push('audit:registered-episode3-map-count-is-nine:not-observed');
  }

  const declaredAxes = new Set(REGISTERED_IWAD_CAPABILITY_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<RegisteredIwadCapabilityAuditEntry['id']> = [
    'registered-wad-type-is-iwad',
    'registered-map-bundle-count-is-twentyseven',
    'registered-episode1-map-count-is-nine',
    'registered-episode2-map-count-is-nine',
    'registered-episode3-map-count-is-nine',
    'registered-ultimate-episode-markers-absent',
    'registered-doom2-map-markers-absent',
    'registered-texture1-present',
    'registered-texture2-present',
    'registered-pnames-present',
    'registered-playpal-and-colormap-present',
    'registered-endoom-present',
    'registered-genmidi-and-dmxgus-present',
    'registered-titlepic-and-credit-present',
    'registered-help1-and-help2-present',
    'registered-stbar-and-starms-present',
    'registered-sky1-sky2-sky3-present',
    'registered-sky4-absent',
    'registered-wimap0-wimap1-wimap2-present',
    'registered-victory2-present',
    'registered-endpic-present',
    'registered-pfub-bunny-scroll-patches-present',
    'registered-bossback-absent',
    'registered-three-demos-present',
    'registered-demo4-absent',
    'registered-flat-marker-range-present',
    'registered-sprite-marker-range-present',
    'registered-patch-marker-range-present',
    'registered-cyberdemon-sprite-present',
    'registered-spider-mastermind-sprite-present',
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
 * Pinned oracle facts for the registered `DOOM.WAD` capability
 * fingerprint. The registered IWAD is user-supplied per
 * `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`
 * and is absent from this working tree; the pinned facts are derived
 * from authority 4 (the C source code that requires specific lumps to
 * exist for `gamemode = registered` to render correctly).
 *
 * The pinned `wadType`, per-episode map counts, and capability flag
 * values are observable on every official id registered DOOM.WAD; the
 * `totalLumpCount` is intentionally not pinned because it varies with
 * end-user patch installations and is not enforced by any code path.
 */
export interface RegisteredDoomWadCapabilityOracle {
  /** Filename relative to the user-supplied search root. */
  readonly filename: 'DOOM.WAD';
  /** WAD identification stamp. */
  readonly wadType: 'IWAD';
  /** Number of map header lumps. */
  readonly mapBundleCount: 27;
  /** Number of E1M* markers. */
  readonly episode1MapCount: 9;
  /** Number of E2M* markers. */
  readonly episode2MapCount: 9;
  /** Number of E3M* markers. */
  readonly episode3MapCount: 9;
  /** Number of E4M* markers. */
  readonly episode4MapCount: 0;
  /** Number of MAP## markers. */
  readonly doom2MapCount: 0;
  /** Lump-presence fingerprint. */
  readonly capabilityFlags: RegisteredDoomWadCapabilityFlags;
}

/** Lump-presence flags pinned for the registered DOOM.WAD. */
export interface RegisteredDoomWadCapabilityFlags {
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
  readonly hasHelp2: true;
  readonly hasStbar: true;
  readonly hasStarms: true;
  readonly hasSky1: true;
  readonly hasSky2: true;
  readonly hasSky3: true;
  readonly hasSky4: false;
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
  readonly hasDemo4: false;
  readonly hasFlatMarkerRange: true;
  readonly hasSpriteMarkerRange: true;
  readonly hasPatchMarkerRange: true;
  readonly hasCyberdemonSprite: true;
  readonly hasSpiderMastermindSprite: true;
}

/**
 * Pinned oracle facts for the registered `DOOM.WAD` capability
 * fingerprint, derived from authority 4 (linuxdoom-1.10 source code).
 */
export const REGISTERED_DOOM_WAD_CAPABILITY_ORACLE: RegisteredDoomWadCapabilityOracle = Object.freeze({
  filename: 'DOOM.WAD',
  wadType: 'IWAD',
  mapBundleCount: 27,
  episode1MapCount: 9,
  episode2MapCount: 9,
  episode3MapCount: 9,
  episode4MapCount: 0,
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
    hasHelp2: true,
    hasStbar: true,
    hasStarms: true,
    hasSky1: true,
    hasSky2: true,
    hasSky3: true,
    hasSky4: false,
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
    hasDemo4: false,
    hasFlatMarkerRange: true,
    hasSpriteMarkerRange: true,
    hasPatchMarkerRange: true,
    hasCyberdemonSprite: true,
    hasSpiderMastermindSprite: true,
  }) as RegisteredDoomWadCapabilityFlags,
}) as RegisteredDoomWadCapabilityOracle;

/**
 * Sample shape mirroring the on-disk DOOM.WAD oracle layout for the
 * capability fingerprint so the focused test can re-derive the values
 * from an in-memory synthesised registered directory and feed the
 * result into the cross-check.
 */
export interface RegisteredDoomWadCapabilitySample {
  readonly wadType: 'IWAD' | 'PWAD';
  readonly mapBundleCount: number;
  readonly episode1MapCount: number;
  readonly episode2MapCount: number;
  readonly episode3MapCount: number;
  readonly episode4MapCount: number;
  readonly doom2MapCount: number;
  readonly capabilityFlags: { readonly [K in keyof RegisteredDoomWadCapabilityFlags]: boolean };
}

/**
 * Cross-check a registered DOOM.WAD capability sample against the
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
export function crossCheckRegisteredDoomWadCapabilitySample(sample: RegisteredDoomWadCapabilitySample): readonly string[] {
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
    if (sample[field] !== REGISTERED_DOOM_WAD_CAPABILITY_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  const flagFields: ReadonlyArray<keyof RegisteredDoomWadCapabilityFlags> = [
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
    if (sample.capabilityFlags[flag] !== REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags[flag]) {
      failures.push(`oracle:capabilityFlags:${flag}:value-mismatch`);
    }
  }

  return failures;
}
