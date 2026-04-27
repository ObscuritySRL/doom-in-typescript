/**
 * Audit ledger for the vanilla DOOM 1.9 PLAYPAL and COLORMAP lump parsers
 * implemented by `src/assets/playpal.ts` and `src/assets/colormap.ts`.
 *
 * Each entry pins one byte-level layout fact, one semantic palette-region
 * constant, or one runtime contract of the two parsers to its upstream
 * Chocolate Doom 2.2.1 declaration. The accompanying focused test imports
 * the runtime `parsePlaypal` / `parseColormap` functions plus the local
 * `doom/DOOM1.WAD` oracle and cross-checks every audit entry against the
 * runtime exports plus the live oracle. If a future change silently shifts
 * `PALETTE_COUNT` / `COLORMAP_COUNT`, perturbs the 768-byte palette stride
 * or the 256-byte colormap stride, drops the size-validation throw, or
 * relaxes the `Object.freeze` immutability of the returned palette /
 * colormap arrays, the audit ledger and the focused test together reject
 * the change.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/r_data.c`, `src/st_stuff.c`,
 *      `src/v_video.c`, `src/doomdef.h`, `src/w_wad.c`, `src/p_setup.c`).
 *
 * The format and constant declarations below are pinned against authority 5
 * because the byte layout of the PLAYPAL and COLORMAP lumps and the
 * semantic indices that consume them are textual constants the binary
 * cannot disagree with: every byte stride, palette-region index, and lump-
 * total formula is a property of the on-disk byte stream and of the
 * `#define` lines in the upstream source, not of any runtime register
 * state. The shareware `DOOM1.WAD` oracle facts (PLAYPAL at directory
 * index 0, COLORMAP at directory index 1, raw byte offsets, sha256
 * fingerprints, and selected (R,G,B) probe triples) are pinned against
 * authority 2 — the local IWAD itself — and re-derived from the on-disk
 * file every test run.
 */

import { COLORMAP_COUNT, COLORMAP_LUMP_SIZE, COLORMAP_SIZE, ENTRIES_PER_COLORMAP, INVULNERABILITY_COLORMAP, LIGHTLEVEL_COUNT, parseColormap } from './colormap.ts';
import { BYTES_PER_COLOR, COLORS_PER_PALETTE, NUMBONUSPALS, NUMREDPALS, PALETTE_COUNT, PALETTE_SIZE, PLAYPAL_SIZE, RADIATIONPAL, STARTBONUSPALS, STARTREDPALS, parsePlaypal } from './playpal.ts';

/**
 * One audited byte-level layout fact, semantic palette-region constant, or
 * runtime contract of the PLAYPAL / COLORMAP parsers, pinned to its
 * upstream Chocolate Doom 2.2.1 declaration.
 */
export interface PlaypalColormapAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'playpal-palette-count-fourteen'
    | 'playpal-colors-per-palette-256'
    | 'playpal-bytes-per-color-three'
    | 'playpal-palette-stride-768'
    | 'playpal-total-size-10752'
    | 'playpal-startredpals-one'
    | 'playpal-numredpals-eight'
    | 'playpal-startbonuspals-nine'
    | 'playpal-numbonuspals-four'
    | 'playpal-radiationpal-thirteen'
    | 'playpal-cache-by-name'
    | 'colormap-numcolormaps-thirty-two'
    | 'colormap-entries-per-colormap-256'
    | 'colormap-stride-256'
    | 'colormap-total-size-shareware-8704'
    | 'colormap-invulnerability-index-thirty-two'
    | 'colormap-cache-by-name';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'PLAYPAL' | 'COLORMAP' | 'parsePlaypal' | 'parseColormap';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/st_stuff.c' | 'src/doomdef.h' | 'src/r_data.c' | 'src/r_main.c' | 'src/v_video.c' | 'src/w_wad.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, palette-region constant, and
 * runtime parser contract the runtime PLAYPAL / COLORMAP loaders must
 * preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend the
 * ledger rather than mutate prior entries. The focused test enforces that
 * every entry is reflected by an observable runtime behavior.
 */
