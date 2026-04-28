/**
 * Audit ledger for the vanilla DOOM 1.9 demo lump parser, the
 * `G_DoPlayDemo()` / `G_BeginRecording()` pipeline that resolves the
 * built-in attract-mode demo names (`demo1`, `demo2`, `demo3`) to
 * directory lumps named `DEMO1`, `DEMO2`, `DEMO3`, loads the 13-byte
 * on-disk demo header, validates the 1-byte demo-version field
 * (`109` for vanilla DOOM 1.9), reads the unsigned 8-bit `skill`,
 * `episode`, `map`, `deathmatch`, `respawnparm`, `fastparm`,
 * `nomonsters`, and `consoleplayer` fields, reads the 4-byte
 * `playeringame[MAXPLAYERS]` array, and exposes the trailing tic
 * command stream (4 bytes per active player per tic, terminated by a
 * single `0x80` `DEMOMARKER` byte) to the demo playback loop.
 *
 * This module pins the runtime contract one level deeper than the
 * prior 05-001..05-004 marker / lookup audits, the 05-005 PLAYPAL /
 * COLORMAP audit, the 05-006 patch picture format audit, the 05-007
 * flat namespace audit, the 05-008 PNAMES audit, the 05-009 / 05-010
 * TEXTURE1 / TEXTURE2 audits, the 05-011 sprite namespace audit, the
 * 05-012 sound effect lump audit, and the 05-013 music MUS lump
 * audit: the 4-byte `DEMO` lump-name prefix produced by
 * `G_DeferedPlayDemo("demo1")` (uppercased by `W_CheckNumForName`
 * before hashing), the upstream 13-byte demo header laid down by
 * `G_BeginRecording()` as nine sequential `*demo_p++ = <byte>`
 * writes plus a 4-byte `playeringame[MAXPLAYERS]` loop, the
 * `*demo_p++ != VERSION` (linuxdoom-1.10) / `demoversion ==
 * G_VanillaVersionCode()` (Chocolate Doom 2.2.1) version-byte gate
 * with vanilla DOOM 1.9 returning `109`, the per-tic encoding
 * captured by `G_ReadDemoTiccmd()` as `forwardmove` (signed 8-bit),
 * `sidemove` (signed 8-bit), `angleturn` (`((unsigned char)*demo_p++) << 8`,
 * the high byte of the 16-bit angle delta), and `buttons` (unsigned
 * 8-bit) — a single 4-byte ticcmd per active player, the
 * `DEMOMARKER == 0x80` end-of-demo sentinel that `G_ReadDemoTiccmd`
 * branches on (`if (*demo_p == DEMOMARKER) G_CheckDemoStatus()`),
 * the 35 Hz `TICRATE` shared with all other game logic, the
 * absence of any `S_START` / `S_END` / `F_START` / `F_END` marker
 * range around the demo lumps (demo lumps live at fixed names
 * anywhere in the directory and are looked up by full lump name via
 * `W_CacheLumpName`, not by marker-bounded range), and the
 * shareware `doom/DOOM1.WAD` axis pinning 3 demo lumps spanning
 * directory indices 3 (DEMO1, the first demo) through 5 (DEMO3, the
 * last demo). The accompanying focused test imports the ledger plus
 * a self-contained `parseDemoLumpHeader` runtime exposed by this
 * module and cross-checks every audit entry against the runtime
 * behavior plus the live shareware `doom/DOOM1.WAD` oracle.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (`g_game.c`, `doomdef.h`),
 *   5. Chocolate Doom 2.2.1 source (`src/doom/g_game.c`,
 *      `src/doom/d_main.c`, `src/doom/doomdef.h`).
 *
 * The header layout and validation rules below are pinned against
 * authority 4 (id Software `linuxdoom-1.10/g_game.c` `G_BeginRecording`
 * and `G_DoPlayDemo`) for the byte-by-byte field order, against
 * authority 5 (Chocolate Doom 2.2.1 `g_game.c` `G_VanillaVersionCode`)
 * for the vanilla DOOM 1.9 version-byte value of `109`, against
 * authority 4 (linuxdoom-1.10 `g_game.c` `G_ReadDemoTiccmd` and
 * `#define DEMOMARKER 0x80`) for the per-tic 4-byte encoding and
 * the end-of-demo sentinel byte, and against authority 2 (the live
 * shareware IWAD itself) for the on-disk inventory facts: 3 demo
 * lumps, first demo at directory index 3 = DEMO1, last demo at
 * directory index 5 = DEMO3, plus pinned per-demo file offsets, raw
 * header field values, derived tic counts, and SHA-256 fingerprints,
 * re-derived from the on-disk file every test run.
 */

import { BinaryReader } from '../core/binaryReader.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract of the demo lump parser, pinned to its upstream
 * declaration.
 */
