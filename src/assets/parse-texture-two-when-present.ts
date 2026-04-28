/**
 * Audit ledger and runtime parser for the optional vanilla DOOM 1.9
 * TEXTURE2 lump. Where TEXTURE1 (audited by 05-009 in
 * `src/assets/parse-texture-one-lump.ts`) is mandatory in every IWAD,
 * TEXTURE2 is conditional: registered DOOM 1.9 and Ultimate DOOM bundle
 * a second TEXTURE2 sibling that extends the texture namespace, while
 * the shareware `doom/DOOM1.WAD` ships only TEXTURE1 and takes the
 * `else` branch in `R_InitTextures` that zeroes out `numtextures2` and
 * leaves `maxoff2` at zero.
 *
 * This module pins the runtime contract that:
 *   1. the parser MUST treat the TEXTURE2 lump as optional, mirroring
 *      the `if (W_CheckNumForName(DEH_String("TEXTURE2")) != -1)` probe
 *      that vanilla performs before caching the lump,
 *   2. when absent, the parser MUST report zero TEXTURE2 textures and
 *      not load any bytes (mirroring `maptex2 = NULL; numtextures2 = 0;
 *      maxoff2 = 0;`),
 *   3. when present, the parser MUST decode the lump using the same
 *      byte format as TEXTURE1 (the same 4-byte little-endian count
 *      header at offset 0, the same 4-byte directory entries, the same
 *      22-byte `maptexture_t` header, the same 10-byte `mappatch_t`
 *      stride, and the same `if (offset > maxoff) I_Error("...")`
 *      bounds check),
 *   4. the runtime aggregates `numtextures = numtextures1 +
 *      numtextures2` so that texture lookup indices for TEXTURE2 entries
 *      shift to the contiguous range `[numtextures1,
 *      numtextures1 + numtextures2)`.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/doom/r_data.c`,
 *      `src/doom/w_wad.c`, `src/doom/p_setup.c`).
 *
 * The format and conditional declarations below are pinned against
 * authority 5 because the conditional probe, the else-branch zeroing,
 * the byte format equivalence, and the `numtextures1 + numtextures2`
 * aggregation are textual properties of the `R_InitTextures` body in
 * the upstream C source. The shareware `DOOM1.WAD` "no TEXTURE2"
 * oracle fact is pinned against authority 2 — the local IWAD itself —
 * and re-derived from the on-disk file every test run so an IWAD
 * swap that accidentally introduces a TEXTURE2 lump surfaces as an
 * oracle mismatch.
 */

import { BinaryReader } from '../core/binaryReader.ts';
import { TEXTURE_ONE_DIRECTORY_ENTRY_BYTES, TEXTURE_ONE_HEADER_BYTES, TEXTURE_ONE_MAPPATCH_BYTES, TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES, TEXTURE_ONE_NAME_BYTES, TEXTURE_ONE_OBSOLETE_BYTES } from './parse-texture-one-lump.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract for the TEXTURE2 conditional load path, pinned to its
 * upstream Chocolate Doom 2.2.1 declaration.
 */