export const PLAYPAL_COLORMAP_AUDIT: readonly PlaypalColormapAuditEntry[] = [
  {
    id: 'playpal-palette-count-fourteen',
    subject: 'PLAYPAL',
    cSourceLines: ['#define STARTREDPALS\t\t1', '#define STARTBONUSPALS\t\t9', '#define NUMREDPALS\t\t\t8', '#define NUMBONUSPALS\t\t4', '#define RADIATIONPAL\t\t\t13'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      'The PLAYPAL lump carries exactly 14 distinct palettes: index 0 (normal/no tint) + indices 1..8 (eight red damage tints, STARTREDPALS..STARTREDPALS+NUMREDPALS-1) + indices 9..12 (four gold bonus tints, STARTBONUSPALS..STARTBONUSPALS+NUMBONUSPALS-1) + index 13 (radiation suit green, RADIATIONPAL). Adding 1 + 8 + 4 + 1 yields 14, the count `parsePlaypal` returns. The runtime models this with `PALETTE_COUNT = 14` and the palette-region constants STARTREDPALS, NUMREDPALS, STARTBONUSPALS, NUMBONUSPALS, RADIATIONPAL imported from `src/assets/playpal.ts`.',
  },
  {
    id: 'playpal-colors-per-palette-256',
    subject: 'PLAYPAL',
    cSourceLines: ['pal = (byte *) W_CacheLumpNum (lu_palette, PU_CACHE) + palette*768;', 'I_SetPalette (pal);'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      'Each PLAYPAL palette is a flat run of 256 (R,G,B) triples, indexed 0..255 by the DOS-era 8-bit display path. Vanilla advances by `palette*768` bytes when selecting a palette in `ST_doPaletteStuff`, which proves both the 768-byte stride and the 256-color-per-palette layout. The runtime models this with `COLORS_PER_PALETTE = 256` exposed by `src/assets/playpal.ts`.',
  },
  {
    id: 'playpal-bytes-per-color-three',
    subject: 'PLAYPAL',
    cSourceLines: ['pal = (byte *) W_CacheLumpNum (lu_palette, PU_CACHE) + palette*768;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      'Each PLAYPAL color triple is 3 bytes — one byte each for red, green, and blue, in that on-disk order — because `palette*768` divides into 256 colors of `768/256 = 3` bytes each. The runtime models this with `BYTES_PER_COLOR = 3` exposed by `src/assets/playpal.ts`.',
  },
  {
    id: 'playpal-palette-stride-768',
    subject: 'PLAYPAL',
    cSourceLines: ['pal = (byte *) W_CacheLumpNum (lu_palette, PU_CACHE) + palette*768;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      'Every palette occupies exactly 768 bytes (256 colors * 3 bytes). The vanilla `palette*768` stride hard-codes this, so any deviation from 768 would silently misalign the palette pointer and produce off-by-RGB-channel rendering. The runtime models this with `PALETTE_SIZE = 768` exposed by `src/assets/playpal.ts`.',
  },
  {
    id: 'playpal-total-size-10752',
    subject: 'PLAYPAL',
    cSourceLines: ['pal = (byte *) W_CacheLumpNum (lu_palette, PU_CACHE) + palette*768;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      'The full PLAYPAL lump is 14 * 768 = 10752 bytes. Vanilla never validates this size at runtime, so a parser that silently accepted a different total would let a malformed PWAD shift palette boundaries into garbage memory. `parsePlaypal` rejects any input whose `length !== 10752` with a `RangeError`, modeling `PLAYPAL_SIZE = PALETTE_COUNT * PALETTE_SIZE = 14 * 768 = 10752`.',
  },
  {
    id: 'playpal-startredpals-one',
    subject: 'PLAYPAL',
    cSourceLines: ['#define STARTREDPALS\t\t1', 'palette = (cnt+7)>>3;', 'if (palette >= NUMREDPALS) palette = NUMREDPALS-1;', 'palette += STARTREDPALS;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      '`STARTREDPALS = 1` is the index of the first red damage palette. `ST_doPaletteStuff` clamps the damage-derived offset to `NUMREDPALS-1` and then adds `STARTREDPALS`, producing palette indices 1..8 (inclusive) for the eight damage steps. The runtime models this with `STARTREDPALS = 1` exposed by `src/assets/playpal.ts`.',
  },
  {
    id: 'playpal-numredpals-eight',
    subject: 'PLAYPAL',
    cSourceLines: ['#define NUMREDPALS\t\t\t8', 'if (palette >= NUMREDPALS) palette = NUMREDPALS-1;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      '`NUMREDPALS = 8` is the count of damage / berserk red palettes (indices 1..8). The runtime models this with `NUMREDPALS = 8` exposed by `src/assets/playpal.ts`. Together with `STARTREDPALS = 1`, this proves indices 1..8 are reserved for red tints.',
  },
  {
    id: 'playpal-startbonuspals-nine',
    subject: 'PLAYPAL',
    cSourceLines: ['#define STARTBONUSPALS\t\t9', 'palette = (plyr->bonuscount+7)>>3;', 'if (palette >= NUMBONUSPALS) palette = NUMBONUSPALS-1;', 'palette += STARTBONUSPALS;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      '`STARTBONUSPALS = 9` is the index of the first bonus-pickup gold palette. `ST_doPaletteStuff` clamps the bonuscount-derived offset to `NUMBONUSPALS-1` and then adds `STARTBONUSPALS`, producing palette indices 9..12 (inclusive) for the four bonus-flash steps. The runtime models this with `STARTBONUSPALS = 9` exposed by `src/assets/playpal.ts`.',
  },
  {
    id: 'playpal-numbonuspals-four',
    subject: 'PLAYPAL',
    cSourceLines: ['#define NUMBONUSPALS\t\t4', 'if (palette >= NUMBONUSPALS) palette = NUMBONUSPALS-1;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      '`NUMBONUSPALS = 4` is the count of bonus-pickup gold palettes (indices 9..12). The runtime models this with `NUMBONUSPALS = 4` exposed by `src/assets/playpal.ts`. Together with `STARTBONUSPALS = 9`, this proves indices 9..12 are reserved for the gold bonus tints.',
  },
  {
    id: 'playpal-radiationpal-thirteen',
    subject: 'PLAYPAL',
    cSourceLines: ['#define RADIATIONPAL\t\t\t13', 'else if (plyr->powers[pw_ironfeet] > 4*32', '\t || plyr->powers[pw_ironfeet]&8)', '\tpalette = RADIATIONPAL;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      '`RADIATIONPAL = 13` is the index of the radiation-suit green palette. `ST_doPaletteStuff` selects this palette directly when `pw_ironfeet` is active. The runtime models this with `RADIATIONPAL = 13` exposed by `src/assets/playpal.ts`.',
  },
  {
    id: 'playpal-cache-by-name',
    subject: 'parsePlaypal',
    cSourceLines: ['lu_palette = W_GetNumForName ("PLAYPAL");', 'pal = (byte *) W_CacheLumpNum (lu_palette, PU_CACHE) + palette*768;'],
    referenceSourceFile: 'src/st_stuff.c',
    invariant:
      'Vanilla resolves the PLAYPAL lump once via `W_GetNumForName("PLAYPAL")` at startup and then re-caches it through `W_CacheLumpNum` on every palette switch. The cached pointer is read verbatim — no endian conversion, no per-channel transformation. The runtime models this with `parsePlaypal(lumpData)` returning live `Uint8Array` views that share the underlying buffer (no copies), so palette selection is a constant-time stride lookup over the same bytes the vanilla path would dereference.',
  },
  {
    id: 'colormap-numcolormaps-thirty-two',
    subject: 'COLORMAP',
    cSourceLines: ['#define NUMCOLORMAPS\t\t32'],
    referenceSourceFile: 'src/doomdef.h',
    invariant:
      '`NUMCOLORMAPS = 32` is the count of light-level diminishing colormaps the renderer indexes during scaled wall and span draws. The shareware COLORMAP lump ships with two additional trailing entries (the inverse colormap at index 32 used by invulnerability and an all-zeros entry at index 33 observed in DOOM1.WAD), so the on-disk lump always carries `NUMCOLORMAPS + 2 = 34` colormaps in vanilla and Chocolate Doom 2.2.1. The runtime models the renderer count with `LIGHTLEVEL_COUNT = 32` and the on-disk count with `COLORMAP_COUNT = 34`, both exposed by `src/assets/colormap.ts`.',
  },
  {
    id: 'colormap-entries-per-colormap-256',
    subject: 'COLORMAP',
    cSourceLines: ['lump = W_GetNumForName("COLORMAP"); ', 'length = W_LumpLength (lump) + 255; ', 'colormaps = Z_Malloc (length, PU_STATIC, 0); ', 'colormaps = (byte *)( ((int)colormaps + 255)&~0xff); ', 'W_ReadLump (lump,colormaps); '],
    referenceSourceFile: 'src/r_data.c',
    invariant:
      'Each colormap is a 256-byte lookup table indexed by an 8-bit palette index (entry `i` of colormap `c` gives the palette index that palette index `i` maps to under that colormap`s light level or special effect). Vanilla `R_DrawColumn` and `R_DrawSpan` read `dc_colormap[source[...]]` on every pixel, so the 256-entry stride is fixed by the 8-bit palette domain itself. The runtime models this with `ENTRIES_PER_COLORMAP = 256` exposed by `src/assets/colormap.ts`.',
  },
  {
    id: 'colormap-stride-256',
    subject: 'COLORMAP',
    cSourceLines: ['fixedcolormap = colormaps + 32*256;'],
    referenceSourceFile: 'src/r_main.c',
    invariant:
      'Every colormap occupies exactly 256 bytes. Vanilla advances by `32*256 = 8192` bytes when selecting the inverse (invulnerability) colormap in `R_SetupFrame`, proving both the 256-byte stride and the position of the inverse colormap at on-disk index 32. The runtime models the stride with `COLORMAP_SIZE = 256` exposed by `src/assets/colormap.ts`.',
  },
  {
    id: 'colormap-total-size-shareware-8704',
    subject: 'COLORMAP',
    cSourceLines: ['lump = W_GetNumForName("COLORMAP"); ', 'length = W_LumpLength (lump) + 255; ', 'colormaps = Z_Malloc (length, PU_STATIC, 0); ', 'W_ReadLump (lump,colormaps); '],
    referenceSourceFile: 'src/r_data.c',
    invariant:
      '`R_InitColormaps` reads the COLORMAP lump verbatim with `W_ReadLump` after a 256-byte alignment pad. The shareware DOOM1.WAD COLORMAP lump is 34 * 256 = 8704 bytes; vanilla never validates this size at runtime, so a parser that silently accepted a different total would slide colormap boundaries against the renderer`s `colormap[i*256+x]` indexing. `parseColormap` rejects any input whose `length !== 8704` with a `RangeError`, modeling `COLORMAP_LUMP_SIZE = COLORMAP_COUNT * COLORMAP_SIZE = 34 * 256 = 8704`.',
  },
  {
    id: 'colormap-invulnerability-index-thirty-two',
    subject: 'COLORMAP',
    cSourceLines: ['if (player->fixedcolormap)', '\tfixedcolormap = colormaps + player->fixedcolormap*256;'],
    referenceSourceFile: 'src/r_main.c',
    invariant:
      'The renderer points `fixedcolormap` at `colormaps + 32*256` (i.e. on-disk colormap index 32) when invulnerability is active. The on-disk inverse colormap therefore lives at index 32, immediately after the 32 light-level colormaps (indices 0..31). The runtime models this with `INVULNERABILITY_COLORMAP = 32` exposed by `src/assets/colormap.ts`.',
  },
  {
    id: 'colormap-cache-by-name',
    subject: 'parseColormap',
    cSourceLines: ['lump = W_GetNumForName("COLORMAP"); ', 'W_ReadLump (lump,colormaps); '],
    referenceSourceFile: 'src/r_data.c',
    invariant:
      '`R_InitColormaps` resolves the COLORMAP lump by name once and reads it verbatim into a 256-byte-aligned buffer. The bytes are not endian-converted, palette-translated, or otherwise transformed before the renderer indexes them. The runtime models this with `parseColormap(lumpData)` returning live `Uint8Array` views that share the underlying buffer (no copies), so colormap selection is a constant-time stride lookup over the same bytes the vanilla path would dereference.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top of
 * the raw audit entries. Failures point at concrete identities that any
 * vanilla parity rebuild must preserve.
 */
export interface PlaypalColormapDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const PLAYPAL_COLORMAP_DERIVED_INVARIANTS: readonly PlaypalColormapDerivedInvariant[] = [
  {
    id: 'PLAYPAL_TOTAL_EQUALS_PALETTE_COUNT_TIMES_PALETTE_SIZE',
    description: '`PLAYPAL_SIZE === PALETTE_COUNT * PALETTE_SIZE`. The total lump byte size is determined exactly by the palette count and palette stride.',
  },
  {
    id: 'PLAYPAL_PALETTE_SIZE_EQUALS_COLORS_TIMES_BYTES_PER_COLOR',
    description: '`PALETTE_SIZE === COLORS_PER_PALETTE * BYTES_PER_COLOR`. The 768-byte palette stride decomposes exactly into 256 RGB triples of 3 bytes each.',
  },
  {
    id: 'PLAYPAL_REGIONS_FILL_FOURTEEN_PALETTES',
    description: '`1 (normal) + NUMREDPALS + NUMBONUSPALS + 1 (RADIATIONPAL) === PALETTE_COUNT`. The four palette regions partition the lump into exactly 14 palettes with no gaps and no overlap.',
  },
  {
    id: 'PLAYPAL_RED_REGION_AT_ONE_THROUGH_EIGHT',
    description: '`STARTREDPALS === 1` and the red region spans indices `STARTREDPALS .. STARTREDPALS + NUMREDPALS - 1` === 1..8 inclusive.',
  },
  {
    id: 'PLAYPAL_BONUS_REGION_AT_NINE_THROUGH_TWELVE',
    description: '`STARTBONUSPALS === STARTREDPALS + NUMREDPALS === 9` and the bonus region spans indices `STARTBONUSPALS .. STARTBONUSPALS + NUMBONUSPALS - 1` === 9..12 inclusive.',
  },
  {
    id: 'PLAYPAL_RADIATION_REGION_IS_LAST_PALETTE',
    description: '`RADIATIONPAL === STARTBONUSPALS + NUMBONUSPALS === 13 === PALETTE_COUNT - 1`. The radiation suit palette is the last (14th) palette in the lump.',
  },
  {
    id: 'PARSEPLAYPAL_RETURNS_FOURTEEN_VIEWS_OF_768_BYTES',
    description: '`parsePlaypal(validLump).length === 14`, every returned `Uint8Array` has `length === 768`, and the array is `Object.isFrozen` true.',
  },
  {
    id: 'PARSEPLAYPAL_REJECTS_WRONG_SIZE_WITH_RANGEERROR',
    description: '`parsePlaypal(new Uint8Array(10751))` and `parsePlaypal(new Uint8Array(10753))` both throw a `RangeError` whose message names `PLAYPAL` and the byte count.',
  },
  {
    id: 'COLORMAP_TOTAL_EQUALS_COUNT_TIMES_SIZE',
    description: '`COLORMAP_LUMP_SIZE === COLORMAP_COUNT * COLORMAP_SIZE === 34 * 256 === 8704`. The total lump byte size is determined exactly by the colormap count and stride.',
  },
  {
    id: 'COLORMAP_LIGHT_LEVELS_AT_INDICES_ZERO_THROUGH_THIRTYONE',
    description: '`LIGHTLEVEL_COUNT === 32` and the light-level colormaps occupy on-disk indices 0..31 inclusive — the first 32 of the 34 colormaps.',
  },
  {
    id: 'COLORMAP_INVULNERABILITY_AT_INDEX_THIRTYTWO',
    description: '`INVULNERABILITY_COLORMAP === LIGHTLEVEL_COUNT === 32`. The invulnerability inverse colormap immediately follows the 32 light-level colormaps.',
  },
  {
    id: 'PARSECOLORMAP_RETURNS_THIRTYFOUR_VIEWS_OF_256_BYTES',
    description: '`parseColormap(validLump).length === 34`, every returned `Uint8Array` has `length === 256`, and the array is `Object.isFrozen` true.',
  },
  {
    id: 'PARSECOLORMAP_REJECTS_WRONG_SIZE_WITH_RANGEERROR',
    description: '`parseColormap(new Uint8Array(8703))` and `parseColormap(new Uint8Array(8705))` both throw a `RangeError` whose message names `COLORMAP` and the byte count.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/playpal.ts` and `src/assets/colormap.ts`. The cross-check
 * helper consumes this shape so the focused test can both verify the live
 * runtime exports and exercise a deliberately tampered snapshot to prove
 * the failure modes are observable.
 */
export interface PlaypalColormapRuntimeSnapshot {
  /** `PALETTE_COUNT` exported by `src/assets/playpal.ts`. */
  readonly paletteCount: number;
  /** `COLORS_PER_PALETTE` exported by `src/assets/playpal.ts`. */
  readonly colorsPerPalette: number;
  /** `BYTES_PER_COLOR` exported by `src/assets/playpal.ts`. */
  readonly bytesPerColor: number;
  /** `PALETTE_SIZE` exported by `src/assets/playpal.ts`. */
  readonly paletteSize: number;
  /** `PLAYPAL_SIZE` exported by `src/assets/playpal.ts`. */
  readonly playpalSize: number;
  /** `STARTREDPALS` exported by `src/assets/playpal.ts`. */
  readonly startRedPals: number;
  /** `NUMREDPALS` exported by `src/assets/playpal.ts`. */
  readonly numRedPals: number;
  /** `STARTBONUSPALS` exported by `src/assets/playpal.ts`. */
  readonly startBonusPals: number;
  /** `NUMBONUSPALS` exported by `src/assets/playpal.ts`. */
  readonly numBonusPals: number;
  /** `RADIATIONPAL` exported by `src/assets/playpal.ts`. */
  readonly radiationPal: number;
  /** Length of the array returned by `parsePlaypal(validLump)`. */
  readonly parsePlaypalLength: number;
  /** Whether every entry of the parsed PLAYPAL has length 768. */
  readonly everyPaletteIs768Bytes: boolean;
  /** Whether the parsed PLAYPAL outer array is `Object.isFrozen` true. */
  readonly playpalArrayIsFrozen: boolean;
  /** Whether `parsePlaypal(new Uint8Array(playpalSize - 1))` throws a `RangeError` mentioning PLAYPAL. */
  readonly parsePlaypalRejectsShort: boolean;
  /** Whether `parsePlaypal(new Uint8Array(playpalSize + 1))` throws a `RangeError` mentioning PLAYPAL. */
  readonly parsePlaypalRejectsLong: boolean;
  /** `COLORMAP_COUNT` exported by `src/assets/colormap.ts`. */
  readonly colormapCount: number;
  /** `ENTRIES_PER_COLORMAP` exported by `src/assets/colormap.ts`. */
  readonly entriesPerColormap: number;
  /** `COLORMAP_SIZE` exported by `src/assets/colormap.ts`. */
  readonly colormapSize: number;
  /** `COLORMAP_LUMP_SIZE` exported by `src/assets/colormap.ts`. */
  readonly colormapLumpSize: number;
  /** `LIGHTLEVEL_COUNT` exported by `src/assets/colormap.ts`. */
  readonly lightLevelCount: number;
  /** `INVULNERABILITY_COLORMAP` exported by `src/assets/colormap.ts`. */
  readonly invulnerabilityColormap: number;
  /** Length of the array returned by `parseColormap(validLump)`. */
  readonly parseColormapLength: number;
  /** Whether every entry of the parsed COLORMAP has length 256. */
  readonly everyColormapIs256Bytes: boolean;
  /** Whether the parsed COLORMAP outer array is `Object.isFrozen` true. */
  readonly colormapArrayIsFrozen: boolean;
  /** Whether `parseColormap(new Uint8Array(colormapLumpSize - 1))` throws a `RangeError` mentioning COLORMAP. */
  readonly parseColormapRejectsShort: boolean;
  /** Whether `parseColormap(new Uint8Array(colormapLumpSize + 1))` throws a `RangeError` mentioning COLORMAP. */
  readonly parseColormapRejectsLong: boolean;
}

/**
 * Cross-check a `PlaypalColormapRuntimeSnapshot` against
 * `PLAYPAL_COLORMAP_AUDIT` and `PLAYPAL_COLORMAP_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list means
 * the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckPlaypalColormapRuntime(snapshot: PlaypalColormapRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.playpalSize !== snapshot.paletteCount * snapshot.paletteSize) {
    failures.push('derived:PLAYPAL_TOTAL_EQUALS_PALETTE_COUNT_TIMES_PALETTE_SIZE');
    failures.push('audit:playpal-total-size-10752:not-observed');
  }

  if (snapshot.paletteSize !== snapshot.colorsPerPalette * snapshot.bytesPerColor) {
    failures.push('derived:PLAYPAL_PALETTE_SIZE_EQUALS_COLORS_TIMES_BYTES_PER_COLOR');
    failures.push('audit:playpal-palette-stride-768:not-observed');
  }

  if (1 + snapshot.numRedPals + snapshot.numBonusPals + 1 !== snapshot.paletteCount) {
    failures.push('derived:PLAYPAL_REGIONS_FILL_FOURTEEN_PALETTES');
    failures.push('audit:playpal-palette-count-fourteen:not-observed');
  }

  if (snapshot.startRedPals !== 1 || snapshot.startRedPals + snapshot.numRedPals - 1 !== 8) {
    failures.push('derived:PLAYPAL_RED_REGION_AT_ONE_THROUGH_EIGHT');
    failures.push('audit:playpal-startredpals-one:not-observed');
    failures.push('audit:playpal-numredpals-eight:not-observed');
  }

  if (snapshot.startBonusPals !== snapshot.startRedPals + snapshot.numRedPals || snapshot.startBonusPals + snapshot.numBonusPals - 1 !== 12) {
    failures.push('derived:PLAYPAL_BONUS_REGION_AT_NINE_THROUGH_TWELVE');
    failures.push('audit:playpal-startbonuspals-nine:not-observed');
    failures.push('audit:playpal-numbonuspals-four:not-observed');
  }

  if (snapshot.radiationPal !== snapshot.startBonusPals + snapshot.numBonusPals || snapshot.radiationPal !== snapshot.paletteCount - 1) {
    failures.push('derived:PLAYPAL_RADIATION_REGION_IS_LAST_PALETTE');
    failures.push('audit:playpal-radiationpal-thirteen:not-observed');
  }

  if (snapshot.parsePlaypalLength !== snapshot.paletteCount || !snapshot.everyPaletteIs768Bytes || !snapshot.playpalArrayIsFrozen) {
    failures.push('derived:PARSEPLAYPAL_RETURNS_FOURTEEN_VIEWS_OF_768_BYTES');
    failures.push('audit:playpal-cache-by-name:not-observed');
  }

  if (!snapshot.parsePlaypalRejectsShort || !snapshot.parsePlaypalRejectsLong) {
    failures.push('derived:PARSEPLAYPAL_REJECTS_WRONG_SIZE_WITH_RANGEERROR');
  }

  if (snapshot.colormapLumpSize !== snapshot.colormapCount * snapshot.colormapSize) {
    failures.push('derived:COLORMAP_TOTAL_EQUALS_COUNT_TIMES_SIZE');
    failures.push('audit:colormap-total-size-shareware-8704:not-observed');
  }

  if (snapshot.lightLevelCount !== 32 || snapshot.lightLevelCount > snapshot.colormapCount) {
    failures.push('derived:COLORMAP_LIGHT_LEVELS_AT_INDICES_ZERO_THROUGH_THIRTYONE');
    failures.push('audit:colormap-numcolormaps-thirty-two:not-observed');
  }

  if (snapshot.invulnerabilityColormap !== snapshot.lightLevelCount) {
    failures.push('derived:COLORMAP_INVULNERABILITY_AT_INDEX_THIRTYTWO');
    failures.push('audit:colormap-invulnerability-index-thirty-two:not-observed');
  }

  if (snapshot.parseColormapLength !== snapshot.colormapCount || !snapshot.everyColormapIs256Bytes || !snapshot.colormapArrayIsFrozen) {
    failures.push('derived:PARSECOLORMAP_RETURNS_THIRTYFOUR_VIEWS_OF_256_BYTES');
    failures.push('audit:colormap-cache-by-name:not-observed');
  }

  if (!snapshot.parseColormapRejectsShort || !snapshot.parseColormapRejectsLong) {
    failures.push('derived:PARSECOLORMAP_REJECTS_WRONG_SIZE_WITH_RANGEERROR');
  }

  const declaredAxes = new Set(PLAYPAL_COLORMAP_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<PlaypalColormapAuditEntry['id']> = [
    'playpal-palette-count-fourteen',
    'playpal-colors-per-palette-256',
    'playpal-bytes-per-color-three',
    'playpal-palette-stride-768',
    'playpal-total-size-10752',
    'playpal-startredpals-one',
    'playpal-numredpals-eight',
    'playpal-startbonuspals-nine',
    'playpal-numbonuspals-four',
    'playpal-radiationpal-thirteen',
    'playpal-cache-by-name',
    'colormap-numcolormaps-thirty-two',
    'colormap-entries-per-colormap-256',
    'colormap-stride-256',
    'colormap-total-size-shareware-8704',
    'colormap-invulnerability-index-thirty-two',
    'colormap-cache-by-name',
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
 * Pinned facts about the PLAYPAL and COLORMAP lumps in the local shareware
 * `doom/DOOM1.WAD` IWAD that the focused test cross-checks against the
 * live on-disk file. Sourced from authority 2 (the local IWAD itself,
 * parsed once by hand) and cross-referenced with
 * `reference/manifests/wad-map-summary.json` (`lumpCategories.palette: 1`,
 * `lumpCategories.colormap: 1`).
 *
 * The sha256 fingerprints freeze the exact byte content of the two lumps
 * at the time of audit; any IWAD-modifying change that does not also
 * update the audit will surface as an oracle mismatch and reject the
 * change. The (R,G,B) probe triples lock down three palette regions that
 * downstream renderer / status-bar code depends on (palette 0 is the
 * normal/no-tint baseline, palette 1 is the start of the red damage
 * region, palette 13 is the radiation-suit green tint).
 */
export interface ShareWareDoom1WadPlaypalColormapOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Directory index of the PLAYPAL lump. */
  readonly playpalDirectoryIndex: 0;
  /** Directory index of the COLORMAP lump. */
  readonly colormapDirectoryIndex: 1;
  /** Byte offset of the PLAYPAL lump inside the WAD file. */
  readonly playpalFileOffset: 12;
  /** Byte size of the PLAYPAL lump (must equal 14 * 768 = 10752). */
  readonly playpalSize: 10752;
  /** Byte offset of the COLORMAP lump inside the WAD file. */
  readonly colormapFileOffset: 10764;
  /** Byte size of the COLORMAP lump (must equal 34 * 256 = 8704). */
  readonly colormapSize: 8704;
  /** SHA-256 hex digest of the PLAYPAL lump bytes (lower-case, 64 chars). */
  readonly playpalSha256: '0f6f1953cc6eb5024a2fe8aa03e12195bf314b24d89dfb0f46e6f7bf7ed97ffc';
  /** SHA-256 hex digest of the COLORMAP lump bytes (lower-case, 64 chars). */
  readonly colormapSha256: 'ec7ac65a637e8a0dab20f8585a781cfd986e0cf10759c63bccf27e0c1a3b831b';
  /** First (R,G,B) triple of palette 0 (the normal/no-tint baseline). */
  readonly paletteZeroFirstColor: readonly [0, 0, 0];
  /** First (R,G,B) triple of palette 1 (the brightest red damage tint). */
  readonly paletteOneFirstColor: readonly [28, 0, 0];
  /** First (R,G,B) triple of palette 13 (the radiation-suit green tint). */
  readonly paletteThirteenFirstColor: readonly [0, 32, 0];
  /** Whether the 34th colormap (index 33) is observed all-zero in shareware DOOM1.WAD. */
  readonly colormapIndexThirtyThreeIsAllZero: true;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` PLAYPAL / COLORMAP lumps. */
export const SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE: ShareWareDoom1WadPlaypalColormapOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  playpalDirectoryIndex: 0,
  colormapDirectoryIndex: 1,
  playpalFileOffset: 12,
  playpalSize: 10752,
  colormapFileOffset: 10764,
  colormapSize: 8704,
  playpalSha256: '0f6f1953cc6eb5024a2fe8aa03e12195bf314b24d89dfb0f46e6f7bf7ed97ffc',
  colormapSha256: 'ec7ac65a637e8a0dab20f8585a781cfd986e0cf10759c63bccf27e0c1a3b831b',
  paletteZeroFirstColor: Object.freeze([0, 0, 0]) as readonly [0, 0, 0],
  paletteOneFirstColor: Object.freeze([28, 0, 0]) as readonly [28, 0, 0],
  paletteThirteenFirstColor: Object.freeze([0, 32, 0]) as readonly [0, 32, 0],
  colormapIndexThirtyThreeIsAllZero: true,
}) as ShareWareDoom1WadPlaypalColormapOracle;

/**
 * Sample shape mirroring the on-disk PLAYPAL / COLORMAP layout for the
 * shareware DOOM1.WAD so the focused test can re-derive the values from
 * the live file every run and feed the result into the cross-check.
 */
export interface ShareWareDoom1WadPlaypalColormapSample {
  readonly playpalDirectoryIndex: number;
  readonly colormapDirectoryIndex: number;
  readonly playpalFileOffset: number;
  readonly playpalSize: number;
  readonly colormapFileOffset: number;
  readonly colormapSize: number;
  readonly playpalSha256: string;
  readonly colormapSha256: string;
  readonly paletteZeroFirstColor: readonly [number, number, number];
  readonly paletteOneFirstColor: readonly [number, number, number];
  readonly paletteThirteenFirstColor: readonly [number, number, number];
  readonly colormapIndexThirtyThreeIsAllZero: boolean;
}

/**
 * Cross-check a shareware DOOM1.WAD PLAYPAL / COLORMAP sample against the
 * pinned oracle. Returns the list of failures by stable identifier; an
 * empty list means the live lumps match the oracle byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle field whose live
 *    counterpart disagrees with the pinned value.
 */
export function crossCheckShareWareDoom1WadPlaypalColormapSample(sample: ShareWareDoom1WadPlaypalColormapSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<
    'playpalDirectoryIndex' | 'colormapDirectoryIndex' | 'playpalFileOffset' | 'playpalSize' | 'colormapFileOffset' | 'colormapSize' | 'playpalSha256' | 'colormapSha256' | 'colormapIndexThirtyThreeIsAllZero'
  > = ['playpalDirectoryIndex', 'colormapDirectoryIndex', 'playpalFileOffset', 'playpalSize', 'colormapFileOffset', 'colormapSize', 'playpalSha256', 'colormapSha256', 'colormapIndexThirtyThreeIsAllZero'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  const tripleFields: ReadonlyArray<'paletteZeroFirstColor' | 'paletteOneFirstColor' | 'paletteThirteenFirstColor'> = ['paletteZeroFirstColor', 'paletteOneFirstColor', 'paletteThirteenFirstColor'];
  for (const field of tripleFields) {
    const liveTriple = sample[field];
    const pinnedTriple = SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE[field];
    if (liveTriple[0] !== pinnedTriple[0] || liveTriple[1] !== pinnedTriple[1] || liveTriple[2] !== pinnedTriple[2]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Re-export the runtime parsers and constants under the audit module so
 * the focused test can import the audit ledger and the parser exports
 * from a single read-only path. The runtime modules `src/assets/playpal.ts`
 * and `src/assets/colormap.ts` remain the canonical sources of truth — the
 * re-exports below only collect them for the focused test.
 */
export {
  parsePlaypal,
  PALETTE_COUNT,
  COLORS_PER_PALETTE,
  BYTES_PER_COLOR,
  PALETTE_SIZE,
  PLAYPAL_SIZE,
  STARTREDPALS,
  NUMREDPALS,
  STARTBONUSPALS,
  NUMBONUSPALS,
  RADIATIONPAL,
  parseColormap,
  COLORMAP_COUNT,
  ENTRIES_PER_COLORMAP,
  COLORMAP_SIZE,
  COLORMAP_LUMP_SIZE,
  LIGHTLEVEL_COUNT,
  INVULNERABILITY_COLORMAP,
};