export interface DemoLumpAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'demo-lump-name-prefix-demo'
    | 'demo-lump-name-defdemoname-demo-n'
    | 'demo-lump-name-lookup-via-w-cachelumpname'
    | 'demo-lump-header-bytes-thirteen'
    | 'demo-lump-version-field-offset-zero-uint8'
    | 'demo-lump-version-vanilla-109'
    | 'demo-lump-skill-field-offset-one-uint8'
    | 'demo-lump-episode-field-offset-two-uint8'
    | 'demo-lump-map-field-offset-three-uint8'
    | 'demo-lump-deathmatch-field-offset-four-uint8'
    | 'demo-lump-respawnparm-field-offset-five-uint8'
    | 'demo-lump-fastparm-field-offset-six-uint8'
    | 'demo-lump-nomonsters-field-offset-seven-uint8'
    | 'demo-lump-consoleplayer-field-offset-eight-uint8'
    | 'demo-lump-playeringame-field-offset-nine-four-uint8s'
    | 'demo-lump-ticcmd-bytes-four-per-active-player'
    | 'demo-lump-ticcmd-forwardmove-signed-int8'
    | 'demo-lump-ticcmd-sidemove-signed-int8'
    | 'demo-lump-ticcmd-angleturn-uint8-shifted-left-eight'
    | 'demo-lump-ticcmd-buttons-uint8'
    | 'demo-lump-end-marker-0x80'
    | 'demo-lump-tic-rate-thirty-five-hz'
    | 'demo-lump-no-marker-range'
    | 'demo-lump-shareware-doom1-three-demos';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'DEMO-lump' | 'G_BeginRecording' | 'G_DoPlayDemo' | 'G_ReadDemoTiccmd' | 'G_DeferedPlayDemo' | 'parseDemoLumpHeader' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the upstream tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/g_game.c' | 'linuxdoom-1.10/d_main.c' | 'linuxdoom-1.10/doomdef.h' | 'src/doom/g_game.c' | 'shareware/DOOM1.WAD';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and runtime
 * parser contract the runtime demo lump loader must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const DEMO_LUMP_AUDIT: readonly DemoLumpAuditEntry[] = [
  {
    id: 'demo-lump-name-prefix-demo',
    subject: 'G_DeferedPlayDemo',
    cSourceLines: ['G_DeferedPlayDemo ("demo1");', 'G_DeferedPlayDemo ("demo2");', 'G_DeferedPlayDemo ("demo3");'],
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
    invariant:
      'Vanilla `D_DoAdvanceDemo` queues each attract-mode demo by the lowercase base name (`"demo1"`, `"demo2"`, `"demo3"`). The WAD directory stores names uppercase, and `W_CheckNumForName` / `W_GetNumForName` uppercase the lookup key before hashing, so the on-disk lumps appear as `DEMO1`, `DEMO2`, `DEMO3`. The runtime models this with `DEMO_LUMP_NAME_PREFIX === "DEMO"` exposed as the canonical uppercase prefix.',
  },
  {
    id: 'demo-lump-name-defdemoname-demo-n',
    subject: 'G_DoPlayDemo',
    cSourceLines: ['demobuffer = demo_p = W_CacheLumpName (defdemoname, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'Vanilla `G_DoPlayDemo` resolves the deferred `defdemoname` (one of `"demo1"`/`"demo2"`/`"demo3"` set by `G_DeferedPlayDemo`) via `W_CacheLumpName`. The base name plus the `DEMO` prefix is exactly 5 characters, fitting comfortably in the 8-byte WAD directory name field. The runtime models this with `DEMO_LUMP_NAME_PREFIX_LENGTH === 4` and `DEMO_LUMP_NAME_FIELD_BYTES === 8` exposed by `parse-demo-lumps.ts`.',
  },
  {
    id: 'demo-lump-name-lookup-via-w-cachelumpname',
    subject: 'G_DoPlayDemo',
    cSourceLines: ['demobuffer = demo_p = W_CacheLumpName (defdemoname, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'Vanilla `G_DoPlayDemo` resolves the deferred demo name via `W_CacheLumpName`, which calls through `W_GetNumForName` and throws a fatal `I_Error` on miss (unlike `W_CheckNumForName` used by the PNAMES patchlookup which yields -1). A registered-only demo requested while running on shareware would be a fatal error. The runtime models this with `isDemoLumpName` testing for the uppercase `DEMO` prefix.',
  },
  {
    id: 'demo-lump-header-bytes-thirteen',
    subject: 'G_BeginRecording',
    cSourceLines: [
      '*demo_p++ = VERSION;',
      '*demo_p++ = gameskill;',
      '*demo_p++ = gameepisode;',
      '*demo_p++ = gamemap;',
      '*demo_p++ = deathmatch;',
      '*demo_p++ = respawnparm;',
      '*demo_p++ = fastparm;',
      '*demo_p++ = nomonsters;',
      '*demo_p++ = consoleplayer;',
      'for (i=0 ; i<MAXPLAYERS ; i++)',
      '\t*demo_p++ = playeringame[i];',
    ],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'Vanilla `G_BeginRecording` writes exactly 9 single-byte fields followed by `MAXPLAYERS` (= 4) playeringame bytes via sequential `*demo_p++ = <byte>` writes. The total on-disk demo header is therefore 9 + 4 = 13 bytes. `G_DoPlayDemo` consumes the same 13 bytes via the inverse `*demo_p++` reads. The runtime models this with `DEMO_HEADER_BYTES === 13` exposed by `parse-demo-lumps.ts`.',
  },
  {
    id: 'demo-lump-version-field-offset-zero-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = VERSION;', 'if ( *demo_p++ != VERSION)'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The `VERSION` byte is the FIRST field written by `G_BeginRecording` and the FIRST field read by `G_DoPlayDemo`, placing it at lump byte offset 0 with a 1-byte unsigned width. The runtime models this with `DEMO_VERSION_FIELD_OFFSET === 0` and `DEMO_VERSION_FIELD_BYTES === 1` exposed by `parse-demo-lumps.ts`.',
  },
  {
    id: 'demo-lump-version-vanilla-109',
    subject: 'G_BeginRecording',
    cSourceLines: ['case exe_doom_1_9:', 'default:', '    return 109;'],
    referenceSourceFile: 'src/doom/g_game.c',
    invariant:
      'The Chocolate Doom 2.2.1 `G_VanillaVersionCode` switch returns the numeric version byte for vanilla DOOM 1.9 (`exe_doom_1_9`) as `109` decimal (= 0x6D). `G_DoPlayDemo` rejects any demo whose first byte does not equal `G_VanillaVersionCode()` (or `DOOM_191_VERSION` for the longtics extension). The runtime models this with `DEMO_VERSION_VANILLA_DOOM_1_9 === 109` exposed by `parse-demo-lumps.ts`, matching the live shareware `DOOM1.WAD` DEMO1/DEMO2/DEMO3 first byte.',
  },
  {
    id: 'demo-lump-skill-field-offset-one-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = gameskill;', 'skill = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The `gameskill` byte is the SECOND field written by `G_BeginRecording` and read by `G_DoPlayDemo`, placing it at lump byte offset 1 with a 1-byte unsigned width. Vanilla DOOM skill levels span 0..4 (`sk_baby` through `sk_nightmare`). The runtime models this with `DEMO_SKILL_FIELD_OFFSET === 1` and `DEMO_SKILL_FIELD_BYTES === 1`.',
  },
  {
    id: 'demo-lump-episode-field-offset-two-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = gameepisode;', 'episode = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The `gameepisode` byte is the THIRD field, placing it at lump byte offset 2 with a 1-byte unsigned width. Shareware DOOM uses episode 1 only. The runtime models this with `DEMO_EPISODE_FIELD_OFFSET === 2` and `DEMO_EPISODE_FIELD_BYTES === 1`.',
  },
  {
    id: 'demo-lump-map-field-offset-three-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = gamemap;', 'map = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The `gamemap` byte is the FOURTH field, placing it at lump byte offset 3 with a 1-byte unsigned width. Shareware DOOM episode 1 maps span 1..9. The runtime models this with `DEMO_MAP_FIELD_OFFSET === 3` and `DEMO_MAP_FIELD_BYTES === 1`.',
  },
  {
    id: 'demo-lump-deathmatch-field-offset-four-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = deathmatch;', 'deathmatch = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The `deathmatch` byte is the FIFTH field, placing it at lump byte offset 4 with a 1-byte unsigned width. The byte is `0` for cooperative demos (the only mode used by shareware DEMO1/DEMO2/DEMO3) and non-zero for deathmatch. The runtime models this with `DEMO_DEATHMATCH_FIELD_OFFSET === 4` and `DEMO_DEATHMATCH_FIELD_BYTES === 1`.',
  },
  {
    id: 'demo-lump-respawnparm-field-offset-five-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = respawnparm;', 'respawnparm = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant: 'The `respawnparm` byte is the SIXTH field, placing it at lump byte offset 5 with a 1-byte unsigned width. The runtime models this with `DEMO_RESPAWNPARM_FIELD_OFFSET === 5` and `DEMO_RESPAWNPARM_FIELD_BYTES === 1`.',
  },
  {
    id: 'demo-lump-fastparm-field-offset-six-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = fastparm;', 'fastparm = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant: 'The `fastparm` byte is the SEVENTH field, placing it at lump byte offset 6 with a 1-byte unsigned width. The runtime models this with `DEMO_FASTPARM_FIELD_OFFSET === 6` and `DEMO_FASTPARM_FIELD_BYTES === 1`.',
  },
  {
    id: 'demo-lump-nomonsters-field-offset-seven-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = nomonsters;', 'nomonsters = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant: 'The `nomonsters` byte is the EIGHTH field, placing it at lump byte offset 7 with a 1-byte unsigned width. The runtime models this with `DEMO_NOMONSTERS_FIELD_OFFSET === 7` and `DEMO_NOMONSTERS_FIELD_BYTES === 1`.',
  },
  {
    id: 'demo-lump-consoleplayer-field-offset-eight-uint8',
    subject: 'DEMO-lump',
    cSourceLines: ['*demo_p++ = consoleplayer;', 'consoleplayer = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The `consoleplayer` byte is the NINTH single-byte field, placing it at lump byte offset 8 with a 1-byte unsigned width. The byte names which player slot recorded the demo and is the LAST scalar field before the `playeringame[MAXPLAYERS]` loop. The runtime models this with `DEMO_CONSOLEPLAYER_FIELD_OFFSET === 8` and `DEMO_CONSOLEPLAYER_FIELD_BYTES === 1`.',
  },
  {
    id: 'demo-lump-playeringame-field-offset-nine-four-uint8s',
    subject: 'DEMO-lump',
    cSourceLines: ['#define MAXPLAYERS\t\t4', 'for (i=0 ; i<MAXPLAYERS ; i++)', '\t*demo_p++ = playeringame[i];', 'for (i=0 ; i<MAXPLAYERS ; i++)', '\tplayeringame[i] = *demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The `playeringame[MAXPLAYERS]` field is a 4-byte (one byte per player slot, `MAXPLAYERS === 4`) array starting at lump byte offset 9 and running through offset 12 inclusive. Each byte is a `boolean` (0 or non-zero). The active-player count is the popcount of non-zero bytes, and a `true` value at index 1 also flips `netgame` and `netdemo` to true in `G_DoPlayDemo`. The runtime models this with `DEMO_PLAYERINGAME_FIELD_OFFSET === 9`, `DEMO_PLAYERINGAME_FIELD_BYTES === 4`, and `DEMO_MAX_PLAYERS === 4`.',
  },
  {
    id: 'demo-lump-ticcmd-bytes-four-per-active-player',
    subject: 'G_ReadDemoTiccmd',
    cSourceLines: ['cmd->forwardmove = ((signed char)*demo_p++);', 'cmd->sidemove = ((signed char)*demo_p++);', 'cmd->angleturn = ((unsigned char)*demo_p++)<<8;', 'cmd->buttons = (unsigned char)*demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'Vanilla `G_ReadDemoTiccmd` consumes exactly 4 bytes per call: `forwardmove` (`signed char`), `sidemove` (`signed char`), `angleturn` (`unsigned char`, used as the high byte of the 16-bit angle delta), and `buttons` (`unsigned char`). The function is called once per active player per tic, so the per-tic body width is `4 * activePlayers` bytes. The runtime models this with `DEMO_TICCMD_BYTES === 4` exposed by `parse-demo-lumps.ts`.',
  },
  {
    id: 'demo-lump-ticcmd-forwardmove-signed-int8',
    subject: 'G_ReadDemoTiccmd',
    cSourceLines: ['cmd->forwardmove = ((signed char)*demo_p++);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant: 'The first ticcmd byte is `forwardmove`, cast to `signed char` (range -128..127). The runtime models this with `DEMO_TICCMD_FORWARDMOVE_OFFSET === 0` and `parseDemoLumpTiccmd` reading it via `Buffer.readInt8`.',
  },
  {
    id: 'demo-lump-ticcmd-sidemove-signed-int8',
    subject: 'G_ReadDemoTiccmd',
    cSourceLines: ['cmd->sidemove = ((signed char)*demo_p++);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant: 'The second ticcmd byte is `sidemove`, cast to `signed char` (range -128..127). The runtime models this with `DEMO_TICCMD_SIDEMOVE_OFFSET === 1` and `parseDemoLumpTiccmd` reading it via `Buffer.readInt8`.',
  },
  {
    id: 'demo-lump-ticcmd-angleturn-uint8-shifted-left-eight',
    subject: 'G_ReadDemoTiccmd',
    cSourceLines: ['cmd->angleturn = ((unsigned char)*demo_p++)<<8;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The third ticcmd byte is `angleturn`, read as `unsigned char` and left-shifted 8 bits to form the high byte of the 16-bit angle delta (low byte is implicitly zero in the non-longtics demo format). The on-disk byte itself ranges 0..255. The runtime models this with `DEMO_TICCMD_ANGLETURN_OFFSET === 2` and `parseDemoLumpTiccmd` reading it via `Buffer.readUint8`.',
  },
  {
    id: 'demo-lump-ticcmd-buttons-uint8',
    subject: 'G_ReadDemoTiccmd',
    cSourceLines: ['cmd->buttons = (unsigned char)*demo_p++;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'The fourth ticcmd byte is `buttons`, read as `unsigned char`. It encodes the BT_ATTACK / BT_USE / BT_CHANGE / weapon-select bitfield. The runtime models this with `DEMO_TICCMD_BUTTONS_OFFSET === 3` and `parseDemoLumpTiccmd` reading it via `Buffer.readUint8`.',
  },
  {
    id: 'demo-lump-end-marker-0x80',
    subject: 'G_ReadDemoTiccmd',
    cSourceLines: ['#define DEMOMARKER\t\t0x80', 'if (*demo_p == DEMOMARKER)', '\tG_CheckDemoStatus ();', '\treturn;'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'Vanilla `G_ReadDemoTiccmd` checks the next byte against `DEMOMARKER == 0x80` BEFORE consuming any ticcmd bytes; a match short-circuits to `G_CheckDemoStatus()` and ends playback. `G_CheckDemoStatus` records the marker via `*demo_p++ = DEMOMARKER` when finalising a demo. The on-disk demo therefore terminates with exactly one `0x80` byte after the final tic body. The runtime models this with `DEMO_END_MARKER === 0x80` exposed by `parse-demo-lumps.ts`.',
  },
  {
    id: 'demo-lump-tic-rate-thirty-five-hz',
    subject: 'parseDemoLumpHeader',
    cSourceLines: ['#define TICRATE\t\t35'],
    referenceSourceFile: 'linuxdoom-1.10/doomdef.h',
    invariant:
      'The vanilla DOOM `TICRATE` is 35 Hz: every tic in a demo represents 1/35 of a second of game time. The shareware DEMO1 ticCount of 5026 therefore equals 143.6 seconds of recorded gameplay (5026 / 35). The runtime models this with `DEMO_TIC_RATE_HZ === 35` exposed by `parse-demo-lumps.ts` and `PRIMARY_TARGET.ticRateHz === 35`.',
  },
  {
    id: 'demo-lump-no-marker-range',
    subject: 'DEMO-lump',
    cSourceLines: ['demobuffer = demo_p = W_CacheLumpName (defdemoname, PU_STATIC);'],
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
    invariant:
      'Demo lumps in vanilla DOOM 1.9 are NOT enclosed by an `S_START` / `S_END`, `F_START` / `F_END`, or `P_START` / `P_END` style marker range. Each DEMO lump is looked up by its full name via `W_CacheLumpName` directly. The DEMO lumps therefore live at fixed positions in the WAD directory anywhere between the IWAD identifier and the EOF; in shareware DOOM1.WAD they sit at directory indices 3..5 contiguously, but the contiguity is a layout convention of the IWAD, not a parser-enforced invariant. The runtime models this with `isDemoLumpName` testing only for the uppercase `DEMO` prefix.',
  },
  {
    id: 'demo-lump-shareware-doom1-three-demos',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['G_DeferedPlayDemo ("demo1");', 'G_DeferedPlayDemo ("demo2");', 'G_DeferedPlayDemo ("demo3");'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The shareware `doom/DOOM1.WAD` ships exactly 3 demo lumps with the `DEMO` prefix (`DEMO1`, `DEMO2`, `DEMO3`). The first demo lump in directory order is `DEMO1` at index 3, the last is `DEMO3` at index 5. The 3 count matches the `lumpCategories.demo: 3` field in `reference/manifests/wad-map-summary.json`. The runtime models this with the oracle entry whose `demoLumpCount === 3`, `firstDemoLumpIndex === 3`, and `lastDemoLumpIndex === 5`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface DemoLumpDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const DEMO_LUMP_DERIVED_INVARIANTS: readonly DemoLumpDerivedInvariant[] = [
  {
    id: 'DEMO_LUMP_NAME_PREFIX_EQUALS_DEMO',
    description: '`DEMO_LUMP_NAME_PREFIX === "DEMO"`. Matches the upstream `G_DeferedPlayDemo("demoN")` lowercase base name after `W_CheckNumForName` uppercases the directory key.',
  },
  {
    id: 'DEMO_LUMP_NAME_PREFIX_LENGTH_EQUALS_FOUR',
    description: '`DEMO_LUMP_NAME_PREFIX_LENGTH === 4`. Matches the 4-byte `DEMO` prefix consumed by the upstream `"demoN"` literal.',
  },
  {
    id: 'DEMO_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT',
    description: '`DEMO_LUMP_NAME_FIELD_BYTES === 8`. Matches the 8-byte WAD directory name field; the `DEMO` prefix plus a 4-character base index fills the field with room to spare.',
  },
  {
    id: 'DEMO_HEADER_BYTES_EQUALS_THIRTEEN',
    description: '`DEMO_HEADER_BYTES === 13`. Matches the upstream `G_BeginRecording` write sequence: 9 single-byte fields plus the 4-byte `playeringame[MAXPLAYERS]` array.',
  },
  {
    id: 'DEMO_VERSION_FIELD_OFFSET_EQUALS_ZERO',
    description: '`DEMO_VERSION_FIELD_OFFSET === 0`. Matches the upstream first `*demo_p++ = VERSION;` write at the start of `G_BeginRecording`.',
  },
  {
    id: 'DEMO_VERSION_FIELD_BYTES_EQUALS_ONE',
    description: '`DEMO_VERSION_FIELD_BYTES === 1`. Matches the upstream byte-per-write encoding of the version field.',
  },
  {
    id: 'DEMO_VERSION_VANILLA_DOOM_1_9_EQUALS_ONE_OH_NINE',
    description: '`DEMO_VERSION_VANILLA_DOOM_1_9 === 109`. Matches the Chocolate Doom 2.2.1 `G_VanillaVersionCode` switch case `exe_doom_1_9: return 109;`.',
  },
  {
    id: 'DEMO_SKILL_FIELD_OFFSET_EQUALS_ONE',
    description: '`DEMO_SKILL_FIELD_OFFSET === 1`. Matches the upstream second `*demo_p++ = gameskill;` write.',
  },
  {
    id: 'DEMO_EPISODE_FIELD_OFFSET_EQUALS_TWO',
    description: '`DEMO_EPISODE_FIELD_OFFSET === 2`. Matches the upstream third `*demo_p++ = gameepisode;` write.',
  },
  {
    id: 'DEMO_MAP_FIELD_OFFSET_EQUALS_THREE',
    description: '`DEMO_MAP_FIELD_OFFSET === 3`. Matches the upstream fourth `*demo_p++ = gamemap;` write.',
  },
  {
    id: 'DEMO_DEATHMATCH_FIELD_OFFSET_EQUALS_FOUR',
    description: '`DEMO_DEATHMATCH_FIELD_OFFSET === 4`. Matches the upstream fifth `*demo_p++ = deathmatch;` write.',
  },
  {
    id: 'DEMO_RESPAWNPARM_FIELD_OFFSET_EQUALS_FIVE',
    description: '`DEMO_RESPAWNPARM_FIELD_OFFSET === 5`. Matches the upstream sixth `*demo_p++ = respawnparm;` write.',
  },
  {
    id: 'DEMO_FASTPARM_FIELD_OFFSET_EQUALS_SIX',
    description: '`DEMO_FASTPARM_FIELD_OFFSET === 6`. Matches the upstream seventh `*demo_p++ = fastparm;` write.',
  },
  {
    id: 'DEMO_NOMONSTERS_FIELD_OFFSET_EQUALS_SEVEN',
    description: '`DEMO_NOMONSTERS_FIELD_OFFSET === 7`. Matches the upstream eighth `*demo_p++ = nomonsters;` write.',
  },
  {
    id: 'DEMO_CONSOLEPLAYER_FIELD_OFFSET_EQUALS_EIGHT',
    description: '`DEMO_CONSOLEPLAYER_FIELD_OFFSET === 8`. Matches the upstream ninth `*demo_p++ = consoleplayer;` write.',
  },
  {
    id: 'DEMO_PLAYERINGAME_FIELD_OFFSET_EQUALS_NINE',
    description: '`DEMO_PLAYERINGAME_FIELD_OFFSET === 9`. Matches the upstream `for (i=0 ; i<MAXPLAYERS ; i++) *demo_p++ = playeringame[i];` loop, which begins immediately after the consoleplayer byte.',
  },
  {
    id: 'DEMO_PLAYERINGAME_FIELD_BYTES_EQUALS_FOUR',
    description: '`DEMO_PLAYERINGAME_FIELD_BYTES === 4`. Matches `MAXPLAYERS == 4` repetitions of the 1-byte `playeringame[i]` field.',
  },
  {
    id: 'DEMO_MAX_PLAYERS_EQUALS_FOUR',
    description: '`DEMO_MAX_PLAYERS === 4`. Matches the upstream `#define MAXPLAYERS 4` from `linuxdoom-1.10/doomdef.h`.',
  },
  {
    id: 'DEMO_TICCMD_BYTES_EQUALS_FOUR',
    description: '`DEMO_TICCMD_BYTES === 4`. Matches the upstream `G_ReadDemoTiccmd` four-byte read of forwardmove, sidemove, angleturn, and buttons.',
  },
  {
    id: 'DEMO_TICCMD_FORWARDMOVE_OFFSET_EQUALS_ZERO',
    description: '`DEMO_TICCMD_FORWARDMOVE_OFFSET === 0`. Matches the upstream first `cmd->forwardmove = ((signed char)*demo_p++);` ticcmd read.',
  },
  {
    id: 'DEMO_TICCMD_SIDEMOVE_OFFSET_EQUALS_ONE',
    description: '`DEMO_TICCMD_SIDEMOVE_OFFSET === 1`. Matches the upstream second `cmd->sidemove = ((signed char)*demo_p++);` ticcmd read.',
  },
  {
    id: 'DEMO_TICCMD_ANGLETURN_OFFSET_EQUALS_TWO',
    description: '`DEMO_TICCMD_ANGLETURN_OFFSET === 2`. Matches the upstream third `cmd->angleturn = ((unsigned char)*demo_p++)<<8;` ticcmd read.',
  },
  {
    id: 'DEMO_TICCMD_BUTTONS_OFFSET_EQUALS_THREE',
    description: '`DEMO_TICCMD_BUTTONS_OFFSET === 3`. Matches the upstream fourth `cmd->buttons = (unsigned char)*demo_p++;` ticcmd read.',
  },
  {
    id: 'DEMO_END_MARKER_EQUALS_0X80',
    description: '`DEMO_END_MARKER === 0x80`. Matches the upstream `#define DEMOMARKER 0x80` and the `if (*demo_p == DEMOMARKER) G_CheckDemoStatus()` short-circuit at the start of `G_ReadDemoTiccmd`.',
  },
  {
    id: 'DEMO_TIC_RATE_HZ_EQUALS_THIRTY_FIVE',
    description: '`DEMO_TIC_RATE_HZ === 35`. Matches the upstream `#define TICRATE 35` and the `PRIMARY_TARGET.ticRateHz` runtime constant.',
  },
  {
    id: 'PARSE_DEMO_LUMP_HEADER_RETURNS_FROZEN_HEADER',
    description: 'A successful `parseDemoLumpHeader(buffer)` returns an object that is `Object.isFrozen` and whose `playersPresent` array is `Object.isFrozen`.',
  },
  {
    id: 'PARSE_DEMO_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
    description: '`parseDemoLumpHeader(new Uint8Array(12))` throws a `RangeError`. The 13-byte on-disk header is mandatory before any tic data is read.',
  },
  {
    id: 'PARSE_DEMO_LUMP_HEADER_REJECTS_UNSUPPORTED_VERSION',
    description: '`parseDemoLumpHeader(bufferWithVersionByteNot109)` throws a `RangeError`. The vanilla version-byte gate must reject any first byte other than `109`.',
  },
  {
    id: 'PARSE_DEMO_LUMP_HEADER_REJECTS_ZERO_ACTIVE_PLAYERS',
    description: '`parseDemoLumpHeader(bufferWithAllPlayeringameZero)` throws a `RangeError`. A demo with zero active players cannot encode a 4-byte ticcmd stream.',
  },
  {
    id: 'IS_DEMO_LUMP_NAME_REQUIRES_DEMO_PREFIX',
    description:
      '`isDemoLumpName(name)` returns true iff `name.length > DEMO_LUMP_NAME_PREFIX_LENGTH` and `name.slice(0, DEMO_LUMP_NAME_PREFIX_LENGTH).toUpperCase() === DEMO_LUMP_NAME_PREFIX`. Matches the upstream uppercase `DEMO` lookup convention.',
  },
  {
    id: 'IS_DEMO_LUMP_NAME_REJECTS_DEMOCRATIC_SOUNDING_NON_DEMO_LUMPS',
    description:
      '`isDemoLumpName("DEMOCROC") === true` because the `DEMO` prefix matches; but `isDemoLumpName("DEMO") === false` because the bare prefix has no demo index suffix, mirroring the upstream `defdemoname` requirement of a non-empty index.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Lump-name prefix that identifies demo lumps in the WAD directory (`DEMO<index>`). */
export const DEMO_LUMP_NAME_PREFIX = 'DEMO';

/** Byte length of the upstream lump-name prefix `DEMO` (matches the literal `"demoN"` base names passed to `G_DeferedPlayDemo`). */
export const DEMO_LUMP_NAME_PREFIX_LENGTH = 4;

/** Byte length of the 8-byte WAD directory name field that holds the `DEMO<index>` lump name. */
export const DEMO_LUMP_NAME_FIELD_BYTES = 8;

/** Byte size of the on-disk demo header (9 single-byte fields plus the 4-byte `playeringame[MAXPLAYERS]` array). */
export const DEMO_HEADER_BYTES = 13;

/** Byte offset of the `version` field inside the on-disk demo header. */
export const DEMO_VERSION_FIELD_OFFSET = 0;

/** Byte width of the `version` field (uint8). */
export const DEMO_VERSION_FIELD_BYTES = 1;

/** Required `version` byte for vanilla DOOM 1.9 demos (matches `G_VanillaVersionCode()` return value for `exe_doom_1_9`). */
export const DEMO_VERSION_VANILLA_DOOM_1_9 = 109;

/** Byte offset of the `skill` field inside the on-disk demo header. */
export const DEMO_SKILL_FIELD_OFFSET = 1;

/** Byte width of the `skill` field (uint8). */
export const DEMO_SKILL_FIELD_BYTES = 1;

/** Byte offset of the `episode` field inside the on-disk demo header. */
export const DEMO_EPISODE_FIELD_OFFSET = 2;

/** Byte width of the `episode` field (uint8). */
export const DEMO_EPISODE_FIELD_BYTES = 1;

/** Byte offset of the `map` field inside the on-disk demo header. */
export const DEMO_MAP_FIELD_OFFSET = 3;

/** Byte width of the `map` field (uint8). */
export const DEMO_MAP_FIELD_BYTES = 1;

/** Byte offset of the `deathmatch` field inside the on-disk demo header. */
export const DEMO_DEATHMATCH_FIELD_OFFSET = 4;

/** Byte width of the `deathmatch` field (uint8). */
export const DEMO_DEATHMATCH_FIELD_BYTES = 1;

/** Byte offset of the `respawnparm` field inside the on-disk demo header. */
export const DEMO_RESPAWNPARM_FIELD_OFFSET = 5;

/** Byte width of the `respawnparm` field (uint8). */
export const DEMO_RESPAWNPARM_FIELD_BYTES = 1;

/** Byte offset of the `fastparm` field inside the on-disk demo header. */
export const DEMO_FASTPARM_FIELD_OFFSET = 6;

/** Byte width of the `fastparm` field (uint8). */
export const DEMO_FASTPARM_FIELD_BYTES = 1;

/** Byte offset of the `nomonsters` field inside the on-disk demo header. */
export const DEMO_NOMONSTERS_FIELD_OFFSET = 7;

/** Byte width of the `nomonsters` field (uint8). */
export const DEMO_NOMONSTERS_FIELD_BYTES = 1;

/** Byte offset of the `consoleplayer` field inside the on-disk demo header. */
export const DEMO_CONSOLEPLAYER_FIELD_OFFSET = 8;

/** Byte width of the `consoleplayer` field (uint8). */
export const DEMO_CONSOLEPLAYER_FIELD_BYTES = 1;

/** Byte offset of the `playeringame[MAXPLAYERS]` field inside the on-disk demo header. */
export const DEMO_PLAYERINGAME_FIELD_OFFSET = 9;

/** Byte width of the `playeringame[MAXPLAYERS]` field (one uint8 per player slot). */
export const DEMO_PLAYERINGAME_FIELD_BYTES = 4;

/** Maximum number of players in a vanilla DOOM game (matches `#define MAXPLAYERS 4` in `linuxdoom-1.10/doomdef.h`). */
export const DEMO_MAX_PLAYERS = 4;

/** Byte width of one ticcmd record (forwardmove + sidemove + angleturn + buttons). */
export const DEMO_TICCMD_BYTES = 4;

/** Byte offset of the `forwardmove` field inside one ticcmd record. */
export const DEMO_TICCMD_FORWARDMOVE_OFFSET = 0;

/** Byte offset of the `sidemove` field inside one ticcmd record. */
export const DEMO_TICCMD_SIDEMOVE_OFFSET = 1;

/** Byte offset of the `angleturn` field inside one ticcmd record. */
export const DEMO_TICCMD_ANGLETURN_OFFSET = 2;

/** Byte offset of the `buttons` field inside one ticcmd record. */
export const DEMO_TICCMD_BUTTONS_OFFSET = 3;

/** Byte value of the `DEMOMARKER` end-of-demo sentinel that terminates the tic stream. */
export const DEMO_END_MARKER = 0x80;

/** Vanilla DOOM `TICRATE` (matches `#define TICRATE 35` in `linuxdoom-1.10/doomdef.h` and `PRIMARY_TARGET.ticRateHz`). */
export const DEMO_TIC_RATE_HZ = 35;

/** Decoded fields from the 13-byte on-disk demo header plus tic stream geometry derived from the lump body. */
export interface DemoLumpHeader {
  /** `version` byte (109 for vanilla DOOM 1.9). */
  readonly version: number;
  /** `skill` byte (0..4). */
  readonly skill: number;
  /** `episode` byte (1-based). */
  readonly episode: number;
  /** `map` byte (1-based within the episode). */
  readonly map: number;
  /** `deathmatch` byte (0 = cooperative, non-zero = deathmatch). */
  readonly deathmatch: number;
  /** `respawnparm` byte. */
  readonly respawnparm: number;
  /** `fastparm` byte. */
  readonly fastparm: number;
  /** `nomonsters` byte. */
  readonly nomonsters: number;
  /** `consoleplayer` byte (0..3). */
  readonly consoleplayer: number;
  /** Frozen 4-element booleans, one per player slot. */
  readonly playersPresent: readonly boolean[];
  /** Number of `true` entries in `playersPresent`. */
  readonly activePlayers: number;
  /** Tic count derived from `(lump.length - DEMO_HEADER_BYTES - 1) / (DEMO_TICCMD_BYTES * activePlayers)`. */
  readonly ticCount: number;
  /** Duration in seconds (`ticCount / DEMO_TIC_RATE_HZ`). */
  readonly durationSeconds: number;
}

/**
 * Parse the 13-byte on-disk demo header and derive the tic-stream
 * geometry of a demo lump.
 *
 * Mirrors the vanilla `G_DoPlayDemo` validation gate from
 * `linuxdoom-1.10/g_game.c` (with the Chocolate Doom 2.2.1
 * `G_VanillaVersionCode()` value for vanilla DOOM 1.9):
 *   - rejects any lump whose total byte length is less than 13
 *     (the on-disk header before the tic stream),
 *   - rejects any lump whose first byte does not equal the vanilla
 *     DOOM 1.9 version code 109 (matching the
 *     `*demo_p++ != VERSION` gate at the start of `G_DoPlayDemo`),
 *   - reads `skill`, `episode`, `map`, `deathmatch`, `respawnparm`,
 *     `fastparm`, `nomonsters`, and `consoleplayer` as uint8 at
 *     offsets 1, 2, 3, 4, 5, 6, 7, 8,
 *   - reads `playeringame[0..3]` as four uint8 entries at offsets
 *     9..12,
 *   - rejects any lump whose `playeringame` array is all zero (the
 *     tic body is sized as `DEMO_TICCMD_BYTES * activePlayers` and
 *     a zero-active-player demo cannot encode any ticcmd).
 *
 * The parser does NOT decode the tic command stream — that is the
 * responsibility of the higher-level demo replay engine in
 * `src/demo/`. It only pins the byte-level header layout, the
 * vanilla version-byte gate, and the on-disk activePlayers /
 * ticCount geometry.
 *
 * @param lumpData - Raw demo lump data.
 * @returns Frozen {@link DemoLumpHeader}.
 * @throws {RangeError} If the lump is too small for the 13-byte
 *   header, has a version byte that does not match
 *   `DEMO_VERSION_VANILLA_DOOM_1_9`, or has zero active players.
 */
export function parseDemoLumpHeader(lumpData: Buffer | Uint8Array): DemoLumpHeader {
  if (lumpData.length < DEMO_HEADER_BYTES) {
    throw new RangeError(`parseDemoLumpHeader: lump must be at least ${DEMO_HEADER_BYTES} bytes for the on-disk demo header, got ${lumpData.length}`);
  }

  const buffer = lumpData instanceof Buffer ? lumpData : Buffer.from(lumpData.buffer, lumpData.byteOffset, lumpData.byteLength);
  const reader = new BinaryReader(buffer, DEMO_VERSION_FIELD_OFFSET);

  const version = reader.readUint8();
  if (version !== DEMO_VERSION_VANILLA_DOOM_1_9) {
    throw new RangeError(`parseDemoLumpHeader: version byte ${version} is not the vanilla DOOM 1.9 code ${DEMO_VERSION_VANILLA_DOOM_1_9}`);
  }

  const skill = reader.readUint8();
  const episode = reader.readUint8();
  const map = reader.readUint8();
  const deathmatch = reader.readUint8();
  const respawnparm = reader.readUint8();
  const fastparm = reader.readUint8();
  const nomonsters = reader.readUint8();
  const consoleplayer = reader.readUint8();

  const playersPresent: boolean[] = new Array(DEMO_MAX_PLAYERS);
  let activePlayers = 0;
  for (let index = 0; index < DEMO_MAX_PLAYERS; index += 1) {
    const present = reader.readUint8() !== 0;
    playersPresent[index] = present;
    if (present) {
      activePlayers += 1;
    }
  }

  if (activePlayers === 0) {
    throw new RangeError('parseDemoLumpHeader: demo has zero active players (playeringame[0..3] are all zero)');
  }

  const bodyBytes = lumpData.length - DEMO_HEADER_BYTES;
  const trailerBytes = bodyBytes > 0 && lumpData[lumpData.length - 1] === DEMO_END_MARKER ? 1 : 0;
  const ticBytesAvailable = Math.max(bodyBytes - trailerBytes, 0);
  const bytesPerTic = DEMO_TICCMD_BYTES * activePlayers;
  const ticCount = bytesPerTic > 0 ? Math.floor(ticBytesAvailable / bytesPerTic) : 0;
  const durationSeconds = ticCount / DEMO_TIC_RATE_HZ;

  return Object.freeze({
    version,
    skill,
    episode,
    map,
    deathmatch,
    respawnparm,
    fastparm,
    nomonsters,
    consoleplayer,
    playersPresent: Object.freeze(playersPresent),
    activePlayers,
    ticCount,
    durationSeconds,
  });
}

/** Decoded ticcmd fields from a single 4-byte ticcmd record. */
export interface DemoLumpTiccmd {
  /** `forwardmove` byte (signed int8, range -128..127). */
  readonly forwardmove: number;
  /** `sidemove` byte (signed int8, range -128..127). */
  readonly sidemove: number;
  /** `angleturn` byte (unsigned uint8, used as the high byte of the 16-bit angle delta). */
  readonly angleturn: number;
  /** `buttons` byte (unsigned uint8 bitfield). */
  readonly buttons: number;
}

/**
 * Decode a single 4-byte ticcmd record from a demo lump tic body.
 *
 * Mirrors `G_ReadDemoTiccmd` for the non-longtics demo format:
 *  - byte 0: `forwardmove` as signed int8,
 *  - byte 1: `sidemove` as signed int8,
 *  - byte 2: `angleturn` as unsigned uint8 (caller shifts left 8 to
 *    reconstruct the 16-bit angle delta),
 *  - byte 3: `buttons` as unsigned uint8.
 *
 * @param buffer - Buffer holding the ticcmd bytes.
 * @param offset - Byte offset to the start of the 4-byte record.
 * @returns Frozen {@link DemoLumpTiccmd}.
 * @throws {RangeError} If `offset + DEMO_TICCMD_BYTES` exceeds the
 *   buffer length.
 */
export function parseDemoLumpTiccmd(buffer: Buffer | Uint8Array, offset: number): DemoLumpTiccmd {
  if (offset < 0 || offset + DEMO_TICCMD_BYTES > buffer.length) {
    throw new RangeError(`parseDemoLumpTiccmd: ticcmd record [${offset}, ${offset + DEMO_TICCMD_BYTES}) is out of bounds for buffer length ${buffer.length}`);
  }
  const view = buffer instanceof Buffer ? buffer : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const forwardmove = view.readInt8(offset + DEMO_TICCMD_FORWARDMOVE_OFFSET);
  const sidemove = view.readInt8(offset + DEMO_TICCMD_SIDEMOVE_OFFSET);
  const angleturn = view.readUInt8(offset + DEMO_TICCMD_ANGLETURN_OFFSET);
  const buttons = view.readUInt8(offset + DEMO_TICCMD_BUTTONS_OFFSET);
  return Object.freeze({ forwardmove, sidemove, angleturn, buttons });
}

/**
 * Predicate identifying demo lumps by name.
 *
 * Matches vanilla DOOM 1.9's `DEMO` prefix convention (case-insensitive
 * via `W_CheckNumForName` uppercase folding). Requires at least one
 * character after the `DEMO` prefix to satisfy the `defdemoname` index
 * convention used by `G_DeferedPlayDemo("demo1")` and friends.
 *
 * @param name - Lump name to test.
 */
export function isDemoLumpName(name: string): boolean {
  return name.length > DEMO_LUMP_NAME_PREFIX_LENGTH && name.slice(0, DEMO_LUMP_NAME_PREFIX_LENGTH).toUpperCase() === DEMO_LUMP_NAME_PREFIX;
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-demo-lumps.ts`. The cross-check helper consumes
 * this shape so the focused test can both verify the live runtime
 * exports and exercise a deliberately tampered snapshot to prove the
 * failure modes are observable.
 */
export interface DemoLumpRuntimeSnapshot {
  readonly demoLumpNamePrefix: string;
  readonly demoLumpNamePrefixLength: number;
  readonly demoLumpNameFieldBytes: number;
  readonly demoHeaderBytes: number;
  readonly demoVersionFieldOffset: number;
  readonly demoVersionFieldBytes: number;
  readonly demoVersionVanillaDoom19: number;
  readonly demoSkillFieldOffset: number;
  readonly demoEpisodeFieldOffset: number;
  readonly demoMapFieldOffset: number;
  readonly demoDeathmatchFieldOffset: number;
  readonly demoRespawnparmFieldOffset: number;
  readonly demoFastparmFieldOffset: number;
  readonly demoNomonstersFieldOffset: number;
  readonly demoConsoleplayerFieldOffset: number;
  readonly demoPlayeringameFieldOffset: number;
  readonly demoPlayeringameFieldBytes: number;
  readonly demoMaxPlayers: number;
  readonly demoTiccmdBytes: number;
  readonly demoTiccmdForwardmoveOffset: number;
  readonly demoTiccmdSidemoveOffset: number;
  readonly demoTiccmdAngleturnOffset: number;
  readonly demoTiccmdButtonsOffset: number;
  readonly demoEndMarker: number;
  readonly demoTicRateHz: number;
  readonly parserReturnsFrozenHeader: boolean;
  readonly parserRejectsBufferTooSmallForHeader: boolean;
  readonly parserRejectsUnsupportedVersion: boolean;
  readonly parserRejectsZeroActivePlayers: boolean;
  readonly isDemoLumpNameAcceptsDemoPrefix: boolean;
  readonly isDemoLumpNameRejectsBareDemoToken: boolean;
}

/**
 * Cross-check a `DemoLumpRuntimeSnapshot` against `DEMO_LUMP_AUDIT`
 * and `DEMO_LUMP_DERIVED_INVARIANTS`. Returns the list of failures by
 * stable identifier; an empty list means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckDemoLumpRuntime(snapshot: DemoLumpRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.demoLumpNamePrefix !== 'DEMO') {
    failures.push('derived:DEMO_LUMP_NAME_PREFIX_EQUALS_DEMO');
    failures.push('audit:demo-lump-name-prefix-demo:not-observed');
  }
  if (snapshot.demoLumpNamePrefixLength !== 4) {
    failures.push('derived:DEMO_LUMP_NAME_PREFIX_LENGTH_EQUALS_FOUR');
    failures.push('audit:demo-lump-name-defdemoname-demo-n:not-observed');
  }
  if (snapshot.demoLumpNameFieldBytes !== 8) {
    failures.push('derived:DEMO_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT');
    failures.push('audit:demo-lump-name-defdemoname-demo-n:not-observed');
  }
  if (snapshot.demoHeaderBytes !== 13) {
    failures.push('derived:DEMO_HEADER_BYTES_EQUALS_THIRTEEN');
    failures.push('audit:demo-lump-header-bytes-thirteen:not-observed');
  }
  if (snapshot.demoVersionFieldOffset !== 0) {
    failures.push('derived:DEMO_VERSION_FIELD_OFFSET_EQUALS_ZERO');
    failures.push('audit:demo-lump-version-field-offset-zero-uint8:not-observed');
  }
  if (snapshot.demoVersionFieldBytes !== 1) {
    failures.push('derived:DEMO_VERSION_FIELD_BYTES_EQUALS_ONE');
    failures.push('audit:demo-lump-version-field-offset-zero-uint8:not-observed');
  }
  if (snapshot.demoVersionVanillaDoom19 !== 109) {
    failures.push('derived:DEMO_VERSION_VANILLA_DOOM_1_9_EQUALS_ONE_OH_NINE');
    failures.push('audit:demo-lump-version-vanilla-109:not-observed');
  }
  if (snapshot.demoSkillFieldOffset !== 1) {
    failures.push('derived:DEMO_SKILL_FIELD_OFFSET_EQUALS_ONE');
    failures.push('audit:demo-lump-skill-field-offset-one-uint8:not-observed');
  }
  if (snapshot.demoEpisodeFieldOffset !== 2) {
    failures.push('derived:DEMO_EPISODE_FIELD_OFFSET_EQUALS_TWO');
    failures.push('audit:demo-lump-episode-field-offset-two-uint8:not-observed');
  }
  if (snapshot.demoMapFieldOffset !== 3) {
    failures.push('derived:DEMO_MAP_FIELD_OFFSET_EQUALS_THREE');
    failures.push('audit:demo-lump-map-field-offset-three-uint8:not-observed');
  }
  if (snapshot.demoDeathmatchFieldOffset !== 4) {
    failures.push('derived:DEMO_DEATHMATCH_FIELD_OFFSET_EQUALS_FOUR');
    failures.push('audit:demo-lump-deathmatch-field-offset-four-uint8:not-observed');
  }
  if (snapshot.demoRespawnparmFieldOffset !== 5) {
    failures.push('derived:DEMO_RESPAWNPARM_FIELD_OFFSET_EQUALS_FIVE');
    failures.push('audit:demo-lump-respawnparm-field-offset-five-uint8:not-observed');
  }
  if (snapshot.demoFastparmFieldOffset !== 6) {
    failures.push('derived:DEMO_FASTPARM_FIELD_OFFSET_EQUALS_SIX');
    failures.push('audit:demo-lump-fastparm-field-offset-six-uint8:not-observed');
  }
  if (snapshot.demoNomonstersFieldOffset !== 7) {
    failures.push('derived:DEMO_NOMONSTERS_FIELD_OFFSET_EQUALS_SEVEN');
    failures.push('audit:demo-lump-nomonsters-field-offset-seven-uint8:not-observed');
  }
  if (snapshot.demoConsoleplayerFieldOffset !== 8) {
    failures.push('derived:DEMO_CONSOLEPLAYER_FIELD_OFFSET_EQUALS_EIGHT');
    failures.push('audit:demo-lump-consoleplayer-field-offset-eight-uint8:not-observed');
  }
  if (snapshot.demoPlayeringameFieldOffset !== 9) {
    failures.push('derived:DEMO_PLAYERINGAME_FIELD_OFFSET_EQUALS_NINE');
    failures.push('audit:demo-lump-playeringame-field-offset-nine-four-uint8s:not-observed');
  }
  if (snapshot.demoPlayeringameFieldBytes !== 4) {
    failures.push('derived:DEMO_PLAYERINGAME_FIELD_BYTES_EQUALS_FOUR');
    failures.push('audit:demo-lump-playeringame-field-offset-nine-four-uint8s:not-observed');
  }
  if (snapshot.demoMaxPlayers !== 4) {
    failures.push('derived:DEMO_MAX_PLAYERS_EQUALS_FOUR');
    failures.push('audit:demo-lump-playeringame-field-offset-nine-four-uint8s:not-observed');
  }
  if (snapshot.demoTiccmdBytes !== 4) {
    failures.push('derived:DEMO_TICCMD_BYTES_EQUALS_FOUR');
    failures.push('audit:demo-lump-ticcmd-bytes-four-per-active-player:not-observed');
  }
  if (snapshot.demoTiccmdForwardmoveOffset !== 0) {
    failures.push('derived:DEMO_TICCMD_FORWARDMOVE_OFFSET_EQUALS_ZERO');
    failures.push('audit:demo-lump-ticcmd-forwardmove-signed-int8:not-observed');
  }
  if (snapshot.demoTiccmdSidemoveOffset !== 1) {
    failures.push('derived:DEMO_TICCMD_SIDEMOVE_OFFSET_EQUALS_ONE');
    failures.push('audit:demo-lump-ticcmd-sidemove-signed-int8:not-observed');
  }
  if (snapshot.demoTiccmdAngleturnOffset !== 2) {
    failures.push('derived:DEMO_TICCMD_ANGLETURN_OFFSET_EQUALS_TWO');
    failures.push('audit:demo-lump-ticcmd-angleturn-uint8-shifted-left-eight:not-observed');
  }
  if (snapshot.demoTiccmdButtonsOffset !== 3) {
    failures.push('derived:DEMO_TICCMD_BUTTONS_OFFSET_EQUALS_THREE');
    failures.push('audit:demo-lump-ticcmd-buttons-uint8:not-observed');
  }
  if (snapshot.demoEndMarker !== 0x80) {
    failures.push('derived:DEMO_END_MARKER_EQUALS_0X80');
    failures.push('audit:demo-lump-end-marker-0x80:not-observed');
  }
  if (snapshot.demoTicRateHz !== 35) {
    failures.push('derived:DEMO_TIC_RATE_HZ_EQUALS_THIRTY_FIVE');
    failures.push('audit:demo-lump-tic-rate-thirty-five-hz:not-observed');
  }
  if (!snapshot.parserReturnsFrozenHeader) {
    failures.push('derived:PARSE_DEMO_LUMP_HEADER_RETURNS_FROZEN_HEADER');
  }
  if (!snapshot.parserRejectsBufferTooSmallForHeader) {
    failures.push('derived:PARSE_DEMO_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  }
  if (!snapshot.parserRejectsUnsupportedVersion) {
    failures.push('derived:PARSE_DEMO_LUMP_HEADER_REJECTS_UNSUPPORTED_VERSION');
    failures.push('audit:demo-lump-version-vanilla-109:not-observed');
  }
  if (!snapshot.parserRejectsZeroActivePlayers) {
    failures.push('derived:PARSE_DEMO_LUMP_HEADER_REJECTS_ZERO_ACTIVE_PLAYERS');
  }
  if (!snapshot.isDemoLumpNameAcceptsDemoPrefix) {
    failures.push('derived:IS_DEMO_LUMP_NAME_REQUIRES_DEMO_PREFIX');
    failures.push('audit:demo-lump-name-lookup-via-w-cachelumpname:not-observed');
  }
  if (!snapshot.isDemoLumpNameRejectsBareDemoToken) {
    failures.push('derived:IS_DEMO_LUMP_NAME_REJECTS_DEMOCRATIC_SOUNDING_NON_DEMO_LUMPS');
  }

  const declaredAxes = new Set(DEMO_LUMP_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<DemoLumpAuditEntry['id']> = [
    'demo-lump-name-prefix-demo',
    'demo-lump-name-defdemoname-demo-n',
    'demo-lump-name-lookup-via-w-cachelumpname',
    'demo-lump-header-bytes-thirteen',
    'demo-lump-version-field-offset-zero-uint8',
    'demo-lump-version-vanilla-109',
    'demo-lump-skill-field-offset-one-uint8',
    'demo-lump-episode-field-offset-two-uint8',
    'demo-lump-map-field-offset-three-uint8',
    'demo-lump-deathmatch-field-offset-four-uint8',
    'demo-lump-respawnparm-field-offset-five-uint8',
    'demo-lump-fastparm-field-offset-six-uint8',
    'demo-lump-nomonsters-field-offset-seven-uint8',
    'demo-lump-consoleplayer-field-offset-eight-uint8',
    'demo-lump-playeringame-field-offset-nine-four-uint8s',
    'demo-lump-ticcmd-bytes-four-per-active-player',
    'demo-lump-ticcmd-forwardmove-signed-int8',
    'demo-lump-ticcmd-sidemove-signed-int8',
    'demo-lump-ticcmd-angleturn-uint8-shifted-left-eight',
    'demo-lump-ticcmd-buttons-uint8',
    'demo-lump-end-marker-0x80',
    'demo-lump-tic-rate-thirty-five-hz',
    'demo-lump-no-marker-range',
    'demo-lump-shareware-doom1-three-demos',
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
 * Pinned facts about a single named DEMO lump inside the shareware
 * `doom/DOOM1.WAD` directory that the focused test cross-checks
 * against the live on-disk file. Each pinned entry covers the full
 * `G_DoPlayDemo` read path: directory placement, file offset, raw
 * lump byte size, decoded header fields, derived tic count, and a
 * SHA-256 fingerprint of the lump bytes.
 */
export interface ShareWareDoom1WadDemoOracleEntry {
  /** Demo lump name (uppercase, NUL-stripped). */
  readonly name: string;
  /** Directory index of the DEMO lump in the live IWAD directory. */
  readonly directoryIndex: number;
  /** Byte offset of the DEMO lump inside the WAD file. */
  readonly fileOffset: number;
  /** Byte size of the DEMO lump (header + tic body + end marker). */
  readonly size: number;
  /** Decoded `version` byte from the on-disk demo header. */
  readonly version: number;
  /** Decoded `skill` byte from the on-disk demo header. */
  readonly skill: number;
  /** Decoded `episode` byte from the on-disk demo header. */
  readonly episode: number;
  /** Decoded `map` byte from the on-disk demo header. */
  readonly map: number;
  /** Decoded `deathmatch` byte from the on-disk demo header. */
  readonly deathmatch: number;
  /** Decoded `respawnparm` byte from the on-disk demo header. */
  readonly respawnparm: number;
  /** Decoded `fastparm` byte from the on-disk demo header. */
  readonly fastparm: number;
  /** Decoded `nomonsters` byte from the on-disk demo header. */
  readonly nomonsters: number;
  /** Decoded `consoleplayer` byte from the on-disk demo header. */
  readonly consoleplayer: number;
  /** Number of `true` entries in `playeringame[0..3]`. */
  readonly activePlayers: number;
  /** Tic count derived from the lump body length and `activePlayers`. */
  readonly ticCount: number;
  /** SHA-256 hex digest of the DEMO lump bytes (lower-case, 64 chars). */
  readonly sha256: string;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` demo lump inventory. */
export interface ShareWareDoom1WadDemoLumpOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Total demo lump count (matches `lumpCategories.demo`). */
  readonly demoLumpCount: 3;
  /** Directory index of the first `DEMO` lump in directory order (DEMO1). */
  readonly firstDemoLumpIndex: 3;
  /** Directory index of the last `DEMO` lump in directory order (DEMO3). */
  readonly lastDemoLumpIndex: 5;
  /** Pinned named DEMO lumps with directory indices, file offsets, raw header fields, and SHA-256 fingerprints. */
  readonly pinnedDemoLumps: readonly ShareWareDoom1WadDemoOracleEntry[];
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` demo lump
 * inventory.
 *
 * The pinned probes were captured by hand from the live IWAD
 * (`probe-demo.ts`) and cover all three built-in demos. Each demo
 * pins the directory placement, file offset, raw lump byte size, the
 * full 13-byte header (version, skill, episode, map, deathmatch,
 * respawn, fast, nomonsters, consoleplayer, playeringame[0..3]
 * popcount), the derived tic count, and a SHA-256 fingerprint of the
 * lump bytes.
 */
export const SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE: ShareWareDoom1WadDemoLumpOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  demoLumpCount: 3,
  firstDemoLumpIndex: 3,
  lastDemoLumpIndex: 5,
  pinnedDemoLumps: Object.freeze([
    Object.freeze({
      name: 'DEMO1',
      directoryIndex: 3,
      fileOffset: 23468,
      size: 20118,
      version: 109,
      skill: 2,
      episode: 1,
      map: 5,
      deathmatch: 0,
      respawnparm: 0,
      fastparm: 0,
      nomonsters: 0,
      consoleplayer: 0,
      activePlayers: 1,
      ticCount: 5026,
      sha256: '7f32ed06308fc14d7fbe87baf9e318f3500516d724ce69a32b339d588ba1fe1b',
    }),
    Object.freeze({
      name: 'DEMO2',
      directoryIndex: 4,
      fileOffset: 43588,
      size: 15358,
      version: 109,
      skill: 2,
      episode: 1,
      map: 3,
      deathmatch: 0,
      respawnparm: 0,
      fastparm: 0,
      nomonsters: 0,
      consoleplayer: 0,
      activePlayers: 1,
      ticCount: 3836,
      sha256: '74ee530c2c35046469bafd92d0cd49ab0a5dee76872c1a91e682aef9bc4410e9',
    }),
    Object.freeze({
      name: 'DEMO3',
      directoryIndex: 5,
      fileOffset: 58948,
      size: 8550,
      version: 109,
      skill: 2,
      episode: 1,
      map: 7,
      deathmatch: 0,
      respawnparm: 0,
      fastparm: 0,
      nomonsters: 0,
      consoleplayer: 0,
      activePlayers: 1,
      ticCount: 2134,
      sha256: '61850b2201e283fa0a946cf091101a321e7a6219800a4f66448c949bc6144bce',
    }),
  ]) as readonly ShareWareDoom1WadDemoOracleEntry[],
}) as ShareWareDoom1WadDemoLumpOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * demo lump inventory so the focused test can re-derive the values
 * from the live file every run and feed the result into the
 * cross-check.
 */
export interface ShareWareDoom1WadDemoLumpSample {
  readonly demoLumpCount: number;
  readonly firstDemoLumpIndex: number;
  readonly lastDemoLumpIndex: number;
  readonly pinnedDemoLumps: readonly {
    readonly name: string;
    readonly directoryIndex: number;
    readonly fileOffset: number;
    readonly size: number;
    readonly version: number;
    readonly skill: number;
    readonly episode: number;
    readonly map: number;
    readonly deathmatch: number;
    readonly respawnparm: number;
    readonly fastparm: number;
    readonly nomonsters: number;
    readonly consoleplayer: number;
    readonly activePlayers: number;
    readonly ticCount: number;
    readonly sha256: string;
  }[];
}

/**
 * Cross-check a shareware DOOM1.WAD demo sample against the pinned
 * oracle. Returns the list of failures by stable identifier; an empty
 * list means the live inventory matches the oracle byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:demo:<name>:not-found` when the sample is missing a
 *    pinned named DEMO lump.
 *  - `oracle:demo:<name>:<field>:value-mismatch` for any oracle
 *    field on a pinned named DEMO lump whose live counterpart
 *    disagrees.
 */
export function crossCheckShareWareDoom1WadDemoLumpSample(sample: ShareWareDoom1WadDemoLumpSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'demoLumpCount' | 'firstDemoLumpIndex' | 'lastDemoLumpIndex'> = ['demoLumpCount', 'firstDemoLumpIndex', 'lastDemoLumpIndex'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
    const liveDemo = sample.pinnedDemoLumps.find((entry) => entry.name === oracleDemo.name);
    if (!liveDemo) {
      failures.push(`oracle:demo:${oracleDemo.name}:not-found`);
      continue;
    }
    const fields: ReadonlyArray<keyof ShareWareDoom1WadDemoOracleEntry> = [
      'directoryIndex',
      'fileOffset',
      'size',
      'version',
      'skill',
      'episode',
      'map',
      'deathmatch',
      'respawnparm',
      'fastparm',
      'nomonsters',
      'consoleplayer',
      'activePlayers',
      'ticCount',
      'sha256',
    ];
    for (const field of fields) {
      if (liveDemo[field] !== oracleDemo[field]) {
        failures.push(`oracle:demo:${oracleDemo.name}:${field}:value-mismatch`);
      }
    }
  }

  return failures;
}
