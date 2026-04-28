/**
 * Audit ledger for the vanilla DOOM 1.9 sprite namespace parser, the
 * `R_InitSpriteLumps` pipeline that resolves the contiguous block of
 * patch-format sprite frame lumps between the `S_START` and `S_END`
 * markers in a WAD directory and assigns each entry a sequential
 * `firstspritelump`-relative sprite number that the renderer indexes
 * through `spritewidth` / `spriteoffset` / `spritetopoffset` at draw
 * time.
 *
 * This module pins the runtime contract one level deeper than the prior
 * 05-001..05-004 marker / lookup audits, the 05-005 PLAYPAL / COLORMAP
 * audit, the 05-006 patch picture format audit, the 05-007 flat
 * namespace audit, the 05-008 PNAMES audit, and the 05-009 / 05-010
 * TEXTURE1 / TEXTURE2 audits: the off-by-one arithmetic in
 * `R_InitSpriteLumps`, the parallel-array allocation of `spritewidth`,
 * `spriteoffset`, and `spritetopoffset`, the
 * `<<FRACBITS` fixed-point conversion of patch header fields, the
 * absence of inner sub-markers inside the sprite range (the namespace
 * is a flat sequence), the 4-byte sprite-name prefix, the 1-byte frame
 * letter at offset 4, the 1-byte rotation digit at offset 5, the
 * optional second-view frame letter / rotation digit at offsets 6 / 7,
 * and the `lump - firstspritelump` zero-based sprite number formula
 * that `R_InstallSpriteLump` relies on. The accompanying focused test
 * imports the ledger plus a self-contained `parseSpriteNamespace` and
 * `spriteNumForLumpIndex` runtime exposed by this module and
 * cross-checks every audit entry against the runtime behavior plus the
 * live shareware `doom/DOOM1.WAD` oracle.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/doom/r_data.c`,
 *      `src/doom/r_things.c`, `src/doom/w_wad.c`).
 *
 * The format and constant declarations below are pinned against
 * authority 5 because the sprite-namespace arithmetic and parallel-array
 * allocation are textual constants the binary cannot disagree with:
 * every off-by-one bound (`+1` / `-1`), the three `Z_Malloc` lines, the
 * `<<FRACBITS` shift, the `name[4] - 'A'` frame decode, the `name[5] -
 * '0'` rotation decode, and the `lump - firstspritelump` return formula
 * are properties of the upstream C source body of `R_InitSpriteLumps`
 * and `R_InstallSpriteLump`, not of any runtime register state. The
 * shareware `DOOM1.WAD` oracle facts (S_START at directory index 552,
 * S_END at directory index 1036, 483 sprite lumps in the namespace, and
 * selected named sprite frames with their byte offsets, raw patch
 * header fields, sha256 fingerprints, and zero-based sprite numbers)
 * are pinned against authority 2 — the local IWAD itself — and
 * re-derived from the on-disk file every test run.
 */

import { FRACBITS } from '../core/fixed.ts';
import type { Fixed } from '../core/fixed.ts';
import type { DirectoryEntry } from '../wad/directory.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract of the sprite namespace parser, pinned to its upstream
 * Chocolate Doom 2.2.1 declaration.
 */