export interface TextureTwoLumpAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'texture-two-optional-via-w-checknumforname-probe'
    | 'texture-two-cache-by-name-via-w-cachelumpname'
    | 'texture-two-maxoff-from-w-lumplength'
    | 'texture-two-deh-string-allows-pwad-and-dehacked-rename'
    | 'texture-two-else-branch-zeroes-maptex2-and-numtextures2-and-maxoff2'
    | 'texture-two-numtextures-aggregation'
    | 'texture-two-runtime-index-continuation-after-numtextures1'
    | 'texture-two-header-count-int32-le-when-present'
    | 'texture-two-directory-entry-bytes-equivalent-to-texture-one'
    | 'texture-two-maptexture-header-bytes-equivalent-to-texture-one'
    | 'texture-two-name-bytes-equivalent-to-texture-one'
    | 'texture-two-mappatch-bytes-equivalent-to-texture-one'
    | 'texture-two-bounds-check-against-maxoff-when-present'
    | 'texture-two-shared-maptex-pointer-rebinds-per-source'
    | 'texture-two-shareware-doom1-wad-has-no-sibling'
    | 'texture-two-shareware-doom1-wad-numtextures-equals-numtextures1';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'TEXTURE2' | 'R_InitTextures' | 'W_CheckNumForName' | 'W_CacheLumpName' | 'W_LumpLength' | 'DEH_String' | 'parseTextureTwoWhenPresent' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/doom/r_data.c' | 'src/doom/w_wad.c' | 'src/doom/p_setup.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and
 * runtime parser contract the TEXTURE2 conditional load path must
 * preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const TEXTURE_TWO_LUMP_AUDIT: readonly TextureTwoLumpAuditEntry[] = [
  {
    id: 'texture-two-optional-via-w-checknumforname-probe',
    subject: 'W_CheckNumForName',
    cSourceLines: ['if (W_CheckNumForName (DEH_String("TEXTURE2")) != -1)'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` probes for the TEXTURE2 lump via `W_CheckNumForName(DEH_String("TEXTURE2")) != -1` before caching it. The probe is load-bearing because TEXTURE2 is OPTIONAL: shareware IWADs ship without it. The runtime models this with `parseTextureTwoWhenPresent` accepting a nullable lump-bytes argument and returning `null` when no TEXTURE2 lump exists in the directory.',
  },
  {
    id: 'texture-two-cache-by-name-via-w-cachelumpname',
    subject: 'W_CacheLumpName',
    cSourceLines: ['maptex2 = W_CacheLumpName (DEH_String("TEXTURE2"), PU_STATIC);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'When the probe succeeds, `R_InitTextures` caches the TEXTURE2 lump via `W_CacheLumpName(DEH_String("TEXTURE2"), PU_STATIC)` — by name, not by directory index, and routed through `DEH_String` so DeHackEd patches can rename the lump. PWADs override TEXTURE2 by publishing a lump with the same name. The runtime models this by accepting the lump bytes as input rather than re-reading the directory inside the parser.',
  },
  {
    id: 'texture-two-maxoff-from-w-lumplength',
    subject: 'W_LumpLength',
    cSourceLines: ['maxoff2 = W_LumpLength (W_GetNumForName (DEH_String("TEXTURE2")));'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'When the probe succeeds, `R_InitTextures` records the lump size via `maxoff2 = W_LumpLength(W_GetNumForName(DEH_String("TEXTURE2")))` and uses it as the bounds-check ceiling for every TEXTURE2 directory offset. The runtime models this by validating each directory offset against the lump byte length passed into the parser.',
  },
  {
    id: 'texture-two-deh-string-allows-pwad-and-dehacked-rename',
    subject: 'DEH_String',
    cSourceLines: ['if (W_CheckNumForName (DEH_String("TEXTURE2")) != -1)', 'maptex2 = W_CacheLumpName (DEH_String("TEXTURE2"), PU_STATIC);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Both the probe and the cache call wrap the literal `"TEXTURE2"` in `DEH_String(...)`, allowing DeHackEd patches to rename the lump under the hood. The runtime models this by treating the parser as format-only and leaving lump-name resolution to the caller, so the parser does not hard-code the literal `TEXTURE2`.',
  },
  {
    id: 'texture-two-else-branch-zeroes-maptex2-and-numtextures2-and-maxoff2',
    subject: 'R_InitTextures',
    cSourceLines: ['else', '{', '    maptex2 = NULL;', '    numtextures2 = 0;', '    maxoff2 = 0;', '}'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'When the probe fails, `R_InitTextures` takes the `else` branch and zeroes `maptex2 = NULL`, `numtextures2 = 0`, `maxoff2 = 0`. No bytes are read and no allocation occurs. The runtime models this by returning `null` from `parseTextureTwoWhenPresent` so callers can short-circuit any TEXTURE2 iteration.',
  },
  {
    id: 'texture-two-numtextures-aggregation',
    subject: 'R_InitTextures',
    cSourceLines: ['numtextures = numtextures1 + numtextures2;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` aggregates the total texture count via `numtextures = numtextures1 + numtextures2`. The total drives every downstream allocation (`Z_Malloc(numtextures*sizeof(*textures))`, the column-buffer width tables, the texturecolumnlump/texturecolumnofs arrays). The runtime models this with a `combineNumTextures(count1, count2)` helper.',
  },
  {
    id: 'texture-two-runtime-index-continuation-after-numtextures1',
    subject: 'R_InitTextures',
    cSourceLines: [
      '// Really complex printing shit...',
      'for (i=0 ; i<numtextures ; i++, directory++)',
      '{',
      '    if (i == numtextures1)',
      '    {',
      '       // Start looking in second texture file.',
      '       maptex = maptex2;',
      '       maxoff = maxoff2;',
      '       directory = maptex+1;',
      '    }',
    ],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'After processing every TEXTURE1 entry, `R_InitTextures` rebinds the working `maptex` / `maxoff` / `directory` pointers from TEXTURE1 to TEXTURE2 at runtime index `i == numtextures1`. TEXTURE2 entries therefore occupy the contiguous runtime texture-index range `[numtextures1, numtextures1 + numtextures2)` so PNAMES indices and runtime texture lookups remain consistent. The runtime models this by exposing the per-lump count separately so the caller can compute the index continuation deterministically.',
  },
  {
    id: 'texture-two-header-count-int32-le-when-present',
    subject: 'TEXTURE2',
    cSourceLines: ['numtextures2 = LONG(*maptex2);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'When TEXTURE2 is present, `R_InitTextures` decodes its count via `numtextures2 = LONG(*maptex2)` — a little-endian 32-bit signed integer at offset 0 of the TEXTURE2 lump (a no-op `LONG` macro on little-endian hosts). The runtime models this with `parseTextureTwoWhenPresent` reading the count via `BinaryReader.readInt32()`.',
  },
  {
    id: 'texture-two-directory-entry-bytes-equivalent-to-texture-one',
    subject: 'TEXTURE2',
    cSourceLines: ['offset = LONG(*directory);', 'for (i=0 ; i<numtextures ; i++, directory++)'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'TEXTURE2 directory entries share the byte-level layout of TEXTURE1: each entry is exactly 4 bytes (a little-endian int32 lump-relative offset) and the directory immediately follows the 4-byte count header. The same `R_InitTextures` loop reads both lumps via the same `LONG(*directory)` / `directory++` pattern after the `i == numtextures1` rebind. The runtime asserts this format equivalence by importing `TEXTURE_ONE_DIRECTORY_ENTRY_BYTES` and pinning the TEXTURE2 constant to the same value.',
  },
  {
    id: 'texture-two-maptexture-header-bytes-equivalent-to-texture-one',
    subject: 'TEXTURE2',
    cSourceLines: ['mtexture = (maptexture_t *) ( (byte *)maptex + offset);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'TEXTURE2 maptexture headers share the byte-level layout of TEXTURE1: 8 (name) + 4 (masked) + 2 (width) + 2 (height) + 4 (obsolete) + 2 (patchcount) = 22 bytes. The same `(maptexture_t *)((byte*)maptex + offset)` reinterpret reads both lumps. The runtime asserts this format equivalence by importing `TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES` and pinning the TEXTURE2 constant to the same value.',
  },
  {
    id: 'texture-two-name-bytes-equivalent-to-texture-one',
    subject: 'TEXTURE2',
    cSourceLines: ['char\t\tname[8];', 'memcpy (texture->name, mtexture->name, sizeof(texture->name));'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'TEXTURE2 entries reuse the same 8-byte null-padded ASCII `char name[8]` field as TEXTURE1 — the same `memcpy(texture->name, mtexture->name, sizeof(texture->name))` copy applies to both lumps because `R_InitTextures` walks the unified `numtextures1 + numtextures2` loop with one shared destination buffer width. The runtime asserts this with `TEXTURE_TWO_NAME_BYTES === TEXTURE_ONE_NAME_BYTES === 8`.',
  },
  {
    id: 'texture-two-mappatch-bytes-equivalent-to-texture-one',
    subject: 'TEXTURE2',
    cSourceLines: ['typedef struct', '{', '    short\toriginx;', '    short\toriginy;', '    short\tpatch;', '    short\tstepdir;', '    short\tcolormap;', '} PACKEDATTR mappatch_t;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'TEXTURE2 mappatch entries share the byte-level layout of TEXTURE1: each `mappatch_t` is exactly 10 bytes (5 packed shorts: originx, originy, patch, stepdir, colormap). The same struct definition is reused unchanged for both lumps. The runtime asserts this with `TEXTURE_TWO_MAPPATCH_BYTES === TEXTURE_ONE_MAPPATCH_BYTES === 10`.',
  },
  {
    id: 'texture-two-bounds-check-against-maxoff-when-present',
    subject: 'R_InitTextures',
    cSourceLines: ['offset = LONG(*directory);', '', 'if (offset > maxoff)', '    I_Error ("R_InitTextures: bad texture directory");'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'When TEXTURE2 is present, the same `if (offset > maxoff) I_Error("R_InitTextures: bad texture directory")` bounds check applies to TEXTURE2 directory entries (after the `i == numtextures1` rebind shifts `maxoff` to `maxoff2`). The runtime models this by validating every TEXTURE2 directory offset against the lump byte length and throwing `RangeError` on overflow.',
  },
  {
    id: 'texture-two-shared-maptex-pointer-rebinds-per-source',
    subject: 'R_InitTextures',
    cSourceLines: ['if (i == numtextures1)', '{', '   // Start looking in second texture file.', '   maptex = maptex2;', '   maxoff = maxoff2;', '   directory = maptex+1;', '}'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The shared `maptex` / `maxoff` / `directory` pointers rebind from TEXTURE1 to TEXTURE2 at the boundary `i == numtextures1`, then read TEXTURE2 with the same arithmetic (`directory = maptex + 1`, `directory++` per entry). No alternate code path touches TEXTURE2; the format equivalence is enforced by code reuse. The runtime models the per-source separation by parsing each lump independently and exposing the per-lump count to the caller.',
  },
  {
    id: 'texture-two-shareware-doom1-wad-has-no-sibling',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['if (W_CheckNumForName (DEH_String("TEXTURE2")) != -1)'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` does NOT contain a TEXTURE2 lump in its directory. Vanilla `R_InitTextures` therefore takes the `else` branch when run against the shareware IWAD: `maptex2 = NULL`, `numtextures2 = 0`. Registered (DOOM.WAD 1.9) and Ultimate IWADs DO contain TEXTURE2. The runtime asserts the shareware fact via the live IWAD oracle (`hasTexture2: false`) so an IWAD swap that accidentally introduces a TEXTURE2 lump fails the cross-check.',
  },
  {
    id: 'texture-two-shareware-doom1-wad-numtextures-equals-numtextures1',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['numtextures = numtextures1 + numtextures2;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'For the shareware `doom/DOOM1.WAD` the aggregation `numtextures = numtextures1 + numtextures2` reduces to `numtextures = numtextures1 + 0 = 125`. The runtime models this by exposing `combineNumTextures(125, null) === 125` so the shareware total is exactly the TEXTURE1 count.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on
 * top of the raw audit entries. Failures point at concrete identities
 * that any vanilla parity rebuild must preserve.
 */
export interface TextureTwoLumpDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const TEXTURE_TWO_LUMP_DERIVED_INVARIANTS: readonly TextureTwoLumpDerivedInvariant[] = [
  {
    id: 'TEXTURE_TWO_HEADER_BYTES_EQUALS_TEXTURE_ONE',
    description: '`TEXTURE_TWO_HEADER_BYTES === TEXTURE_ONE_HEADER_BYTES === 4`. TEXTURE2 reuses the same 4-byte little-endian count header as TEXTURE1.',
  },
  {
    id: 'TEXTURE_TWO_DIRECTORY_ENTRY_BYTES_EQUALS_TEXTURE_ONE',
    description: '`TEXTURE_TWO_DIRECTORY_ENTRY_BYTES === TEXTURE_ONE_DIRECTORY_ENTRY_BYTES === 4`. TEXTURE2 directory entries are 4-byte little-endian offsets, identical to TEXTURE1.',
  },
  {
    id: 'TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES_EQUALS_TEXTURE_ONE',
    description: '`TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES === TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES === 22`. TEXTURE2 maptexture headers reuse the TEXTURE1 22-byte struct layout.',
  },
  {
    id: 'TEXTURE_TWO_NAME_BYTES_EQUALS_TEXTURE_ONE',
    description: '`TEXTURE_TWO_NAME_BYTES === TEXTURE_ONE_NAME_BYTES === 8`. TEXTURE2 entries reuse the same 8-byte name field as TEXTURE1.',
  },
  {
    id: 'TEXTURE_TWO_MAPPATCH_BYTES_EQUALS_TEXTURE_ONE',
    description: '`TEXTURE_TWO_MAPPATCH_BYTES === TEXTURE_ONE_MAPPATCH_BYTES === 10`. TEXTURE2 mappatch entries reuse the same 10-byte struct stride as TEXTURE1.',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_NULL_FOR_NULL_INPUT',
    description: '`parseTextureTwoWhenPresent(null) === null`. Models the upstream `else { maptex2 = NULL; numtextures2 = 0; maxoff2 = 0; }` branch.',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_NULL_FOR_UNDEFINED_INPUT',
    description: '`parseTextureTwoWhenPresent(undefined) === null`. The parser treats `undefined` identically to `null` for caller convenience.',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_FROZEN_LUMP_FOR_VALID_INPUT',
    description: 'A successful `parseTextureTwoWhenPresent(buffer)` returns a frozen `{ count, textures }` object with a frozen `textures` array and frozen per-texture `patches` arrays.',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_TEXTURES_LENGTH_EQUALS_COUNT',
    description: '`parsed.textures.length === parsed.count`. Mirrors the upstream `Z_Malloc(numtextures*sizeof(*textures))` allocation.',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_NAMES_ARE_UPPERCASE_AND_TRIMMED',
    description: 'Every texture name in `parsed.textures` is uppercase ASCII with no embedded NUL bytes (case-insensitive `R_TextureNumForName` lookup).',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
    description: '`parseTextureTwoWhenPresent(new Uint8Array(3))` throws a `RangeError`. A non-null TEXTURE2 lump must contain at least the 4-byte count header.',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_NEGATIVE_COUNT',
    description: '`parseTextureTwoWhenPresent(bufferWithNegativeCount)` throws a `RangeError`. A negative `numtextures2` cannot be allocated.',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_OFFSET_PAST_LUMP_END',
    description: '`parseTextureTwoWhenPresent(bufferWithBadOffset)` throws a `RangeError`. Mirrors the upstream `if (offset > maxoff) I_Error("R_InitTextures: bad texture directory")` bounds check applied to TEXTURE2.',
  },
  {
    id: 'PARSE_TEXTURE_TWO_WHEN_PRESENT_ACCEPTS_ZERO_COUNT',
    description: '`parseTextureTwoWhenPresent(zeroCountLump).count === 0` and `parsed.textures` is an empty frozen array. A degenerate but syntactically valid TEXTURE2 lump.',
  },
  {
    id: 'COMBINE_NUMTEXTURES_RETURNS_SUM_FOR_PRESENT_LUMP',
    description: '`combineNumTextures(count1, parsedTextureTwoLump.count)` returns `count1 + parsedTextureTwoLump.count`. Mirrors `numtextures = numtextures1 + numtextures2`.',
  },
  {
    id: 'COMBINE_NUMTEXTURES_RETURNS_COUNT1_FOR_NULL_LUMP',
    description: '`combineNumTextures(count1, null)` returns `count1`. Mirrors the `else { numtextures2 = 0 }` branch where the total collapses to `numtextures1`.',
  },
  {
    id: 'COMBINE_NUMTEXTURES_REJECTS_NEGATIVE_INPUT',
    description: '`combineNumTextures(-1, null)` and `combineNumTextures(0, parsed)` with a negative count throw `RangeError`. Validates inputs at the runtime boundary.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Byte size of the `numtextures2` count header at the start of the TEXTURE2 lump. */
export const TEXTURE_TWO_HEADER_BYTES = TEXTURE_ONE_HEADER_BYTES;

/** Byte size of each entry in the per-lump offset directory (`int32` little-endian). */
export const TEXTURE_TWO_DIRECTORY_ENTRY_BYTES = TEXTURE_ONE_DIRECTORY_ENTRY_BYTES;

/** Byte size of the `maptexture_t` header (before the trailing `mappatch_t patches[]`). */
export const TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES = TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES;

/** Byte size of the `maptexture_t.name` field (`char name[8]`). */
export const TEXTURE_TWO_NAME_BYTES = TEXTURE_ONE_NAME_BYTES;

/** Byte size of each `mappatch_t` entry that follows a maptexture header. */
export const TEXTURE_TWO_MAPPATCH_BYTES = TEXTURE_ONE_MAPPATCH_BYTES;

/** A single patch reference within a parsed TEXTURE2 entry. */
export interface TextureTwoMappatch {
  /** Signed x offset of the patch within the texture (`mappatch_t.originx`). */
  readonly originX: number;
  /** Signed y offset of the patch within the texture (`mappatch_t.originy`). */
  readonly originY: number;
  /** Zero-based PNAMES index identifying the patch graphic (`mappatch_t.patch`). */
  readonly patchIndex: number;
}

/** A single composite texture parsed from a TEXTURE2 entry. */
export interface TextureTwoEntry {
  /** Texture name (uppercase ASCII, NUL-stripped). */
  readonly name: string;
  /** Raw 4-byte int32-LE `masked` field from the on-disk maptexture_t. */
  readonly masked: number;
  /** Width of the texture in pixels (`maptexture_t.width`). */
  readonly width: number;
  /** Height of the texture in pixels (`maptexture_t.height`). */
  readonly height: number;
  /** Number of mappatch entries in this texture (`maptexture_t.patchcount`). */
  readonly patchCount: number;
  /** Frozen array of mappatch entries in lump order. */
  readonly patches: readonly TextureTwoMappatch[];
}

/** Resolved TEXTURE2 lump (returned only when present). */
export interface TextureTwoLump {
  /** Decoded `numtextures2` count from the 4-byte header. */
  readonly count: number;
  /**
   * Frozen array of `count` texture entries in lump order. Each entry
   * is itself frozen, with a frozen `patches` array.
   */
  readonly textures: readonly TextureTwoEntry[];
}

/**
 * Parse the optional TEXTURE2 lump bytes into a frozen `{ count,
 * textures }` pair when present, or return `null` when absent.
 *
 * Mirrors the vanilla `R_InitTextures` TEXTURE2 conditional load path:
 *   - returns `null` for `null` / `undefined` input (matching the
 *     upstream `else { maptex2 = NULL; numtextures2 = 0; maxoff2 = 0; }`
 *     branch),
 *   - reads `numtextures2` as a little-endian 32-bit integer at offset
 *     0 (matching `numtextures2 = LONG(*maptex2)`),
 *   - advances past the 4-byte header to the offset directory,
 *   - reads exactly `count` 4-byte little-endian directory entries,
 *   - validates each offset against the lump length (matching the
 *     `if (offset > maxoff) I_Error(...)` bounds check),
 *   - reads each `maptexture_t` header (8-byte name + 4-byte masked +
 *     2-byte width + 2-byte height + 4-byte obsolete + 2-byte
 *     patchcount = 22 bytes),
 *   - skips the obsolete column-directory pointer,
 *   - reads exactly `patchcount` 10-byte `mappatch_t` entries (originx
 *     + originy + patch + stepdir + colormap, with stepdir and
 *     colormap skipped).
 *
 * The byte format is identical to TEXTURE1 because vanilla
 * `R_InitTextures` walks the unified `numtextures1 + numtextures2` loop
 * with the same `(maptexture_t *)((byte*)maptex + offset)` reinterpret
 * after rebinding `maptex = maptex2` at `i == numtextures1`. The
 * parser does NOT resolve `patchIndex` against PNAMES — that is the
 * responsibility of a downstream texture-composition module.
 *
 * @param lumpData - Raw TEXTURE2 lump data, or `null`/`undefined` to
 *   signal an IWAD that takes the absent-TEXTURE2 branch.
 * @returns Frozen {@link TextureTwoLump} when present, `null` when absent.
 * @throws {RangeError} If the lump is non-null but too small for the
 *   count header, declares a negative count, has a directory that
 *   overflows the buffer, points at a maptexture_t that overflows the
 *   buffer, declares a negative `patchcount`, or has trailing mappatch
 *   entries that overflow the buffer.
 */
export function parseTextureTwoWhenPresent(lumpData: Buffer | Uint8Array | null | undefined): TextureTwoLump | null {
  if (lumpData === null || lumpData === undefined) {
    return null;
  }

  if (lumpData.length < TEXTURE_TWO_HEADER_BYTES) {
    throw new RangeError(`parseTextureTwoWhenPresent: lump must be at least ${TEXTURE_TWO_HEADER_BYTES} bytes for the count header, got ${lumpData.length}`);
  }

  const buffer = lumpData instanceof Buffer ? lumpData : Buffer.from(lumpData.buffer, lumpData.byteOffset, lumpData.byteLength);
  const reader = new BinaryReader(buffer);

  const count = reader.readInt32();
  if (count < 0) {
    throw new RangeError(`parseTextureTwoWhenPresent: numtextures2 must be non-negative, got ${count}`);
  }

  const directoryEnd = TEXTURE_TWO_HEADER_BYTES + count * TEXTURE_TWO_DIRECTORY_ENTRY_BYTES;
  if (buffer.length < directoryEnd) {
    throw new RangeError(`parseTextureTwoWhenPresent: lump declares ${count} textures (directory needs ${directoryEnd} bytes), but lump is only ${buffer.length} bytes`);
  }

  const offsets: number[] = new Array(count);
  for (let index = 0; index < count; index += 1) {
    offsets[index] = reader.readInt32();
  }

  const textures: TextureTwoEntry[] = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const offset = offsets[index]!;
    if (offset < 0 || offset + TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES > buffer.length) {
      throw new RangeError(`parseTextureTwoWhenPresent: texture ${index} offset ${offset} is out of range (lump length ${buffer.length})`);
    }

    reader.seek(offset);
    const name = reader.readAscii(TEXTURE_TWO_NAME_BYTES).toUpperCase();
    const masked = reader.readInt32();
    const width = reader.readInt16();
    const height = reader.readInt16();
    reader.skip(TEXTURE_ONE_OBSOLETE_BYTES);
    const patchCount = reader.readInt16();

    if (patchCount < 0) {
      throw new RangeError(`parseTextureTwoWhenPresent: texture ${index} (${name}) has negative patchcount ${patchCount}`);
    }

    const patchEnd = offset + TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES + patchCount * TEXTURE_TWO_MAPPATCH_BYTES;
    if (patchEnd > buffer.length) {
      throw new RangeError(`parseTextureTwoWhenPresent: texture ${index} (${name}) mappatch data extends past lump end (needs ${patchEnd} bytes, lump is ${buffer.length} bytes)`);
    }

    const patches: TextureTwoMappatch[] = new Array(patchCount);
    for (let patchSlot = 0; patchSlot < patchCount; patchSlot += 1) {
      const originX = reader.readInt16();
      const originY = reader.readInt16();
      const patchIndex = reader.readInt16();
      reader.skip(4); // mappatch_t.stepdir + mappatch_t.colormap (unused)
      patches[patchSlot] = Object.freeze({
        originX,
        originY,
        patchIndex,
      });
    }

    textures[index] = Object.freeze({
      name,
      masked,
      width,
      height,
      patchCount,
      patches: Object.freeze(patches),
    });
  }

  return Object.freeze({
    count,
    textures: Object.freeze(textures),
  });
}

/**
 * Aggregate the total runtime texture count from the TEXTURE1 count
 * and the optional TEXTURE2 parse result.
 *
 * Mirrors the vanilla `numtextures = numtextures1 + numtextures2`
 * aggregation. When TEXTURE2 is absent (`null`), the total collapses
 * to `numtextures1`.
 *
 * @param numtextures1 - The TEXTURE1 count (must be a non-negative integer).
 * @param textureTwo - The parsed TEXTURE2 lump, or `null` when absent.
 * @returns Total texture count (`numtextures1 + numtextures2`).
 * @throws {RangeError} If `numtextures1` is negative or non-integer, or
 *   if `textureTwo.count` is negative.
 */
export function combineNumTextures(numtextures1: number, textureTwo: TextureTwoLump | null): number {
  if (!Number.isInteger(numtextures1) || numtextures1 < 0) {
    throw new RangeError(`combineNumTextures: numtextures1 must be a non-negative integer, got ${numtextures1}`);
  }
  if (textureTwo === null) {
    return numtextures1;
  }
  if (!Number.isInteger(textureTwo.count) || textureTwo.count < 0) {
    throw new RangeError(`combineNumTextures: textureTwo.count must be a non-negative integer, got ${textureTwo.count}`);
  }
  return numtextures1 + textureTwo.count;
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-texture-two-when-present.ts`. The cross-check
 * helper consumes this shape so the focused test can both verify the
 * live runtime exports and exercise a deliberately tampered snapshot
 * to prove the failure modes are observable.
 */
export interface TextureTwoLumpRuntimeSnapshot {
  /** `TEXTURE_TWO_HEADER_BYTES` exported by this module. */
  readonly textureTwoHeaderBytes: number;
  /** `TEXTURE_TWO_DIRECTORY_ENTRY_BYTES` exported by this module. */
  readonly textureTwoDirectoryEntryBytes: number;
  /** `TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES` exported by this module. */
  readonly textureTwoMaptextureHeaderBytes: number;
  /** `TEXTURE_TWO_NAME_BYTES` exported by this module. */
  readonly textureTwoNameBytes: number;
  /** `TEXTURE_TWO_MAPPATCH_BYTES` exported by this module. */
  readonly textureTwoMappatchBytes: number;
  /** Whether `parseTextureTwoWhenPresent(null) === null`. */
  readonly parserReturnsNullForNullInput: boolean;
  /** Whether `parseTextureTwoWhenPresent(undefined) === null`. */
  readonly parserReturnsNullForUndefinedInput: boolean;
  /** Whether `parseTextureTwoWhenPresent(validBuffer)` returns an object that is fully frozen. */
  readonly parserReturnsFullyFrozenForValidInput: boolean;
  /** Whether `parsed.textures.length === parsed.count` on a valid input. */
  readonly texturesLengthEqualsCount: boolean;
  /** Whether every name in `parsed.textures` is uppercase with no embedded NUL bytes. */
  readonly namesAreUppercaseAndTrimmed: boolean;
  /** Whether `parseTextureTwoWhenPresent(new Uint8Array(3))` throws a `RangeError`. */
  readonly parserRejectsBufferTooSmallForHeader: boolean;
  /** Whether `parseTextureTwoWhenPresent(bufferWithNegativeCount)` throws a `RangeError`. */
  readonly parserRejectsNegativeCount: boolean;
  /** Whether `parseTextureTwoWhenPresent(bufferWithBadOffset)` throws a `RangeError`. */
  readonly parserRejectsOffsetPastLumpEnd: boolean;
  /** Whether `parseTextureTwoWhenPresent(zeroCountLump)` accepts the degenerate empty case. */
  readonly parserAcceptsZeroCount: boolean;
  /** Whether `combineNumTextures(125, parsedTextureTwoLump)` returns `125 + parsedTextureTwoLump.count`. */
  readonly combineReturnsSumForPresentLump: boolean;
  /** Whether `combineNumTextures(125, null)` returns `125`. */
  readonly combineReturnsCount1ForNullLump: boolean;
  /** Whether `combineNumTextures(-1, null)` throws `RangeError`. */
  readonly combineRejectsNegativeInput: boolean;
}

/**
 * Cross-check a `TextureTwoLumpRuntimeSnapshot` against
 * `TEXTURE_TWO_LUMP_AUDIT` and `TEXTURE_TWO_LUMP_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the
 *    snapshot.
 */
export function crossCheckTextureTwoLumpRuntime(snapshot: TextureTwoLumpRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.textureTwoHeaderBytes !== TEXTURE_ONE_HEADER_BYTES) {
    failures.push('derived:TEXTURE_TWO_HEADER_BYTES_EQUALS_TEXTURE_ONE');
    failures.push('audit:texture-two-header-count-int32-le-when-present:not-observed');
  }

  if (snapshot.textureTwoDirectoryEntryBytes !== TEXTURE_ONE_DIRECTORY_ENTRY_BYTES) {
    failures.push('derived:TEXTURE_TWO_DIRECTORY_ENTRY_BYTES_EQUALS_TEXTURE_ONE');
    failures.push('audit:texture-two-directory-entry-bytes-equivalent-to-texture-one:not-observed');
  }

  if (snapshot.textureTwoMaptextureHeaderBytes !== TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES) {
    failures.push('derived:TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES_EQUALS_TEXTURE_ONE');
    failures.push('audit:texture-two-maptexture-header-bytes-equivalent-to-texture-one:not-observed');
  }

  if (snapshot.textureTwoNameBytes !== TEXTURE_ONE_NAME_BYTES) {
    failures.push('derived:TEXTURE_TWO_NAME_BYTES_EQUALS_TEXTURE_ONE');
    failures.push('audit:texture-two-name-bytes-equivalent-to-texture-one:not-observed');
  }

  if (snapshot.textureTwoMappatchBytes !== TEXTURE_ONE_MAPPATCH_BYTES) {
    failures.push('derived:TEXTURE_TWO_MAPPATCH_BYTES_EQUALS_TEXTURE_ONE');
    failures.push('audit:texture-two-mappatch-bytes-equivalent-to-texture-one:not-observed');
  }

  if (!snapshot.parserReturnsNullForNullInput) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_NULL_FOR_NULL_INPUT');
    failures.push('audit:texture-two-else-branch-zeroes-maptex2-and-numtextures2-and-maxoff2:not-observed');
    failures.push('audit:texture-two-optional-via-w-checknumforname-probe:not-observed');
  }

  if (!snapshot.parserReturnsNullForUndefinedInput) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_NULL_FOR_UNDEFINED_INPUT');
  }

  if (!snapshot.parserReturnsFullyFrozenForValidInput) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_FROZEN_LUMP_FOR_VALID_INPUT');
    failures.push('audit:texture-two-cache-by-name-via-w-cachelumpname:not-observed');
  }

  if (!snapshot.texturesLengthEqualsCount) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_TEXTURES_LENGTH_EQUALS_COUNT');
    failures.push('audit:texture-two-header-count-int32-le-when-present:not-observed');
  }

  if (!snapshot.namesAreUppercaseAndTrimmed) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_NAMES_ARE_UPPERCASE_AND_TRIMMED');
    failures.push('audit:texture-two-name-bytes-equivalent-to-texture-one:not-observed');
  }

  if (!snapshot.parserRejectsBufferTooSmallForHeader) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  }

  if (!snapshot.parserRejectsNegativeCount) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_NEGATIVE_COUNT');
  }

  if (!snapshot.parserRejectsOffsetPastLumpEnd) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_OFFSET_PAST_LUMP_END');
    failures.push('audit:texture-two-bounds-check-against-maxoff-when-present:not-observed');
  }

  if (!snapshot.parserAcceptsZeroCount) {
    failures.push('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_ACCEPTS_ZERO_COUNT');
  }

  if (!snapshot.combineReturnsSumForPresentLump) {
    failures.push('derived:COMBINE_NUMTEXTURES_RETURNS_SUM_FOR_PRESENT_LUMP');
    failures.push('audit:texture-two-numtextures-aggregation:not-observed');
    failures.push('audit:texture-two-runtime-index-continuation-after-numtextures1:not-observed');
  }

  if (!snapshot.combineReturnsCount1ForNullLump) {
    failures.push('derived:COMBINE_NUMTEXTURES_RETURNS_COUNT1_FOR_NULL_LUMP');
    failures.push('audit:texture-two-shareware-doom1-wad-numtextures-equals-numtextures1:not-observed');
  }

  if (!snapshot.combineRejectsNegativeInput) {
    failures.push('derived:COMBINE_NUMTEXTURES_REJECTS_NEGATIVE_INPUT');
  }

  const declaredAxes = new Set(TEXTURE_TWO_LUMP_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<TextureTwoLumpAuditEntry['id']> = [
    'texture-two-optional-via-w-checknumforname-probe',
    'texture-two-cache-by-name-via-w-cachelumpname',
    'texture-two-maxoff-from-w-lumplength',
    'texture-two-deh-string-allows-pwad-and-dehacked-rename',
    'texture-two-else-branch-zeroes-maptex2-and-numtextures2-and-maxoff2',
    'texture-two-numtextures-aggregation',
    'texture-two-runtime-index-continuation-after-numtextures1',
    'texture-two-header-count-int32-le-when-present',
    'texture-two-directory-entry-bytes-equivalent-to-texture-one',
    'texture-two-maptexture-header-bytes-equivalent-to-texture-one',
    'texture-two-name-bytes-equivalent-to-texture-one',
    'texture-two-mappatch-bytes-equivalent-to-texture-one',
    'texture-two-bounds-check-against-maxoff-when-present',
    'texture-two-shared-maptex-pointer-rebinds-per-source',
    'texture-two-shareware-doom1-wad-has-no-sibling',
    'texture-two-shareware-doom1-wad-numtextures-equals-numtextures1',
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
 * Pinned facts about the absence of a TEXTURE2 sibling lump in the
 * shareware `doom/DOOM1.WAD` that the focused test cross-checks
 * against the live on-disk file.
 */
export interface ShareWareDoom1WadTextureTwoOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Whether the shareware IWAD contains a TEXTURE2 sibling lump. */
  readonly hasTexture2: false;
  /** Total `numtextures` for the shareware IWAD (numtextures1 + numtextures2 = 125 + 0). */
  readonly combinedNumTextures: 125;
  /** TEXTURE1 count for the shareware IWAD (used as `numtextures1` in `combineNumTextures`). */
  readonly numTextures1: 125;
  /** TEXTURE2 count for the shareware IWAD (always 0 because the lump is absent). */
  readonly numTextures2: 0;
  /** Number of texture-definition lumps (`TEXTURE1` + `TEXTURE2`) in the shareware IWAD. */
  readonly textureDefinitionLumpCount: 1;
}

/**
 * Pinned oracle facts for the absent TEXTURE2 sibling in the shareware
 * `doom/DOOM1.WAD`.
 *
 * The oracle freezes the no-TEXTURE2 contract for the shareware target:
 *  - `hasTexture2: false` — the IWAD directory contains no TEXTURE2
 *    lump, so vanilla `R_InitTextures` takes the `else` branch.
 *  - `combinedNumTextures: 125` — the aggregation
 *    `numtextures = numtextures1 + numtextures2` collapses to the
 *    TEXTURE1 count.
 *  - `numTextures1: 125`, `numTextures2: 0` — pin the per-lump counts
 *    so a future IWAD swap that introduces a TEXTURE2 lump fails the
 *    cross-check.
 *  - `textureDefinitionLumpCount: 1` — matches
 *    `reference/manifests/wad-map-summary.json` `lumpCategories.texture-definition: 1`.
 */
export const SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE: ShareWareDoom1WadTextureTwoOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  hasTexture2: false,
  combinedNumTextures: 125,
  numTextures1: 125,
  numTextures2: 0,
  textureDefinitionLumpCount: 1,
}) as ShareWareDoom1WadTextureTwoOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * TEXTURE2 conditional so the focused test can re-derive the values
 * from the live file every run and feed the result into the
 * cross-check.
 */
export interface ShareWareDoom1WadTextureTwoSample {
  readonly hasTexture2: boolean;
  readonly combinedNumTextures: number;
  readonly numTextures1: number;
  readonly numTextures2: number;
  readonly textureDefinitionLumpCount: number;
}

/**
 * Cross-check a shareware DOOM1.WAD TEXTURE2 sample against the
 * pinned oracle. Returns the list of failures by stable identifier;
 * an empty list means the live IWAD matches the no-TEXTURE2 oracle.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field
 *    whose live counterpart disagrees with the pinned value.
 */
export function crossCheckShareWareDoom1WadTextureTwoSample(sample: ShareWareDoom1WadTextureTwoSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<keyof ShareWareDoom1WadTextureTwoSample> = ['hasTexture2', 'combinedNumTextures', 'numTextures1', 'numTextures2', 'textureDefinitionLumpCount'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  return failures;
}