export interface SpriteNamespaceAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'sprite-namespace-firstspritelump-formula'
    | 'sprite-namespace-lastspritelump-formula'
    | 'sprite-namespace-numspritelumps-formula'
    | 'sprite-namespace-spritewidth-allocation-numspritelumps'
    | 'sprite-namespace-spriteoffset-allocation-numspritelumps'
    | 'sprite-namespace-spritetopoffset-allocation-numspritelumps'
    | 'sprite-namespace-spritewidth-fixed-point-shift'
    | 'sprite-namespace-spriteoffset-fixed-point-shift'
    | 'sprite-namespace-spritetopoffset-fixed-point-shift'
    | 'sprite-namespace-r-initspritelumps-runs-inside-r-initdata'
    | 'sprite-namespace-frame-letter-decoded-at-offset-four'
    | 'sprite-namespace-rotation-digit-decoded-at-offset-five'
    | 'sprite-namespace-second-view-decoded-at-offset-six-and-seven'
    | 'sprite-namespace-installspritelump-returns-lump-minus-firstspritelump'
    | 'sprite-namespace-shareware-doom1-four-hundred-eighty-three-sprites';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'R_InitSpriteLumps' | 'R_InstallSpriteLump' | 'R_InitData' | 'spritewidth' | 'spriteoffset' | 'spritetopoffset' | 'parseSpriteNamespace' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/doom/r_data.c' | 'src/doom/r_things.c' | 'src/doom/w_wad.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and runtime
 * parser contract the runtime sprite namespace loader must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const SPRITE_NAMESPACE_AUDIT: readonly SpriteNamespaceAuditEntry[] = [
  {
    id: 'sprite-namespace-firstspritelump-formula',
    subject: 'R_InitSpriteLumps',
    cSourceLines: ['firstspritelump = W_GetNumForName (DEH_String("S_START")) + 1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` resolves `firstspritelump` as `W_GetNumForName("S_START") + 1`. The `+ 1` skips the `S_START` marker itself; the first content sprite lump in the namespace sits at the directory index immediately after the marker. The runtime models this with `firstSpriteIndex = startMarkerIndex + 1` exposed by `parseSpriteNamespace`.',
  },
  {
    id: 'sprite-namespace-lastspritelump-formula',
    subject: 'R_InitSpriteLumps',
    cSourceLines: ['lastspritelump = W_GetNumForName (DEH_String("S_END")) - 1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` resolves `lastspritelump` as `W_GetNumForName("S_END") - 1`. The `- 1` skips the `S_END` marker itself; the last content sprite lump in the namespace sits at the directory index immediately before the marker. The runtime models this with `lastSpriteIndex = endMarkerIndex - 1` exposed by `parseSpriteNamespace`.',
  },
  {
    id: 'sprite-namespace-numspritelumps-formula',
    subject: 'R_InitSpriteLumps',
    cSourceLines: ['numspritelumps = lastspritelump - firstspritelump + 1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` derives `numspritelumps` as `lastspritelump - firstspritelump + 1`. The `+ 1` makes the range inclusive of both endpoints (firstspritelump and lastspritelump are content lumps, not the markers themselves). The runtime models this with `numSpriteLumps = lastSpriteIndex - firstSpriteIndex + 1` exposed by `parseSpriteNamespace`.',
  },
  {
    id: 'sprite-namespace-spritewidth-allocation-numspritelumps',
    subject: 'spritewidth',
    cSourceLines: ['spritewidth = Z_Malloc (numspritelumps*sizeof(*spritewidth), PU_STATIC, 0);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` allocates `spritewidth` with exactly `numspritelumps` slots (no trailing guard slot, unlike `flattranslation` which is `numflats+1`). Each slot holds a `fixed_t` that the renderer indexes via `spritewidth[lump]` after subtracting `firstspritelump`. The runtime models this with `spriteTableSlotCount === numSpriteLumps`.',
  },
  {
    id: 'sprite-namespace-spriteoffset-allocation-numspritelumps',
    subject: 'spriteoffset',
    cSourceLines: ['spriteoffset = Z_Malloc (numspritelumps*sizeof(*spriteoffset), PU_STATIC, 0);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` allocates `spriteoffset` parallel to `spritewidth` with exactly `numspritelumps` `fixed_t` slots. The renderer reads `spriteoffset[lump]` to position the sprite horizontally relative to the mobj origin. The runtime models this with `spriteTableSlotCount === numSpriteLumps` shared across all three parallel arrays.',
  },
  {
    id: 'sprite-namespace-spritetopoffset-allocation-numspritelumps',
    subject: 'spritetopoffset',
    cSourceLines: ['spritetopoffset = Z_Malloc (numspritelumps*sizeof(*spritetopoffset), PU_STATIC, 0);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` allocates `spritetopoffset` parallel to `spritewidth` and `spriteoffset` with exactly `numspritelumps` `fixed_t` slots. The renderer reads `spritetopoffset[lump]` to position the sprite vertically relative to the mobj origin. The runtime models this with `spriteTableSlotCount === numSpriteLumps` shared across all three parallel arrays.',
  },
  {
    id: 'sprite-namespace-spritewidth-fixed-point-shift',
    subject: 'spritewidth',
    cSourceLines: ['spritewidth[i] = SHORT(patch->width)<<FRACBITS;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` populates `spritewidth[i]` by reading the int16-LE `patch->width` from the cached patch header and shifting it left by `FRACBITS` (=16). The result is a `fixed_t` in 16.16 format. The runtime models this with `SPRITE_FIXED_SHIFT === 16` and `spritePatchHeaderToFixed({ width })` producing `width << 16`.',
  },
  {
    id: 'sprite-namespace-spriteoffset-fixed-point-shift',
    subject: 'spriteoffset',
    cSourceLines: ['spriteoffset[i] = SHORT(patch->leftoffset)<<FRACBITS;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` populates `spriteoffset[i]` by reading the int16-LE `patch->leftoffset` from the cached patch header and shifting it left by `FRACBITS` (=16). The reference type is signed `int16_t`, so negative leftoffsets (common for centered sprites where the origin is at the patch midline) round-trip via `SHORT()` correctly. The runtime models this with `spritePatchHeaderToFixed({ leftoffset })` producing `leftoffset << 16` while preserving sign.',
  },
  {
    id: 'sprite-namespace-spritetopoffset-fixed-point-shift',
    subject: 'spritetopoffset',
    cSourceLines: ['spritetopoffset[i] = SHORT(patch->topoffset)<<FRACBITS;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` populates `spritetopoffset[i]` by reading the int16-LE `patch->topoffset` from the cached patch header and shifting it left by `FRACBITS` (=16). The reference type is signed `int16_t`. The runtime models this with `spritePatchHeaderToFixed({ topoffset })` producing `topoffset << 16` while preserving sign.',
  },
  {
    id: 'sprite-namespace-r-initspritelumps-runs-inside-r-initdata',
    subject: 'R_InitData',
    cSourceLines: ['void R_InitData (void)', '{', '    R_InitTextures ();', '    printf (".");', '    R_InitFlats ();', '    printf (".");', '    R_InitSpriteLumps ();', '    printf (".");', '    R_InitColormaps ();', '}'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitSpriteLumps` is the third step of `R_InitData`, sandwiched between `R_InitFlats` and `R_InitColormaps`. The sprite namespace MUST be ready before `R_InitSprites` walks through `firstspritelump..lastspritelump` collecting frame letters and rotations for each thing-type sprite name. The runtime models this with `parseSpriteNamespace` being a pure function over the WAD directory — independent of texture or flat state — so callers can sequence the four init steps freely.',
  },
  {
    id: 'sprite-namespace-frame-letter-decoded-at-offset-four',
    subject: 'R_InstallSpriteLump',
    cSourceLines: ["frame = lumpinfo[l]->name[4] - 'A';"],
    referenceSourceFile: 'src/doom/r_things.c',
    invariant:
      "`R_InstallSpriteLump` decodes the frame index by subtracting ASCII `'A'` (0x41) from the character at offset 4 of the sprite lump name. Frames range from 0 (letter `A`) up through whatever the highest letter in the IWAD is. The runtime models this with `SPRITE_NAME_FRAME_LETTER_OFFSET === 4` and `decodeSpriteFrameLetter(name)` returning `name.charCodeAt(4) - 0x41`.",
  },
  {
    id: 'sprite-namespace-rotation-digit-decoded-at-offset-five',
    subject: 'R_InstallSpriteLump',
    cSourceLines: ["rotation = lumpinfo[l]->name[5] - '0';"],
    referenceSourceFile: 'src/doom/r_things.c',
    invariant:
      "`R_InstallSpriteLump` decodes the rotation index by subtracting ASCII `'0'` (0x30) from the character at offset 5 of the sprite lump name. Rotation 0 means a single-sprite (non-rotated) frame; rotations 1..8 cover the eight 45-degree view directions. The runtime models this with `SPRITE_NAME_ROTATION_DIGIT_OFFSET === 5` and `decodeSpriteRotationDigit(name)` returning `name.charCodeAt(5) - 0x30`.",
  },
  {
    id: 'sprite-namespace-second-view-decoded-at-offset-six-and-seven',
    subject: 'R_InstallSpriteLump',
    cSourceLines: ['if (lumpinfo[l]->name[6])', '{', "    frame = lumpinfo[l]->name[6] - 'A';", "    rotation = lumpinfo[l]->name[7] - '0';", '    R_InstallSpriteLump (l, frame, rotation, true);', '}'],
    referenceSourceFile: 'src/doom/r_things.c',
    invariant:
      '`R_InstallSpriteLump` checks `lumpinfo[l]->name[6]` to detect a sprite frame that ships a second mirrored view in the same lump (`SARGB4B6` = SARG frame B rotation 4 / frame B rotation 6 mirrored). When the byte at offset 6 is non-zero, frame and rotation are re-decoded at offsets 6 and 7 and the lump is re-installed with `flipped=true`. The runtime models this with `SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET === 6` and `SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET === 7` and `hasSpriteSecondView(name)` returning whether the name is at least 8 characters and the 7th character is non-NUL.',
  },
  {
    id: 'sprite-namespace-installspritelump-returns-lump-minus-firstspritelump',
    subject: 'R_InstallSpriteLump',
    cSourceLines: ['sprtemp[frame].lump[r] = lump - firstspritelump;'],
    referenceSourceFile: 'src/doom/r_things.c',
    invariant:
      '`R_InstallSpriteLump` stores `lump - firstspritelump` in the `sprtemp[frame].lump[r]` slot, where `lump` is the directory index of the looked-up sprite lump and `firstspritelump` is the directory index of the first content sprite. The stored value is a zero-based sprite number relative to firstspritelump, NOT a directory index. The runtime models this with `spriteNumForLumpIndex(namespace, directoryIndex)` returning `directoryIndex - firstSpriteIndex` and rejecting indices outside the namespace.',
  },
  {
    id: 'sprite-namespace-shareware-doom1-four-hundred-eighty-three-sprites',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['firstspritelump = W_GetNumForName (DEH_String("S_START")) + 1;', 'lastspritelump = W_GetNumForName (DEH_String("S_END")) - 1;', 'numspritelumps = lastspritelump - firstspritelump + 1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` declares S_START at directory index 552 and S_END at directory index 1036. The sprite namespace therefore contains exactly `1036 - 552 - 1 = 483` entries — matching the `lumpCategories.sprite: 483` field in `reference/manifests/wad-map-summary.json`. The runtime models this with the oracle entry whose `numSpriteLumps === 483`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface SpriteNamespaceDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const SPRITE_NAMESPACE_DERIVED_INVARIANTS: readonly SpriteNamespaceDerivedInvariant[] = [
  {
    id: 'NUMSPRITELUMPS_FORMULA_EQUALS_LAST_MINUS_FIRST_PLUS_ONE',
    description: '`numSpriteLumps === lastSpriteIndex - firstSpriteIndex + 1`. Inclusive count formula proven by the upstream `numspritelumps = lastspritelump - firstspritelump + 1` line.',
  },
  {
    id: 'FIRST_SPRITE_INDEX_EQUALS_START_MARKER_PLUS_ONE',
    description: '`firstSpriteIndex === startMarkerIndex + 1`. The first content sprite sits immediately after the S_START marker.',
  },
  {
    id: 'LAST_SPRITE_INDEX_EQUALS_END_MARKER_MINUS_ONE',
    description: '`lastSpriteIndex === endMarkerIndex - 1`. The last content sprite sits immediately before the S_END marker.',
  },
  {
    id: 'SPRITE_TABLE_SLOT_COUNT_IS_NUMSPRITELUMPS',
    description: '`spriteTableSlotCount === numSpriteLumps`. Vanilla `Z_Malloc(numspritelumps*sizeof(*spritewidth))` reserves no extra slot beyond the sprite count, unlike `flattranslation` which reserves `numflats+1`.',
  },
  {
    id: 'SPRITE_FIXED_SHIFT_EQUALS_FRACBITS',
    description: '`SPRITE_FIXED_SHIFT === FRACBITS === 16`. Matches the upstream `<<FRACBITS` shift on each parallel-array population line.',
  },
  {
    id: 'PARSE_SPRITE_NAMESPACE_RETURNS_FROZEN_NAMESPACE_AND_ENTRIES',
    description: 'A successful `parseSpriteNamespace(directory)` returns an object that is `Object.isFrozen`, with a frozen `entries` array, and every entry is itself frozen.',
  },
  {
    id: 'PARSE_SPRITE_NAMESPACE_ENTRIES_LENGTH_EQUALS_NUMSPRITELUMPS',
    description: '`namespace.entries.length === namespace.numSpriteLumps`. Every directory index between (and excluding) the markers gets exactly one entry.',
  },
  {
    id: 'PARSE_SPRITE_NAMESPACE_SPRITE_NUMBERS_ARE_SEQUENTIAL',
    description: '`namespace.entries[i].spriteNumber === i` for every `i` in `[0, numSpriteLumps)`. Matches the upstream `lump - firstspritelump` formula evaluated at every entry.',
  },
  {
    id: 'PARSE_SPRITE_NAMESPACE_DIRECTORY_INDEX_EQUALS_FIRSTSPRITELUMP_PLUS_SPRITENUMBER',
    description:
      '`namespace.entries[i].directoryIndex === namespace.firstSpriteIndex + i`. Matches the upstream `firstspritelump + spriteNumber` index used by `R_InstallSpriteLump` (`patch = W_CacheLumpNum(vis->patch+firstspritelump, PU_CACHE)`).',
  },
  {
    id: 'PARSE_SPRITE_NAMESPACE_REJECTS_MISSING_S_START',
    description: '`parseSpriteNamespace(directoryWithoutSStart)` throws an `Error` whose message names `S_START`.',
  },
  {
    id: 'PARSE_SPRITE_NAMESPACE_REJECTS_MISSING_S_END',
    description: '`parseSpriteNamespace(directoryWithoutSEnd)` throws an `Error` whose message names `S_END`.',
  },
  {
    id: 'PARSE_SPRITE_NAMESPACE_REJECTS_END_BEFORE_START',
    description: '`parseSpriteNamespace(directoryWithEndBeforeStart)` throws an `Error` because vanilla `R_InitSpriteLumps` would underflow `numspritelumps` and corrupt the heap.',
  },
  {
    id: 'SPRITE_NUM_FOR_LUMP_INDEX_RETURNS_DIRECTORY_INDEX_MINUS_FIRSTSPRITELUMP',
    description: '`spriteNumForLumpIndex(namespace, directoryIndex) === directoryIndex - namespace.firstSpriteIndex`. Matches the upstream `lump - firstspritelump` formula in `R_InstallSpriteLump`.',
  },
  {
    id: 'SPRITE_NUM_FOR_LUMP_INDEX_THROWS_ON_OUT_OF_RANGE',
    description:
      '`spriteNumForLumpIndex(namespace, outOfRange)` throws an `Error`. Out-of-range directory indices would cause `R_InstallSpriteLump` to write to a `sprtemp` slot derived from a negative or oversized sprite number, scribbling on the heap.',
  },
  {
    id: 'DECODE_SPRITE_FRAME_LETTER_RETURNS_NAME_OFFSET_FOUR_MINUS_A',
    description: "`decodeSpriteFrameLetter(name) === name.charCodeAt(4) - 0x41`. Matches the upstream `frame = lumpinfo[l]->name[4] - 'A';` line.",
  },
  {
    id: 'DECODE_SPRITE_ROTATION_DIGIT_RETURNS_NAME_OFFSET_FIVE_MINUS_ZERO',
    description: "`decodeSpriteRotationDigit(name) === name.charCodeAt(5) - 0x30`. Matches the upstream `rotation = lumpinfo[l]->name[5] - '0';` line.",
  },
  {
    id: 'HAS_SPRITE_SECOND_VIEW_REQUIRES_NAME_LENGTH_EIGHT_AND_NON_NUL_OFFSET_SIX',
    description: '`hasSpriteSecondView(name)` returns true iff `name.length >= 8` and `name.charCodeAt(6) !== 0`. Matches the upstream `if (lumpinfo[l]->name[6]) { ... }` check.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Bit shift applied to int16-LE patch header fields to produce vanilla `fixed_t` (`<<FRACBITS`). */
export const SPRITE_FIXED_SHIFT = FRACBITS;

/** Byte offset of the frame letter inside the sprite lump name (`name[4] - 'A'`). */
export const SPRITE_NAME_FRAME_LETTER_OFFSET = 4;

/** Byte offset of the rotation digit inside the sprite lump name (`name[5] - '0'`). */
export const SPRITE_NAME_ROTATION_DIGIT_OFFSET = 5;

/** Byte offset of the optional second-view frame letter inside the sprite lump name (`name[6] - 'A'`). */
export const SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET = 6;

/** Byte offset of the optional second-view rotation digit inside the sprite lump name (`name[7] - '0'`). */
export const SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET = 7;

/** ASCII code point of the letter `A`, the base from which frame letters are decoded (`name[4] - 'A'`). */
export const SPRITE_NAME_FRAME_LETTER_BASE_CHARCODE = 0x41;

/** ASCII code point of the digit `0`, the base from which rotation digits are decoded (`name[5] - '0'`). */
export const SPRITE_NAME_ROTATION_DIGIT_BASE_CHARCODE = 0x30;

/** A single entry in the sprite namespace. */
export interface SpriteNamespaceEntry {
  /** Lump name (uppercase, null-stripped). */
  readonly name: string;
  /** Zero-based index in the WAD directory. */
  readonly directoryIndex: number;
  /** Sprite number relative to firstspritelump (`directoryIndex - firstSpriteIndex`). */
  readonly spriteNumber: number;
}

/** Resolved sprite namespace. */
export interface SpriteNamespace {
  /** Directory index of the S_START marker. */
  readonly startMarkerIndex: number;
  /** Directory index of the S_END marker. */
  readonly endMarkerIndex: number;
  /** Directory index of the first content sprite (`startMarkerIndex + 1`). */
  readonly firstSpriteIndex: number;
  /** Directory index of the last content sprite (`endMarkerIndex - 1`). */
  readonly lastSpriteIndex: number;
  /** Inclusive sprite count (`lastSpriteIndex - firstSpriteIndex + 1`). */
  readonly numSpriteLumps: number;
  /** Number of slots vanilla allocates for each of `spritewidth` / `spriteoffset` / `spritetopoffset` (`numSpriteLumps`). */
  readonly spriteTableSlotCount: number;
  /** Frozen array of `numSpriteLumps` entries, in directory order. */
  readonly entries: readonly SpriteNamespaceEntry[];
}

function findLastIndexByName(directory: readonly DirectoryEntry[], target: string): number {
  let foundIndex = -1;
  for (let i = 0; i < directory.length; i += 1) {
    if (directory[i]!.name.toUpperCase() === target) {
      foundIndex = i;
    }
  }
  return foundIndex;
}

/**
 * Parse the sprite namespace from a WAD directory.
 *
 * Resolves the S_START / S_END marker range using vanilla
 * `R_InitSpriteLumps` arithmetic (`firstspritelump =
 * W_GetNumForName("S_START") + 1`, `lastspritelump =
 * W_GetNumForName("S_END") - 1`, `numspritelumps = lastspritelump -
 * firstspritelump + 1`) and assigns each directory entry between the
 * markers a sequential sprite number starting at zero. Unlike the flat
 * namespace, the sprite namespace contains no inner sub-markers in
 * vanilla DOOM 1.9 — every directory entry between S_START and S_END
 * is a content sprite lump.
 *
 * @param directory - Parsed WAD directory entries.
 * @returns Frozen {@link SpriteNamespace}.
 * @throws {Error} If `S_START` or `S_END` markers are missing or if
 *   `S_END` does not strictly follow `S_START`.
 */
export function parseSpriteNamespace(directory: readonly DirectoryEntry[]): SpriteNamespace {
  const startMarkerIndex = findLastIndexByName(directory, 'S_START');
  if (startMarkerIndex === -1) {
    throw new Error('parseSpriteNamespace: S_START marker not found in WAD directory');
  }
  const endMarkerIndex = findLastIndexByName(directory, 'S_END');
  if (endMarkerIndex === -1) {
    throw new Error('parseSpriteNamespace: S_END marker not found in WAD directory');
  }
  if (endMarkerIndex <= startMarkerIndex) {
    throw new Error(`parseSpriteNamespace: S_END at index ${endMarkerIndex} must strictly follow S_START at index ${startMarkerIndex}`);
  }

  const firstSpriteIndex = startMarkerIndex + 1;
  const lastSpriteIndex = endMarkerIndex - 1;
  const numSpriteLumps = lastSpriteIndex - firstSpriteIndex + 1;
  const spriteTableSlotCount = numSpriteLumps;

  const entries: SpriteNamespaceEntry[] = new Array(numSpriteLumps);
  for (let spriteNumber = 0; spriteNumber < numSpriteLumps; spriteNumber += 1) {
    const directoryIndex = firstSpriteIndex + spriteNumber;
    const directoryEntry = directory[directoryIndex]!;
    entries[spriteNumber] = Object.freeze({
      name: directoryEntry.name,
      directoryIndex,
      spriteNumber,
    });
  }

  return Object.freeze({
    startMarkerIndex,
    endMarkerIndex,
    firstSpriteIndex,
    lastSpriteIndex,
    numSpriteLumps,
    spriteTableSlotCount,
    entries: Object.freeze(entries),
  });
}

/**
 * Resolve a directory index inside the sprite namespace to its
 * zero-based sprite number relative to `firstSpriteIndex`.
 *
 * Mirrors vanilla `R_InstallSpriteLump`'s `lump - firstspritelump`
 * formula: the renderer indexes `spritewidth[spriteNumber]` /
 * `spriteoffset[spriteNumber]` / `spritetopoffset[spriteNumber]` after
 * subtracting `firstspritelump` from the directory index.
 *
 * @param namespace - Resolved sprite namespace from {@link parseSpriteNamespace}.
 * @param directoryIndex - WAD directory index of the sprite lump.
 * @returns Zero-based sprite number relative to firstspritelump.
 * @throws {RangeError} If the directory index falls outside `[firstSpriteIndex, lastSpriteIndex]`.
 */
export function spriteNumForLumpIndex(namespace: SpriteNamespace, directoryIndex: number): number {
  if (directoryIndex < namespace.firstSpriteIndex || directoryIndex > namespace.lastSpriteIndex) {
    throw new RangeError(`spriteNumForLumpIndex: directory index ${directoryIndex} is outside the sprite namespace [${namespace.firstSpriteIndex}, ${namespace.lastSpriteIndex}]`);
  }
  return directoryIndex - namespace.firstSpriteIndex;
}

/**
 * Decode the frame letter at offset 4 of a sprite lump name into the
 * zero-based frame index used as the `frame` argument of
 * `R_InstallSpriteLump`.
 *
 * Mirrors vanilla `frame = lumpinfo[l]->name[4] - 'A';`. Returns
 * negative values for names whose offset-4 character is below `'A'`,
 * matching the upstream signed subtraction (vanilla simply trusts that
 * sprite names follow the convention).
 *
 * @param name - Sprite lump name (must be at least 5 characters long).
 * @returns Zero-based frame index (0 for letter `A`, 1 for `B`, ...).
 * @throws {RangeError} If the name is shorter than 5 characters.
 */
export function decodeSpriteFrameLetter(name: string): number {
  if (name.length <= SPRITE_NAME_FRAME_LETTER_OFFSET) {
    throw new RangeError(`decodeSpriteFrameLetter: sprite name ${JSON.stringify(name)} must be at least ${SPRITE_NAME_FRAME_LETTER_OFFSET + 1} characters long`);
  }
  return name.charCodeAt(SPRITE_NAME_FRAME_LETTER_OFFSET) - SPRITE_NAME_FRAME_LETTER_BASE_CHARCODE;
}

/**
 * Decode the rotation digit at offset 5 of a sprite lump name into the
 * zero-based rotation index used as the `rotation` argument of
 * `R_InstallSpriteLump`.
 *
 * Mirrors vanilla `rotation = lumpinfo[l]->name[5] - '0';`. Returns 0
 * for the special "non-rotated single sprite" frame and 1..8 for the
 * eight 45-degree views.
 *
 * @param name - Sprite lump name (must be at least 6 characters long).
 * @returns Zero-based rotation index (0..8 in well-formed IWADs).
 * @throws {RangeError} If the name is shorter than 6 characters.
 */
export function decodeSpriteRotationDigit(name: string): number {
  if (name.length <= SPRITE_NAME_ROTATION_DIGIT_OFFSET) {
    throw new RangeError(`decodeSpriteRotationDigit: sprite name ${JSON.stringify(name)} must be at least ${SPRITE_NAME_ROTATION_DIGIT_OFFSET + 1} characters long`);
  }
  return name.charCodeAt(SPRITE_NAME_ROTATION_DIGIT_OFFSET) - SPRITE_NAME_ROTATION_DIGIT_BASE_CHARCODE;
}

/**
 * Detect whether a sprite lump name encodes a second mirrored view
 * (e.g. `SARGB4B6` carries SARG frame B rotation 4 and frame B
 * rotation 6 in a single lump).
 *
 * Mirrors vanilla `if (lumpinfo[l]->name[6]) { ... }`: vanilla treats a
 * non-NUL byte at offset 6 as the indicator that offsets 6 and 7 carry
 * a second-view frame letter and rotation digit. The runtime requires
 * the name to be at least 8 characters long because shorter names
 * (NUL-terminated by `W_HashLumpName` in vanilla) cannot legally hold
 * the second-view bytes.
 *
 * @param name - Sprite lump name.
 * @returns `true` iff `name.length >= 8` and `name.charCodeAt(6) !== 0`.
 */
export function hasSpriteSecondView(name: string): boolean {
  return name.length >= SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET + 1 && name.charCodeAt(SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET) !== 0;
}

/**
 * Decode the second-view frame letter at offset 6 of a sprite lump
 * name. Only meaningful when {@link hasSpriteSecondView} returns true.
 *
 * Mirrors vanilla `frame = lumpinfo[l]->name[6] - 'A';`.
 *
 * @param name - Sprite lump name (must be at least 7 characters long).
 * @returns Zero-based frame index of the second view.
 * @throws {RangeError} If the name is shorter than 7 characters.
 */
export function decodeSpriteSecondViewFrameLetter(name: string): number {
  if (name.length <= SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET) {
    throw new RangeError(`decodeSpriteSecondViewFrameLetter: sprite name ${JSON.stringify(name)} must be at least ${SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET + 1} characters long`);
  }
  return name.charCodeAt(SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET) - SPRITE_NAME_FRAME_LETTER_BASE_CHARCODE;
}

/**
 * Decode the second-view rotation digit at offset 7 of a sprite lump
 * name. Only meaningful when {@link hasSpriteSecondView} returns true.
 *
 * Mirrors vanilla `rotation = lumpinfo[l]->name[7] - '0';`.
 *
 * @param name - Sprite lump name (must be at least 8 characters long).
 * @returns Zero-based rotation index of the second view.
 * @throws {RangeError} If the name is shorter than 8 characters.
 */
export function decodeSpriteSecondViewRotationDigit(name: string): number {
  if (name.length <= SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET) {
    throw new RangeError(`decodeSpriteSecondViewRotationDigit: sprite name ${JSON.stringify(name)} must be at least ${SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET + 1} characters long`);
  }
  return name.charCodeAt(SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET) - SPRITE_NAME_ROTATION_DIGIT_BASE_CHARCODE;
}

/** Raw int16-LE patch header fields read from a sprite lump (matches `patch->width`, `patch->leftoffset`, `patch->topoffset`). */
export interface SpritePatchHeaderRaw {
  /** Signed `int16_t` width from the patch header at offset 0. */
  readonly width: number;
  /** Signed `int16_t` height from the patch header at offset 2 (not pinned by `R_InitSpriteLumps` but exposed for completeness). */
  readonly height: number;
  /** Signed `int16_t` leftoffset from the patch header at offset 4. */
  readonly leftoffset: number;
  /** Signed `int16_t` topoffset from the patch header at offset 6. */
  readonly topoffset: number;
}

/** Fixed-point sprite metadata produced by `<<FRACBITS` shifts, matching the runtime parallel arrays. */
export interface SpritePatchHeaderFixed {
  /** `width << FRACBITS` (`spritewidth[i]` slot value). */
  readonly spriteWidth: Fixed;
  /** `leftoffset << FRACBITS` (`spriteoffset[i]` slot value). */
  readonly spriteOffset: Fixed;
  /** `topoffset << FRACBITS` (`spritetopoffset[i]` slot value). */
  readonly spriteTopoffset: Fixed;
}

/**
 * Convert raw int16-LE patch header fields into vanilla `fixed_t` parallel-array values.
 *
 * Mirrors the upstream three lines:
 *   `spritewidth[i] = SHORT(patch->width)<<FRACBITS;`
 *   `spriteoffset[i] = SHORT(patch->leftoffset)<<FRACBITS;`
 *   `spritetopoffset[i] = SHORT(patch->topoffset)<<FRACBITS;`
 *
 * Negative leftoffset / topoffset values (common for centered sprites
 * like CHGGA0 with leftoffset = -104) round-trip via JavaScript's
 * signed left shift on values that fit within 16 bits.
 *
 * @param raw - Decoded {@link SpritePatchHeaderRaw} fields.
 * @returns Fixed-point sprite metadata for the parallel arrays.
 */
export function spritePatchHeaderToFixed(raw: SpritePatchHeaderRaw): SpritePatchHeaderFixed {
  return Object.freeze({
    spriteWidth: (raw.width << SPRITE_FIXED_SHIFT) as Fixed,
    spriteOffset: (raw.leftoffset << SPRITE_FIXED_SHIFT) as Fixed,
    spriteTopoffset: (raw.topoffset << SPRITE_FIXED_SHIFT) as Fixed,
  });
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-sprite-namespace.ts`. The cross-check helper
 * consumes this shape so the focused test can both verify the live
 * runtime exports and exercise a deliberately tampered snapshot to
 * prove the failure modes are observable.
 */
export interface SpriteNamespaceRuntimeSnapshot {
  /** `SPRITE_FIXED_SHIFT` exported by this module. */
  readonly spriteFixedShift: number;
  /** `parseSpriteNamespace(liveDirectory).numSpriteLumps`. */
  readonly numSpriteLumps: number;
  /** `parseSpriteNamespace(liveDirectory).firstSpriteIndex`. */
  readonly firstSpriteIndex: number;
  /** `parseSpriteNamespace(liveDirectory).lastSpriteIndex`. */
  readonly lastSpriteIndex: number;
  /** `parseSpriteNamespace(liveDirectory).startMarkerIndex`. */
  readonly startMarkerIndex: number;
  /** `parseSpriteNamespace(liveDirectory).endMarkerIndex`. */
  readonly endMarkerIndex: number;
  /** `parseSpriteNamespace(liveDirectory).spriteTableSlotCount`. */
  readonly spriteTableSlotCount: number;
  /** Whether the live `parseSpriteNamespace` return value is frozen at every level. */
  readonly parserReturnsFullyFrozen: boolean;
  /** Whether `entries[i].spriteNumber === i` for every `i` in `[0, numSpriteLumps)`. */
  readonly spriteNumbersAreSequential: boolean;
  /** Whether `entries[i].directoryIndex === firstSpriteIndex + i` for every `i`. */
  readonly directoryIndicesAreFirstSpriteIndexPlusSpriteNumber: boolean;
  /** Whether `parseSpriteNamespace(noSStart)` throws an error mentioning S_START. */
  readonly parserRejectsMissingSStart: boolean;
  /** Whether `parseSpriteNamespace(noSEnd)` throws an error mentioning S_END. */
  readonly parserRejectsMissingSEnd: boolean;
  /** Whether `parseSpriteNamespace(endBeforeStart)` throws an error. */
  readonly parserRejectsEndBeforeStart: boolean;
  /** Whether `spriteNumForLumpIndex(namespace, firstSpriteIndex + 5)` returns 5. */
  readonly spriteNumForLumpIndexReturnsExpectedSpriteNumber: boolean;
  /** Whether `spriteNumForLumpIndex(namespace, outOfRangeIndex)` throws. */
  readonly spriteNumForLumpIndexThrowsOnOutOfRange: boolean;
  /** Whether `decodeSpriteFrameLetter("XXXXA0") === 0` (and 1 for letter B, 2 for C). */
  readonly decodeSpriteFrameLetterReturnsNameOffsetFourMinusA: boolean;
  /** Whether `decodeSpriteRotationDigit("XXXXA0") === 0` (and 1 for digit 1, 8 for digit 8). */
  readonly decodeSpriteRotationDigitReturnsNameOffsetFiveMinusZero: boolean;
  /** Whether `hasSpriteSecondView` returns true exactly when name length >= 8 and offset 6 is non-NUL. */
  readonly hasSpriteSecondViewReturnsTrueOnLengthEightAndNonNulOffsetSix: boolean;
}

/**
 * Cross-check a `SpriteNamespaceRuntimeSnapshot` against
 * `SPRITE_NAMESPACE_AUDIT` and `SPRITE_NAMESPACE_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckSpriteNamespaceRuntime(snapshot: SpriteNamespaceRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.numSpriteLumps !== snapshot.lastSpriteIndex - snapshot.firstSpriteIndex + 1) {
    failures.push('derived:NUMSPRITELUMPS_FORMULA_EQUALS_LAST_MINUS_FIRST_PLUS_ONE');
    failures.push('audit:sprite-namespace-numspritelumps-formula:not-observed');
  }

  if (snapshot.firstSpriteIndex !== snapshot.startMarkerIndex + 1) {
    failures.push('derived:FIRST_SPRITE_INDEX_EQUALS_START_MARKER_PLUS_ONE');
    failures.push('audit:sprite-namespace-firstspritelump-formula:not-observed');
  }

  if (snapshot.lastSpriteIndex !== snapshot.endMarkerIndex - 1) {
    failures.push('derived:LAST_SPRITE_INDEX_EQUALS_END_MARKER_MINUS_ONE');
    failures.push('audit:sprite-namespace-lastspritelump-formula:not-observed');
  }

  if (snapshot.spriteTableSlotCount !== snapshot.numSpriteLumps) {
    failures.push('derived:SPRITE_TABLE_SLOT_COUNT_IS_NUMSPRITELUMPS');
    failures.push('audit:sprite-namespace-spritewidth-allocation-numspritelumps:not-observed');
    failures.push('audit:sprite-namespace-spriteoffset-allocation-numspritelumps:not-observed');
    failures.push('audit:sprite-namespace-spritetopoffset-allocation-numspritelumps:not-observed');
  }

  if (snapshot.spriteFixedShift !== 16) {
    failures.push('derived:SPRITE_FIXED_SHIFT_EQUALS_FRACBITS');
    failures.push('audit:sprite-namespace-spritewidth-fixed-point-shift:not-observed');
    failures.push('audit:sprite-namespace-spriteoffset-fixed-point-shift:not-observed');
    failures.push('audit:sprite-namespace-spritetopoffset-fixed-point-shift:not-observed');
  }

  if (!snapshot.parserReturnsFullyFrozen) {
    failures.push('derived:PARSE_SPRITE_NAMESPACE_RETURNS_FROZEN_NAMESPACE_AND_ENTRIES');
    failures.push('audit:sprite-namespace-r-initspritelumps-runs-inside-r-initdata:not-observed');
  }

  if (!snapshot.spriteNumbersAreSequential) {
    failures.push('derived:PARSE_SPRITE_NAMESPACE_SPRITE_NUMBERS_ARE_SEQUENTIAL');
    failures.push('audit:sprite-namespace-installspritelump-returns-lump-minus-firstspritelump:not-observed');
  }

  if (!snapshot.directoryIndicesAreFirstSpriteIndexPlusSpriteNumber) {
    failures.push('derived:PARSE_SPRITE_NAMESPACE_DIRECTORY_INDEX_EQUALS_FIRSTSPRITELUMP_PLUS_SPRITENUMBER');
  }

  if (!snapshot.parserRejectsMissingSStart) {
    failures.push('derived:PARSE_SPRITE_NAMESPACE_REJECTS_MISSING_S_START');
  }

  if (!snapshot.parserRejectsMissingSEnd) {
    failures.push('derived:PARSE_SPRITE_NAMESPACE_REJECTS_MISSING_S_END');
  }

  if (!snapshot.parserRejectsEndBeforeStart) {
    failures.push('derived:PARSE_SPRITE_NAMESPACE_REJECTS_END_BEFORE_START');
  }

  if (!snapshot.spriteNumForLumpIndexReturnsExpectedSpriteNumber) {
    failures.push('derived:SPRITE_NUM_FOR_LUMP_INDEX_RETURNS_DIRECTORY_INDEX_MINUS_FIRSTSPRITELUMP');
    failures.push('audit:sprite-namespace-installspritelump-returns-lump-minus-firstspritelump:not-observed');
  }

  if (!snapshot.spriteNumForLumpIndexThrowsOnOutOfRange) {
    failures.push('derived:SPRITE_NUM_FOR_LUMP_INDEX_THROWS_ON_OUT_OF_RANGE');
  }

  if (!snapshot.decodeSpriteFrameLetterReturnsNameOffsetFourMinusA) {
    failures.push('derived:DECODE_SPRITE_FRAME_LETTER_RETURNS_NAME_OFFSET_FOUR_MINUS_A');
    failures.push('audit:sprite-namespace-frame-letter-decoded-at-offset-four:not-observed');
  }

  if (!snapshot.decodeSpriteRotationDigitReturnsNameOffsetFiveMinusZero) {
    failures.push('derived:DECODE_SPRITE_ROTATION_DIGIT_RETURNS_NAME_OFFSET_FIVE_MINUS_ZERO');
    failures.push('audit:sprite-namespace-rotation-digit-decoded-at-offset-five:not-observed');
  }

  if (!snapshot.hasSpriteSecondViewReturnsTrueOnLengthEightAndNonNulOffsetSix) {
    failures.push('derived:HAS_SPRITE_SECOND_VIEW_REQUIRES_NAME_LENGTH_EIGHT_AND_NON_NUL_OFFSET_SIX');
    failures.push('audit:sprite-namespace-second-view-decoded-at-offset-six-and-seven:not-observed');
  }

  const declaredAxes = new Set(SPRITE_NAMESPACE_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<SpriteNamespaceAuditEntry['id']> = [
    'sprite-namespace-firstspritelump-formula',
    'sprite-namespace-lastspritelump-formula',
    'sprite-namespace-numspritelumps-formula',
    'sprite-namespace-spritewidth-allocation-numspritelumps',
    'sprite-namespace-spriteoffset-allocation-numspritelumps',
    'sprite-namespace-spritetopoffset-allocation-numspritelumps',
    'sprite-namespace-spritewidth-fixed-point-shift',
    'sprite-namespace-spriteoffset-fixed-point-shift',
    'sprite-namespace-spritetopoffset-fixed-point-shift',
    'sprite-namespace-r-initspritelumps-runs-inside-r-initdata',
    'sprite-namespace-frame-letter-decoded-at-offset-four',
    'sprite-namespace-rotation-digit-decoded-at-offset-five',
    'sprite-namespace-second-view-decoded-at-offset-six-and-seven',
    'sprite-namespace-installspritelump-returns-lump-minus-firstspritelump',
    'sprite-namespace-shareware-doom1-four-hundred-eighty-three-sprites',
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
 * Pinned facts about a single named sprite frame inside the shareware
 * `doom/DOOM1.WAD` sprite namespace that the focused test cross-checks
 * against the live on-disk file. Each pinned entry covers the full
 * `R_InitSpriteLumps` read path: directory placement, file offset, raw
 * patch header fields (width, leftoffset, topoffset), and a SHA-256
 * fingerprint of the lump bytes.
 */
export interface ShareWareDoom1WadSpriteOracleEntry {
  /** Sprite lump name (uppercase, NUL-stripped). */
  readonly name: string;
  /** Directory index of the sprite lump in the live IWAD directory. */
  readonly directoryIndex: number;
  /** Zero-based sprite number relative to firstspritelump. */
  readonly spriteNumber: number;
  /** Byte offset of the sprite lump inside the WAD file. */
  readonly fileOffset: number;
  /** Byte size of the sprite lump (the patch picture format including all column posts). */
  readonly size: number;
  /** SHA-256 hex digest of the sprite lump bytes (lower-case, 64 chars). */
  readonly sha256: string;
  /** Raw int16-LE `patch->width` field at offset 0 of the sprite lump. */
  readonly patchWidth: number;
  /** Raw int16-LE `patch->leftoffset` field at offset 4 of the sprite lump. */
  readonly patchLeftoffset: number;
  /** Raw int16-LE `patch->topoffset` field at offset 6 of the sprite lump. */
  readonly patchTopoffset: number;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` sprite namespace structure. */
export interface ShareWareDoom1WadSpriteNamespaceOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Directory index of the S_START marker. */
  readonly startMarkerIndex: 552;
  /** Directory index of the S_END marker. */
  readonly endMarkerIndex: 1036;
  /** Directory index of the first content sprite (`startMarkerIndex + 1`). */
  readonly firstSpriteIndex: 553;
  /** Directory index of the last content sprite (`endMarkerIndex - 1`). */
  readonly lastSpriteIndex: 1035;
  /** Total sprite lump count between the markers (matches `lumpCategories.sprite` in the manifest). */
  readonly numSpriteLumps: 483;
  /** Pinned named sprite frames with directory indices, sprite numbers, raw patch header fields, and SHA-256 fingerprints. */
  readonly pinnedSprites: readonly ShareWareDoom1WadSpriteOracleEntry[];
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` sprite namespace.
 *
 * The pinned sprite probes were captured by hand from the live IWAD
 * (`probe-sprites.ts`) and cover six points of the namespace:
 *  - CHGGA0 (sprite 0): the very first content sprite in the
 *    namespace; carries large negative leftoffset and topoffset
 *    (-104 / -117) which prove the parallel-array fixed-point shift
 *    preserves int16 sign.
 *  - SARGB4B6 (sprite 99): the second-view encoding example (frame B
 *    rotation 4 / frame B rotation 6 mirrored in a single lump);
 *    exercises the `name[6] != 0` second-view detection.
 *  - TROOA1 (sprite 149): an early single-view sprite (Imp / Trooper)
 *    used to ground the first-rotation lookup formula.
 *  - BOSSH4 (sprite 249): a mid-range entry on a different page of
 *    the lump; doubles the stride coverage.
 *  - PLAYA1 (sprite 272): the player sprite; pinning the sprite
 *    number proves vanilla's sprite-number-by-name lookup formula.
 *  - TREDD0 (sprite 482): the very last content sprite (TREDD0 =
 *    "tree death" frame D rotation 0); proves the loop reads exactly
 *    `numspritelumps` entries, no more and no fewer.
 *
 * The sha-256 fingerprints freeze the exact byte content of each
 * sprite lump at the time of audit; any IWAD-modifying change that
 * does not also update the audit will surface as an oracle mismatch
 * and reject the change.
 */
export const SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE: ShareWareDoom1WadSpriteNamespaceOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  startMarkerIndex: 552,
  endMarkerIndex: 1036,
  firstSpriteIndex: 553,
  lastSpriteIndex: 1035,
  numSpriteLumps: 483,
  pinnedSprites: Object.freeze([
    Object.freeze({
      name: 'CHGGA0',
      directoryIndex: 553,
      spriteNumber: 0,
      fileOffset: 2365424,
      size: 8180,
      sha256: '1f53044d7a056b70b86d5f3f8c331ab58e50729ece791dab4a103701f227d3a5',
      patchWidth: 114,
      patchLeftoffset: -104,
      patchTopoffset: -117,
    }),
    Object.freeze({
      name: 'SARGB4B6',
      directoryIndex: 652,
      spriteNumber: 99,
      fileOffset: 2594868,
      size: 2056,
      sha256: '0b04355c51d305f55e4e7ac109fc0e4b5e5afaa60a84826c436785cdd8d4c97b',
      patchWidth: 53,
      patchLeftoffset: 30,
      patchTopoffset: 51,
    }),
    Object.freeze({
      name: 'TROOA1',
      directoryIndex: 702,
      spriteNumber: 149,
      fileOffset: 2698716,
      size: 1632,
      sha256: '5e44743944db89f3ee0f9bf48233e517a5b43ce4efa9d886c83b1d844b0cfd74',
      patchWidth: 41,
      patchLeftoffset: 19,
      patchTopoffset: 52,
    }),
    Object.freeze({
      name: 'BOSSH4',
      directoryIndex: 802,
      spriteNumber: 249,
      fileOffset: 2889228,
      size: 2324,
      sha256: '777921cebd9cf488e530418e24a655141ff697e82fdd62d5a442078eabc6b752',
      patchWidth: 49,
      patchLeftoffset: 26,
      patchTopoffset: 64,
    }),
    Object.freeze({
      name: 'PLAYA1',
      directoryIndex: 825,
      spriteNumber: 272,
      fileOffset: 2924644,
      size: 1420,
      sha256: 'eac246b71f9f62fc136fad6afa794c757e7e3a4253c2c650fb2b62d2a04d0dbe',
      patchWidth: 41,
      patchLeftoffset: 18,
      patchTopoffset: 51,
    }),
    Object.freeze({
      name: 'TREDD0',
      directoryIndex: 1035,
      spriteNumber: 482,
      fileOffset: 3189912,
      size: 1088,
      sha256: '37a6b707b9f0d8f287c0b710619ba04b27f47c9e7dcadae3c44e18aa3dce87ee',
      patchWidth: 26,
      patchLeftoffset: 14,
      patchTopoffset: 93,
    }),
  ]) as readonly ShareWareDoom1WadSpriteOracleEntry[],
}) as ShareWareDoom1WadSpriteNamespaceOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * sprite namespace so the focused test can re-derive the values from
 * the live file every run and feed the result into the cross-check.
 */
export interface ShareWareDoom1WadSpriteNamespaceSample {
  readonly startMarkerIndex: number;
  readonly endMarkerIndex: number;
  readonly firstSpriteIndex: number;
  readonly lastSpriteIndex: number;
  readonly numSpriteLumps: number;
  readonly pinnedSprites: readonly {
    readonly name: string;
    readonly directoryIndex: number;
    readonly spriteNumber: number;
    readonly fileOffset: number;
    readonly size: number;
    readonly sha256: string;
    readonly patchWidth: number;
    readonly patchLeftoffset: number;
    readonly patchTopoffset: number;
  }[];
}

/**
 * Cross-check a shareware DOOM1.WAD sprite namespace sample against
 * the pinned oracle. Returns the list of failures by stable
 * identifier; an empty list means the live namespace matches the
 * oracle byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:sprite:<name>:not-found` when the sample is missing a
 *    pinned named sprite.
 *  - `oracle:sprite:<name>:<field>:value-mismatch` for any oracle field
 *    on a pinned named sprite whose live counterpart disagrees.
 */
export function crossCheckShareWareDoom1WadSpriteNamespaceSample(sample: ShareWareDoom1WadSpriteNamespaceSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'startMarkerIndex' | 'endMarkerIndex' | 'firstSpriteIndex' | 'lastSpriteIndex' | 'numSpriteLumps'> = ['startMarkerIndex', 'endMarkerIndex', 'firstSpriteIndex', 'lastSpriteIndex', 'numSpriteLumps'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  for (const oracleSprite of SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.pinnedSprites) {
    const liveSprite = sample.pinnedSprites.find((entry) => entry.name === oracleSprite.name);
    if (!liveSprite) {
      failures.push(`oracle:sprite:${oracleSprite.name}:not-found`);
      continue;
    }
    const fields: ReadonlyArray<'directoryIndex' | 'spriteNumber' | 'fileOffset' | 'size' | 'sha256' | 'patchWidth' | 'patchLeftoffset' | 'patchTopoffset'> = [
      'directoryIndex',
      'spriteNumber',
      'fileOffset',
      'size',
      'sha256',
      'patchWidth',
      'patchLeftoffset',
      'patchTopoffset',
    ];
    for (const field of fields) {
      if (liveSprite[field] !== oracleSprite[field]) {
        failures.push(`oracle:sprite:${oracleSprite.name}:${field}:value-mismatch`);
      }
    }
  }

  return failures;
}
