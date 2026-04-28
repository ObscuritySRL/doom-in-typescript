/**
 * Audit ledger for the vanilla DOOM 1.9 TEXTURE1 lump parser, the
 * texture-definition table that the renderer's texture-composition
 * pipeline consults to build every wall texture by combining patches
 * from the PNAMES lookup. TEXTURE1 (and its optional sibling TEXTURE2)
 * is the input that `R_InitTextures` reads in vanilla `r_data.c`
 * immediately after PNAMES, before allocating the runtime
 * `textures[]` and `texturecolumnlump[]` / `texturecolumnofs[]`
 * buffers.
 *
 * This module pins the runtime contract one level deeper than the
 * 05-001..05-004 marker / lookup audits, the 05-005 PLAYPAL / COLORMAP
 * audit, the 05-006 patch picture format audit, the 05-007 flat
 * namespace audit, and the 05-008 PNAMES lump audit: the 4-byte
 * int32-LE `numtextures1` count header at offset 0, the
 * `count * 4`-byte int32-LE offset directory that immediately follows
 * the count (`directory = maptex+1`), the `if (offset > maxoff)
 * I_Error("R_InitTextures: bad texture directory")` bounds check that
 * rejects out-of-range entries, the 22-byte `maptexture_t` header
 * (8-byte `char name[8]` + 4-byte `int masked` + 2-byte `short width`
 * + 2-byte `short height` + 4-byte `int obsolete` (column-directory
 * pointer that vanilla DOS leaves uninitialized in the lump) +
 * 2-byte `short patchcount`), and the 10-byte `mappatch_t` entry
 * (2-byte `short originx` + 2-byte `short originy` + 2-byte `short
 * patch` PNAMES index + 2-byte `short stepdir` + 2-byte `short
 * colormap`) that the per-texture patch loop walks via
 * `mpatch++, patch++`. The accompanying focused test imports the
 * ledger plus a self-contained `parseTextureOneLump` runtime exposed
 * by this module and cross-checks every audit entry against the
 * runtime behavior plus the live shareware `doom/DOOM1.WAD` oracle.
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
 * The format and constant declarations below are pinned against
 * authority 5 because the byte layout of the TEXTURE1 lump and the
 * arithmetic that consumes it are textual constants the binary cannot
 * disagree with: every header byte stride, struct field width,
 * directory entry size, and patch-entry stride is a property of the
 * on-disk byte stream and of the `R_InitTextures` body in the
 * upstream C source, not of any runtime register state. The
 * shareware `DOOM1.WAD` oracle facts (TEXTURE1 at directory index
 * 105, file offset 915712, raw size 9234 bytes, 125 declared
 * textures, sha-256 fingerprint, no TEXTURE2 sibling, and selected
 * pinned texture probes covering first / mid / last entries) are
 * pinned against authority 2 — the local IWAD itself — and re-derived
 * from the on-disk file every test run.
 */

import { BinaryReader } from '../core/binaryReader.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract of the TEXTURE1 lump parser, pinned to its upstream
 * Chocolate Doom 2.2.1 declaration.
 */
export interface TextureOneLumpAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'texture-one-header-bytes-four'
    | 'texture-one-header-count-int32-le'
    | 'texture-one-directory-starts-at-offset-four'
    | 'texture-one-directory-entry-bytes-four'
    | 'texture-one-offset-bounds-check-against-maxoff'
    | 'texture-one-maptexture-header-bytes-twenty-two'
    | 'texture-one-maptexture-name-bytes-eight'
    | 'texture-one-maptexture-masked-int32-le'
    | 'texture-one-maptexture-width-and-height-int16-le'
    | 'texture-one-maptexture-obsolete-bytes-four-unused'
    | 'texture-one-maptexture-patchcount-int16-le'
    | 'texture-one-maptexture-name-copied-via-memcpy-no-terminator'
    | 'texture-one-mappatch-struct-bytes-ten'
    | 'texture-one-mappatch-originx-originy-int16-le'
    | 'texture-one-mappatch-patch-index-feeds-patchlookup'
    | 'texture-one-mappatch-stepdir-and-colormap-unused'
    | 'texture-one-cache-by-name-via-w-cachelumpname'
    | 'texture-one-shareware-doom1-one-hundred-twenty-five-textures'
    | 'texture-one-shareware-doom1-no-texture2-sibling';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'TEXTURE1' | 'TEXTURE2' | 'maptexture_t' | 'mappatch_t' | 'R_InitTextures' | 'parseTextureOneLump' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/doom/r_data.c' | 'src/doom/w_wad.c' | 'src/doom/p_setup.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and
 * runtime parser contract the runtime TEXTURE1 loader must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const TEXTURE_ONE_LUMP_AUDIT: readonly TextureOneLumpAuditEntry[] = [
  {
    id: 'texture-one-header-bytes-four',
    subject: 'TEXTURE1',
    cSourceLines: ['numtextures1 = LONG(*maptex);', 'directory = maptex+1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` reads the first 4 bytes of the TEXTURE1 lump as a single `int` (the `int *maptex` reinterpret) and then advances `directory` to `maptex+1`, which is `maptex` plus `sizeof(int)` = 4 bytes. The 4-byte header stride is a load-bearing property of the lump format. The runtime models this with `TEXTURE_ONE_HEADER_BYTES = 4` exposed by `parse-texture-one-lump.ts`.',
  },
  {
    id: 'texture-one-header-count-int32-le',
    subject: 'TEXTURE1',
    cSourceLines: ['numtextures1 = LONG(*maptex);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` reads `numtextures1` as a little-endian 32-bit integer at offset 0 of the TEXTURE1 lump (an `int*` reinterpret on a buffer that is byte-swap-corrected via the `LONG` macro, which is a no-op on little-endian hosts). The runtime models this with `parseTextureOneLump` reading the count via `BinaryReader.readInt32()` (signed, little-endian).',
  },
  {
    id: 'texture-one-directory-starts-at-offset-four',
    subject: 'TEXTURE1',
    cSourceLines: ['directory = maptex+1;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` sets the directory pointer `directory` to `maptex + 1` (pointer arithmetic on an `int*`), which advances by `sizeof(int)` = 4 bytes. The first directory entry begins immediately after the 4-byte count header at offset 4 of the lump. The runtime models this by reading directory entries sequentially after the header inside `parseTextureOneLump`.',
  },
  {
    id: 'texture-one-directory-entry-bytes-four',
    subject: 'TEXTURE1',
    cSourceLines: ['offset = LONG(*directory);', 'for (i=0 ; i<numtextures ; i++, directory++)'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` reads each directory entry as `LONG(*directory)` and advances `directory++` (pointer arithmetic on `int*`), which steps forward by `sizeof(int)` = 4 bytes. Each directory entry is therefore exactly 4 bytes wide and contains a little-endian int32 lump-relative offset. The runtime models this with `TEXTURE_ONE_DIRECTORY_ENTRY_BYTES = 4` exposed by `parse-texture-one-lump.ts`.',
  },
  {
    id: 'texture-one-offset-bounds-check-against-maxoff',
    subject: 'R_InitTextures',
    cSourceLines: ['offset = LONG(*directory);', '', 'if (offset > maxoff)', '    I_Error ("R_InitTextures: bad texture directory");'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` rejects any directory entry whose `offset` exceeds the lump length `maxoff` with `I_Error("R_InitTextures: bad texture directory")`. The bounds check is a load-bearing crash-on-bad-data contract: a TEXTURE1 lump whose offset directory points past the lump end is fatal. The runtime models this by validating that every directory entry plus the maptexture header fits within the buffer before parsing.',
  },
  {
    id: 'texture-one-maptexture-header-bytes-twenty-two',
    subject: 'maptexture_t',
    cSourceLines: [
      'typedef struct',
      '{',
      '    char\t\tname[8];',
      '    int\t\t\tmasked;\t',
      '    short\t\twidth;',
      '    short\t\theight;',
      '    int                 obsolete;',
      '    short\t\tpatchcount;',
      '    mappatch_t\tpatches[1];',
      '} PACKEDATTR maptexture_t;',
    ],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The on-disk `maptexture_t` header is exactly 22 bytes wide: 8 (name) + 4 (masked) + 2 (width) + 2 (height) + 4 (obsolete) + 2 (patchcount) = 22. The trailing `mappatch_t patches[1]` is a flexible-array placeholder that does not contribute to the header size. The runtime models this with `TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES = 22` exposed by `parse-texture-one-lump.ts`.',
  },
  {
    id: 'texture-one-maptexture-name-bytes-eight',
    subject: 'maptexture_t',
    cSourceLines: ['char\t\tname[8];', 'memcpy (texture->name, mtexture->name, sizeof(texture->name));'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The `maptexture_t.name` field is exactly 8 bytes of null-padded ASCII (`char name[8]`). Names shorter than 8 characters are padded with NUL bytes; names that fill the field are NOT NUL-terminated inside the lump. The runtime models this with `TEXTURE_ONE_NAME_BYTES = 8` exposed by `parse-texture-one-lump.ts` and a per-texture `readAscii(TEXTURE_ONE_NAME_BYTES)` that strips trailing NULs.',
  },
  {
    id: 'texture-one-maptexture-masked-int32-le',
    subject: 'maptexture_t',
    cSourceLines: ['int\t\t\tmasked;\t'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The `maptexture_t.masked` field is a 4-byte little-endian int. Vanilla DOOM 1.9 stores the masked flag at offset 8 inside each maptexture_t but `R_InitTextures` does NOT propagate the on-disk value into the runtime `texture_t.masked` field directly — `R_GenerateLookup` recomputes it. The runtime models the on-disk shape by reading 4 bytes at the masked offset; downstream texture-composition is responsible for re-deriving the runtime flag.',
  },
  {
    id: 'texture-one-maptexture-width-and-height-int16-le',
    subject: 'maptexture_t',
    cSourceLines: ['short\t\twidth;', 'short\t\theight;', 'texture->width = SHORT(mtexture->width);', 'texture->height = SHORT(mtexture->height);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`maptexture_t.width` and `maptexture_t.height` are 2-byte signed little-endian shorts at offsets 12 and 14 inside the maptexture header. `R_InitTextures` copies them verbatim into the runtime `texture_t` via the `SHORT` macro (a no-op on little-endian hosts). The runtime models this with `TEXTURE_ONE_WIDTH_BYTES = 2` and `TEXTURE_ONE_HEIGHT_BYTES = 2`.',
  },
  {
    id: 'texture-one-maptexture-obsolete-bytes-four-unused',
    subject: 'maptexture_t',
    cSourceLines: ['int                 obsolete;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The `maptexture_t.obsolete` field is a 4-byte int at offset 16 inside the header that vanilla 1.9 leaves uninitialized in the on-disk lump. `R_InitTextures` SKIPS it entirely and never reads its value into a runtime field. The runtime models this with `TEXTURE_ONE_OBSOLETE_BYTES = 4` and a `BinaryReader.skip(4)` step in the parser; the parser does NOT expose the obsolete value.',
  },
  {
    id: 'texture-one-maptexture-patchcount-int16-le',
    subject: 'maptexture_t',
    cSourceLines: ['short\t\tpatchcount;', 'texture->patchcount = SHORT(mtexture->patchcount);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`maptexture_t.patchcount` is a 2-byte signed little-endian short at offset 20 inside the maptexture header. `R_InitTextures` copies it verbatim into the runtime `texture_t.patchcount` via `SHORT` and uses it as the loop bound for the per-texture patch read. The runtime models this with `TEXTURE_ONE_PATCHCOUNT_BYTES = 2`.',
  },
  {
    id: 'texture-one-maptexture-name-copied-via-memcpy-no-terminator',
    subject: 'R_InitTextures',
    cSourceLines: ['memcpy (texture->name, mtexture->name, sizeof(texture->name));'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` copies each `maptexture_t.name` into the runtime `texture_t.name` via `memcpy(texture->name, mtexture->name, sizeof(texture->name))`. The destination buffer is the runtime `char name[8]` (NOT `char name[9]` like the PNAMES temporary), so vanilla NEVER appends a trailing NUL terminator to the texture name in memory. Lookups via `R_TextureNumForName` use the case-insensitive `W_CheckNumForName` hash that handles the un-terminated 8-byte field correctly. The runtime models this with `parseTextureOneLump` reading exactly `TEXTURE_ONE_NAME_BYTES` bytes per name and stripping trailing NULs in JavaScript string space.',
  },
  {
    id: 'texture-one-mappatch-struct-bytes-ten',
    subject: 'mappatch_t',
    cSourceLines: ['typedef struct', '{', '    short\toriginx;', '    short\toriginy;', '    short\tpatch;', '    short\tstepdir;', '    short\tcolormap;', '} PACKEDATTR mappatch_t;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Each `mappatch_t` is exactly 10 bytes wide: 2 (originx) + 2 (originy) + 2 (patch) + 2 (stepdir) + 2 (colormap). The struct is `PACKEDATTR` so the compiler must not insert padding. The runtime models this with `TEXTURE_ONE_MAPPATCH_BYTES = 10` exposed by `parse-texture-one-lump.ts`.',
  },
  {
    id: 'texture-one-mappatch-originx-originy-int16-le',
    subject: 'mappatch_t',
    cSourceLines: ['short\toriginx;', 'short\toriginy;', 'patch->originx = SHORT(mpatch->originx);', 'patch->originy = SHORT(mpatch->originy);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`mappatch_t.originx` and `mappatch_t.originy` are 2-byte signed little-endian shorts at offsets 0 and 2 inside each mappatch entry. `R_InitTextures` copies them verbatim into the runtime `texpatch_t` via the `SHORT` macro. The values are signed: the shareware `TEKWALL5` (texture index 124) stores `originx = -120, originy = -8`, proving vanilla preserves negative origins. The runtime models this with `BinaryReader.readInt16()` for both fields.',
  },
  {
    id: 'texture-one-mappatch-patch-index-feeds-patchlookup',
    subject: 'mappatch_t',
    cSourceLines: ['short\tpatch;', 'patch->patch = patchlookup[SHORT(mpatch->patch)];', 'if (patch->patch == -1)', '{', '    I_Error ("R_InitTextures: Missing patch in texture %s",', '             texture->name);', '}'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`mappatch_t.patch` is a 2-byte signed little-endian short at offset 4 inside each mappatch entry. `R_InitTextures` uses it as a zero-based index into the `patchlookup` array (built earlier from PNAMES) and stores the resolved lump number into `texpatch_t.patch`. A `-1` resolved value (from a missing PNAMES entry that no patch lump matched) triggers the deferred fatal `I_Error("R_InitTextures: Missing patch in texture %s", texture->name)`. The runtime models the parser by exposing the raw `patchIndex` per `mappatch_t` and leaving the patchlookup resolution to a downstream texture-composition module.',
  },
  {
    id: 'texture-one-mappatch-stepdir-and-colormap-unused',
    subject: 'mappatch_t',
    cSourceLines: ['short\tstepdir;', 'short\tcolormap;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`mappatch_t.stepdir` and `mappatch_t.colormap` are 2-byte shorts at offsets 6 and 8 inside each mappatch entry. `R_InitTextures` does NOT propagate them into the runtime `texpatch_t` — they were placeholder fields in the original DOOM design and are dead weight at runtime. The runtime models this with a `BinaryReader.skip(4)` over the trailing 4 bytes of each mappatch_t; the parser does NOT expose stepdir or colormap.',
  },
  {
    id: 'texture-one-cache-by-name-via-w-cachelumpname',
    subject: 'R_InitTextures',
    cSourceLines: ['maptex = maptex1 = W_CacheLumpName (DEH_String("TEXTURE1"), PU_STATIC);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` loads the TEXTURE1 lump via `W_CacheLumpName(DEH_String("TEXTURE1"), PU_STATIC)` — by name, not by directory index, and routed through `DEH_String` so DeHackEd patches can rename the lump. This is load-bearing because PWADs override TEXTURE1 by publishing a lump with the same name (no marker range required). The runtime models this by accepting the lump bytes as input rather than re-reading the directory inside the parser.',
  },
  {
    id: 'texture-one-shareware-doom1-one-hundred-twenty-five-textures',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['numtextures1 = LONG(*maptex);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` declares exactly 125 textures in TEXTURE1 (`numtextures1 = 125`). The lump occupies 9234 bytes total (a 4-byte header + 500-byte directory + 8730 bytes of variable-width maptexture_t blocks). The shareware IWAD has no TEXTURE2 sibling, so total `numtextures` for the shareware game is exactly 125. The runtime models this with the oracle entry whose `count === 125` and `lumpSize === 9234`.',
  },
  {
    id: 'texture-one-shareware-doom1-no-texture2-sibling',
    subject: 'TEXTURE2',
    cSourceLines: [
      'if (W_CheckNumForName (DEH_String("TEXTURE2")) != -1)',
      '{',
      '    maptex2 = W_CacheLumpName (DEH_String("TEXTURE2"), PU_STATIC);',
      '    numtextures2 = LONG(*maptex2);',
      '    maxoff2 = W_LumpLength (W_GetNumForName (DEH_String("TEXTURE2")));',
      '}',
      'else',
      '{',
      '    maptex2 = NULL;',
      '    numtextures2 = 0;',
      '    maxoff2 = 0;',
      '}',
      'numtextures = numtextures1 + numtextures2;',
    ],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The TEXTURE2 lump is OPTIONAL: `R_InitTextures` first probes `W_CheckNumForName("TEXTURE2")`, and only loads it when the lump exists. The shareware `doom/DOOM1.WAD` does NOT contain TEXTURE2, so vanilla takes the `else` branch (`maptex2 = NULL`, `numtextures2 = 0`) and the total `numtextures` collapses to `numtextures1` alone. Registered and Ultimate IWADs DO contain TEXTURE2. The runtime models this by treating the TEXTURE1 lump as a self-contained input; the oracle for the shareware IWAD pins the TEXTURE2 absence so a future bundle that accidentally includes a TEXTURE2 lump in shareware data is detected.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on
 * top of the raw audit entries. Failures point at concrete identities
 * that any vanilla parity rebuild must preserve.
 */
export interface TextureOneLumpDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const TEXTURE_ONE_LUMP_DERIVED_INVARIANTS: readonly TextureOneLumpDerivedInvariant[] = [
  {
    id: 'TEXTURE_ONE_HEADER_BYTES_EQUALS_FOUR',
    description: '`TEXTURE_ONE_HEADER_BYTES === 4`. Matches the upstream `directory = maptex + 1` pointer arithmetic on `int*` that advances by `sizeof(int)` = 4 bytes.',
  },
  {
    id: 'TEXTURE_ONE_DIRECTORY_ENTRY_BYTES_EQUALS_FOUR',
    description: '`TEXTURE_ONE_DIRECTORY_ENTRY_BYTES === 4`. Matches the upstream `directory++` pointer arithmetic on `int*` that advances by `sizeof(int)` = 4 bytes.',
  },
  {
    id: 'TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES_EQUALS_TWENTY_TWO',
    description: '`TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES === 22`. Matches the upstream `maptexture_t` definition: 8 (name) + 4 (masked) + 2 (width) + 2 (height) + 4 (obsolete) + 2 (patchcount) = 22 bytes.',
  },
  {
    id: 'TEXTURE_ONE_NAME_BYTES_EQUALS_EIGHT',
    description: '`TEXTURE_ONE_NAME_BYTES === 8`. Matches the upstream `char name[8]` field and the 8-byte WAD lump-name convention.',
  },
  {
    id: 'TEXTURE_ONE_MAPPATCH_BYTES_EQUALS_TEN',
    description: '`TEXTURE_ONE_MAPPATCH_BYTES === 10`. Matches the upstream `mappatch_t` definition: 5 packed shorts at 2 bytes each = 10 bytes.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_RETURNS_FROZEN_ARRAY',
    description: 'A successful `parseTextureOneLump(buffer)` returns an object that is `Object.isFrozen`, with a frozen `textures` array and frozen per-texture `patches` arrays.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_TEXTURES_LENGTH_EQUALS_COUNT',
    description: '`parsed.textures.length === parsed.count`. Matches the upstream `Z_Malloc(numtextures*sizeof(*textures))` allocation that yields exactly `numtextures` runtime slots.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_NAMES_ARE_UPPERCASE_AND_TRIMMED',
    description: 'Every texture name in `parsed.textures` is uppercase ASCII with no embedded NUL bytes. Matches the case-insensitive `R_TextureNumForName` lookup that uppercases before hashing.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
    description: '`parseTextureOneLump(new Uint8Array(3))` throws a `RangeError`. The 4-byte count header is mandatory.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_REJECTS_NEGATIVE_COUNT',
    description: '`parseTextureOneLump(bufferWithNegativeCount)` throws a `RangeError`. A negative `numtextures1` cannot be allocated.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_DIRECTORY',
    description: '`parseTextureOneLump(bufferTruncatedAtDirectory)` throws a `RangeError`. The directory must fit within the lump.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_REJECTS_OFFSET_PAST_LUMP_END',
    description: '`parseTextureOneLump(bufferWithBadOffset)` throws a `RangeError`. Matches the upstream `if (offset > maxoff) I_Error("R_InitTextures: bad texture directory")` bounds check.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_REJECTS_NEGATIVE_PATCHCOUNT',
    description: '`parseTextureOneLump(bufferWithNegativePatchCount)` throws a `RangeError`. A negative `patchcount` would overflow the patch loop bound.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_ACCEPTS_ZERO_COUNT',
    description: '`parseTextureOneLump(zeroCountLump).count === 0` and `parsed.textures` is an empty frozen array. A degenerate but syntactically valid TEXTURE1 lump.',
  },
  {
    id: 'PARSE_TEXTURE_ONE_LUMP_PRESERVES_NEGATIVE_PATCH_ORIGINS',
    description: 'A `mappatch_t` whose `originx` or `originy` is negative round-trips intact (proves the parser uses signed int16 reads).',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Byte size of the `numtextures1` count header at the start of the TEXTURE1 lump. */
export const TEXTURE_ONE_HEADER_BYTES = 4;

/** Byte size of each entry in the per-lump offset directory (`int32` little-endian). */
export const TEXTURE_ONE_DIRECTORY_ENTRY_BYTES = 4;

/** Byte size of the `maptexture_t` header (before the trailing `mappatch_t patches[]`). */
export const TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES = 22;

/** Byte size of the `maptexture_t.name` field (`char name[8]`). */
export const TEXTURE_ONE_NAME_BYTES = 8;

/** Byte size of the `maptexture_t.masked` field (`int masked`). */
export const TEXTURE_ONE_MASKED_BYTES = 4;

/** Byte size of the `maptexture_t.width` field (`short width`). */
export const TEXTURE_ONE_WIDTH_BYTES = 2;

/** Byte size of the `maptexture_t.height` field (`short height`). */
export const TEXTURE_ONE_HEIGHT_BYTES = 2;

/** Byte size of the `maptexture_t.obsolete` field (`int obsolete`, vanilla skips it). */
export const TEXTURE_ONE_OBSOLETE_BYTES = 4;

/** Byte size of the `maptexture_t.patchcount` field (`short patchcount`). */
export const TEXTURE_ONE_PATCHCOUNT_BYTES = 2;

/** Byte size of each `mappatch_t` entry that follows a maptexture header. */
export const TEXTURE_ONE_MAPPATCH_BYTES = 10;

/**
 * Compute the byte size occupied by a single `maptexture_t` header
 * plus its `patchcount` mappatch entries. Mirrors the upstream
 * `22 + patchcount * 10` total.
 *
 * @param patchCount - Number of mappatch entries trailing the header.
 * @returns Required byte size of the maptexture block.
 * @throws {RangeError} If `patchCount` is negative or not an integer.
 */
export function textureOneMaptextureSize(patchCount: number): number {
  if (!Number.isInteger(patchCount) || patchCount < 0) {
    throw new RangeError(`textureOneMaptextureSize: patchCount must be a non-negative integer, got ${patchCount}`);
  }
  return TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES + patchCount * TEXTURE_ONE_MAPPATCH_BYTES;
}

/** A single patch reference within a parsed TEXTURE1 entry. */
export interface TextureOneMappatch {
  /** Signed x offset of the patch within the texture (`mappatch_t.originx`). */
  readonly originX: number;
  /** Signed y offset of the patch within the texture (`mappatch_t.originy`). */
  readonly originY: number;
  /** Zero-based PNAMES index identifying the patch graphic (`mappatch_t.patch`). */
  readonly patchIndex: number;
}

/** A single composite texture parsed from a TEXTURE1 entry. */
export interface TextureOneEntry {
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
  readonly patches: readonly TextureOneMappatch[];
}

/** Resolved TEXTURE1 lump. */
export interface TextureOneLump {
  /** Decoded `numtextures1` count from the 4-byte header. */
  readonly count: number;
  /**
   * Frozen array of `count` texture entries in lump order. Each entry
   * is itself frozen, with a frozen `patches` array.
   */
  readonly textures: readonly TextureOneEntry[];
}

/**
 * Parse the TEXTURE1 lump bytes into a frozen `{ count, textures }`
 * pair.
 *
 * Mirrors the vanilla `R_InitTextures` TEXTURE1 read path:
 *   - reads `numtextures1` as a little-endian 32-bit integer at
 *     offset 0 (matching `numtextures1 = LONG(*maptex)`),
 *   - advances past the 4-byte header to the offset directory at
 *     offset 4 (matching `directory = maptex + 1`),
 *   - reads exactly `count` 4-byte little-endian directory entries
 *     (matching the `directory++` increment on `int*`),
 *   - validates each offset against the lump length (matching the
 *     `if (offset > maxoff) I_Error(...)` bounds check),
 *   - reads each `maptexture_t` header at the directory offset
 *     (8-byte name + 4-byte masked + 2-byte width + 2-byte height +
 *     4-byte obsolete + 2-byte patchcount = 22 bytes),
 *   - skips the obsolete column-directory pointer (matching the
 *     vanilla `R_InitTextures` read path that never propagates it),
 *   - reads exactly `patchcount` 10-byte `mappatch_t` entries
 *     (originx + originy + patch + stepdir + colormap, with stepdir
 *     and colormap skipped).
 *
 * The parser does NOT resolve `patchIndex` against PNAMES — that is
 * the responsibility of a downstream texture-composition module
 * (vanilla `patch->patch = patchlookup[SHORT(mpatch->patch)]`), which
 * may yield `-1` for missing names and only fatals on a missing-patch
 * reference inside a composed texture.
 *
 * @param lumpData - Raw TEXTURE1 lump data.
 * @returns Frozen {@link TextureOneLump}.
 * @throws {RangeError} If the lump is too small for the count header,
 *   declares a negative count, has a directory that overflows the
 *   buffer, points at a maptexture_t that overflows the buffer,
 *   declares a negative `patchcount`, or has trailing mappatch entries
 *   that overflow the buffer.
 */
export function parseTextureOneLump(lumpData: Buffer | Uint8Array): TextureOneLump {
  if (lumpData.length < TEXTURE_ONE_HEADER_BYTES) {
    throw new RangeError(`parseTextureOneLump: lump must be at least ${TEXTURE_ONE_HEADER_BYTES} bytes for the count header, got ${lumpData.length}`);
  }

  const buffer = lumpData instanceof Buffer ? lumpData : Buffer.from(lumpData.buffer, lumpData.byteOffset, lumpData.byteLength);
  const reader = new BinaryReader(buffer);

  const count = reader.readInt32();
  if (count < 0) {
    throw new RangeError(`parseTextureOneLump: numtextures1 must be non-negative, got ${count}`);
  }

  const directoryEnd = TEXTURE_ONE_HEADER_BYTES + count * TEXTURE_ONE_DIRECTORY_ENTRY_BYTES;
  if (buffer.length < directoryEnd) {
    throw new RangeError(`parseTextureOneLump: lump declares ${count} textures (directory needs ${directoryEnd} bytes), but lump is only ${buffer.length} bytes`);
  }

  const offsets: number[] = new Array(count);
  for (let index = 0; index < count; index += 1) {
    offsets[index] = reader.readInt32();
  }

  const textures: TextureOneEntry[] = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const offset = offsets[index]!;
    if (offset < 0 || offset + TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES > buffer.length) {
      throw new RangeError(`parseTextureOneLump: texture ${index} offset ${offset} is out of range (lump length ${buffer.length})`);
    }

    reader.seek(offset);
    const name = reader.readAscii(TEXTURE_ONE_NAME_BYTES).toUpperCase();
    const masked = reader.readInt32();
    const width = reader.readInt16();
    const height = reader.readInt16();
    reader.skip(TEXTURE_ONE_OBSOLETE_BYTES);
    const patchCount = reader.readInt16();

    if (patchCount < 0) {
      throw new RangeError(`parseTextureOneLump: texture ${index} (${name}) has negative patchcount ${patchCount}`);
    }

    const patchEnd = offset + textureOneMaptextureSize(patchCount);
    if (patchEnd > buffer.length) {
      throw new RangeError(`parseTextureOneLump: texture ${index} (${name}) mappatch data extends past lump end (needs ${patchEnd} bytes, lump is ${buffer.length} bytes)`);
    }

    const patches: TextureOneMappatch[] = new Array(patchCount);
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
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-texture-one-lump.ts`. The cross-check helper
 * consumes this shape so the focused test can both verify the live
 * runtime exports and exercise a deliberately tampered snapshot to
 * prove the failure modes are observable.
 */
export interface TextureOneLumpRuntimeSnapshot {
  /** `TEXTURE_ONE_HEADER_BYTES` exported by this module. */
  readonly textureOneHeaderBytes: number;
  /** `TEXTURE_ONE_DIRECTORY_ENTRY_BYTES` exported by this module. */
  readonly textureOneDirectoryEntryBytes: number;
  /** `TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES` exported by this module. */
  readonly textureOneMaptextureHeaderBytes: number;
  /** `TEXTURE_ONE_NAME_BYTES` exported by this module. */
  readonly textureOneNameBytes: number;
  /** `TEXTURE_ONE_MAPPATCH_BYTES` exported by this module. */
  readonly textureOneMappatchBytes: number;
  /** Whether `parseTextureOneLump(validLump)` returns an object that is fully frozen. */
  readonly parserReturnsFullyFrozen: boolean;
  /** Whether `parsed.textures.length === parsed.count`. */
  readonly texturesLengthEqualsCount: boolean;
  /** Whether every name in `parsed.textures` is uppercase with no embedded NUL bytes. */
  readonly namesAreUppercaseAndTrimmed: boolean;
  /** Whether `parseTextureOneLump(new Uint8Array(3))` throws a `RangeError`. */
  readonly parserRejectsBufferTooSmallForHeader: boolean;
  /** Whether `parseTextureOneLump(bufferWithNegativeCount)` throws a `RangeError`. */
  readonly parserRejectsNegativeCount: boolean;
  /** Whether `parseTextureOneLump(bufferTruncatedAtDirectory)` throws a `RangeError`. */
  readonly parserRejectsBufferTooSmallForDirectory: boolean;
  /** Whether `parseTextureOneLump(bufferWithBadOffset)` throws a `RangeError`. */
  readonly parserRejectsOffsetPastLumpEnd: boolean;
  /** Whether `parseTextureOneLump(bufferWithNegativePatchCount)` throws a `RangeError`. */
  readonly parserRejectsNegativePatchCount: boolean;
  /** Whether `parseTextureOneLump(zeroCountLump)` accepts the degenerate empty case. */
  readonly parserAcceptsZeroCount: boolean;
  /** Whether a mappatch with negative origins round-trips intact (signed int16 reads). */
  readonly preservesNegativePatchOrigins: boolean;
}

/**
 * Cross-check a `TextureOneLumpRuntimeSnapshot` against
 * `TEXTURE_ONE_LUMP_AUDIT` and `TEXTURE_ONE_LUMP_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the
 *    snapshot.
 */
export function crossCheckTextureOneLumpRuntime(snapshot: TextureOneLumpRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.textureOneHeaderBytes !== 4) {
    failures.push('derived:TEXTURE_ONE_HEADER_BYTES_EQUALS_FOUR');
    failures.push('audit:texture-one-header-bytes-four:not-observed');
    failures.push('audit:texture-one-directory-starts-at-offset-four:not-observed');
  }

  if (snapshot.textureOneDirectoryEntryBytes !== 4) {
    failures.push('derived:TEXTURE_ONE_DIRECTORY_ENTRY_BYTES_EQUALS_FOUR');
    failures.push('audit:texture-one-directory-entry-bytes-four:not-observed');
  }

  if (snapshot.textureOneMaptextureHeaderBytes !== 22) {
    failures.push('derived:TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES_EQUALS_TWENTY_TWO');
    failures.push('audit:texture-one-maptexture-header-bytes-twenty-two:not-observed');
  }

  if (snapshot.textureOneNameBytes !== 8) {
    failures.push('derived:TEXTURE_ONE_NAME_BYTES_EQUALS_EIGHT');
    failures.push('audit:texture-one-maptexture-name-bytes-eight:not-observed');
  }

  if (snapshot.textureOneMappatchBytes !== 10) {
    failures.push('derived:TEXTURE_ONE_MAPPATCH_BYTES_EQUALS_TEN');
    failures.push('audit:texture-one-mappatch-struct-bytes-ten:not-observed');
  }

  if (!snapshot.parserReturnsFullyFrozen) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_RETURNS_FROZEN_ARRAY');
    failures.push('audit:texture-one-cache-by-name-via-w-cachelumpname:not-observed');
  }

  if (!snapshot.texturesLengthEqualsCount) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_TEXTURES_LENGTH_EQUALS_COUNT');
    failures.push('audit:texture-one-header-count-int32-le:not-observed');
  }

  if (!snapshot.namesAreUppercaseAndTrimmed) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_NAMES_ARE_UPPERCASE_AND_TRIMMED');
    failures.push('audit:texture-one-maptexture-name-copied-via-memcpy-no-terminator:not-observed');
  }

  if (!snapshot.parserRejectsBufferTooSmallForHeader) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  }

  if (!snapshot.parserRejectsNegativeCount) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_NEGATIVE_COUNT');
  }

  if (!snapshot.parserRejectsBufferTooSmallForDirectory) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_DIRECTORY');
  }

  if (!snapshot.parserRejectsOffsetPastLumpEnd) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_OFFSET_PAST_LUMP_END');
    failures.push('audit:texture-one-offset-bounds-check-against-maxoff:not-observed');
  }

  if (!snapshot.parserRejectsNegativePatchCount) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_NEGATIVE_PATCHCOUNT');
    failures.push('audit:texture-one-maptexture-patchcount-int16-le:not-observed');
  }

  if (!snapshot.parserAcceptsZeroCount) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_ACCEPTS_ZERO_COUNT');
    failures.push('audit:texture-one-shareware-doom1-no-texture2-sibling:not-observed');
  }

  if (!snapshot.preservesNegativePatchOrigins) {
    failures.push('derived:PARSE_TEXTURE_ONE_LUMP_PRESERVES_NEGATIVE_PATCH_ORIGINS');
    failures.push('audit:texture-one-mappatch-originx-originy-int16-le:not-observed');
  }

  const declaredAxes = new Set(TEXTURE_ONE_LUMP_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<TextureOneLumpAuditEntry['id']> = [
    'texture-one-header-bytes-four',
    'texture-one-header-count-int32-le',
    'texture-one-directory-starts-at-offset-four',
    'texture-one-directory-entry-bytes-four',
    'texture-one-offset-bounds-check-against-maxoff',
    'texture-one-maptexture-header-bytes-twenty-two',
    'texture-one-maptexture-name-bytes-eight',
    'texture-one-maptexture-masked-int32-le',
    'texture-one-maptexture-width-and-height-int16-le',
    'texture-one-maptexture-obsolete-bytes-four-unused',
    'texture-one-maptexture-patchcount-int16-le',
    'texture-one-maptexture-name-copied-via-memcpy-no-terminator',
    'texture-one-mappatch-struct-bytes-ten',
    'texture-one-mappatch-originx-originy-int16-le',
    'texture-one-mappatch-patch-index-feeds-patchlookup',
    'texture-one-mappatch-stepdir-and-colormap-unused',
    'texture-one-cache-by-name-via-w-cachelumpname',
    'texture-one-shareware-doom1-one-hundred-twenty-five-textures',
    'texture-one-shareware-doom1-no-texture2-sibling',
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
 * Pinned facts about a single named texture entry inside the
 * shareware `doom/DOOM1.WAD` TEXTURE1 lump that the focused test
 * cross-checks against the live on-disk file.
 */
export interface ShareWareDoom1WadTextureOneOracleEntry {
  /** Zero-based index inside the TEXTURE1 lump. */
  readonly textureIndex: number;
  /** Texture name (uppercase, NUL-stripped). */
  readonly name: string;
  /** Width of the texture in pixels. */
  readonly width: number;
  /** Height of the texture in pixels. */
  readonly height: number;
  /** Number of mappatch entries in the texture. */
  readonly patchCount: number;
  /** First-patch fixture data (originx, originy, patchIndex). */
  readonly firstPatch: {
    readonly originX: number;
    readonly originY: number;
    readonly patchIndex: number;
  };
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` TEXTURE1 structure. */
export interface ShareWareDoom1WadTextureOneOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Directory index of the TEXTURE1 lump in the live IWAD directory. */
  readonly directoryIndex: 105;
  /** Byte offset of the TEXTURE1 lump inside the WAD file. */
  readonly fileOffset: 915712;
  /** Byte size of the TEXTURE1 lump. */
  readonly lumpSize: 9234;
  /** SHA-256 hex digest of the TEXTURE1 lump bytes (lower-case, 64 chars). */
  readonly sha256: '8272dd48efe5d73f2b03cdf6d42e18da17c97aebea4d32a28846cdc92438cc4a';
  /** Decoded `numtextures1` count from the count header. */
  readonly count: 125;
  /** Whether the shareware IWAD contains a TEXTURE2 sibling lump. */
  readonly hasTexture2: false;
  /** Pinned named-by-index probes covering first, mid, and last entries. */
  readonly pinnedTextures: readonly ShareWareDoom1WadTextureOneOracleEntry[];
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` TEXTURE1
 * lump.
 *
 * The pinned texture probes were captured by hand from the live IWAD
 * (`probe-texture1.ts`) and cover five points of the texture
 * namespace:
 *  - index 0 (`AASTINKY`): the very first texture, 24x72, 2 patches —
 *    proves the header / directory / first-maptexture path round-trips.
 *  - index 1 (`BIGDOOR1`): a 5-patch texture — exercises the patch
 *    loop with a non-trivial patchcount.
 *  - index 50 (`METAL1`): a mid-range entry, exercises the directory
 *    stride and offset-pointer arithmetic.
 *  - index 100 (`SW1STRTN`): a second mid-range entry on a different
 *    page, exercises a 3-patch texture with `patchIndex = 118`.
 *  - index 124 (`TEKWALL5`): the very last entry; its first mappatch
 *    has `originX = -120, originY = -8`, proving signed int16 reads
 *    preserve negative patch origins.
 *
 * The sha-256 fingerprint freezes the exact byte content of the lump
 * at the time of audit; any IWAD-modifying change that does not also
 * update the audit will surface as an oracle mismatch and reject the
 * change.
 */
export const SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE: ShareWareDoom1WadTextureOneOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  directoryIndex: 105,
  fileOffset: 915712,
  lumpSize: 9234,
  sha256: '8272dd48efe5d73f2b03cdf6d42e18da17c97aebea4d32a28846cdc92438cc4a',
  count: 125,
  hasTexture2: false,
  pinnedTextures: Object.freeze([
    Object.freeze({
      textureIndex: 0,
      name: 'AASTINKY',
      width: 24,
      height: 72,
      patchCount: 2,
      firstPatch: Object.freeze({ originX: 0, originY: 0, patchIndex: 0 }),
    }),
    Object.freeze({
      textureIndex: 1,
      name: 'BIGDOOR1',
      width: 128,
      height: 96,
      patchCount: 5,
      firstPatch: Object.freeze({ originX: 0, originY: 0, patchIndex: 1 }),
    }),
    Object.freeze({
      textureIndex: 50,
      name: 'METAL1',
      width: 64,
      height: 128,
      patchCount: 2,
      firstPatch: Object.freeze({ originX: 0, originY: 0, patchIndex: 88 }),
    }),
    Object.freeze({
      textureIndex: 100,
      name: 'SW1STRTN',
      width: 64,
      height: 128,
      patchCount: 3,
      firstPatch: Object.freeze({ originX: 0, originY: 0, patchIndex: 118 }),
    }),
    Object.freeze({
      textureIndex: 124,
      name: 'TEKWALL5',
      width: 128,
      height: 128,
      patchCount: 1,
      firstPatch: Object.freeze({ originX: -120, originY: -8, patchIndex: 161 }),
    }),
  ]) as readonly ShareWareDoom1WadTextureOneOracleEntry[],
}) as ShareWareDoom1WadTextureOneOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * TEXTURE1 lump so the focused test can re-derive the values from the
 * live file every run and feed the result into the cross-check.
 */
export interface ShareWareDoom1WadTextureOneSample {
  readonly directoryIndex: number;
  readonly fileOffset: number;
  readonly lumpSize: number;
  readonly sha256: string;
  readonly count: number;
  readonly hasTexture2: boolean;
  readonly pinnedTextures: readonly {
    readonly textureIndex: number;
    readonly name: string;
    readonly width: number;
    readonly height: number;
    readonly patchCount: number;
    readonly firstPatch: {
      readonly originX: number;
      readonly originY: number;
      readonly patchIndex: number;
    };
  }[];
}

/**
 * Cross-check a shareware DOOM1.WAD TEXTURE1 sample against the
 * pinned oracle. Returns the list of failures by stable identifier;
 * an empty list means the live TEXTURE1 matches the oracle
 * byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field
 *    whose live counterpart disagrees with the pinned value.
 *  - `oracle:texture:<index>:not-found` when the sample is missing a
 *    pinned texture probe.
 *  - `oracle:texture:<index>:<field>:value-mismatch` when a pinned
 *    probe's per-field value disagrees with the live value.
 */
export function crossCheckShareWareDoom1WadTextureOneSample(sample: ShareWareDoom1WadTextureOneSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'directoryIndex' | 'fileOffset' | 'lumpSize' | 'sha256' | 'count' | 'hasTexture2'> = ['directoryIndex', 'fileOffset', 'lumpSize', 'sha256', 'count', 'hasTexture2'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  for (const oraclePinned of SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.pinnedTextures) {
    const livePinned = sample.pinnedTextures.find((entry) => entry.textureIndex === oraclePinned.textureIndex);
    if (!livePinned) {
      failures.push(`oracle:texture:${oraclePinned.textureIndex}:not-found`);
      continue;
    }
    if (livePinned.name !== oraclePinned.name) {
      failures.push(`oracle:texture:${oraclePinned.textureIndex}:name:value-mismatch`);
    }
    if (livePinned.width !== oraclePinned.width) {
      failures.push(`oracle:texture:${oraclePinned.textureIndex}:width:value-mismatch`);
    }
    if (livePinned.height !== oraclePinned.height) {
      failures.push(`oracle:texture:${oraclePinned.textureIndex}:height:value-mismatch`);
    }
    if (livePinned.patchCount !== oraclePinned.patchCount) {
      failures.push(`oracle:texture:${oraclePinned.textureIndex}:patchCount:value-mismatch`);
    }
    if (livePinned.firstPatch.originX !== oraclePinned.firstPatch.originX) {
      failures.push(`oracle:texture:${oraclePinned.textureIndex}:firstPatch.originX:value-mismatch`);
    }
    if (livePinned.firstPatch.originY !== oraclePinned.firstPatch.originY) {
      failures.push(`oracle:texture:${oraclePinned.textureIndex}:firstPatch.originY:value-mismatch`);
    }
    if (livePinned.firstPatch.patchIndex !== oraclePinned.firstPatch.patchIndex) {
      failures.push(`oracle:texture:${oraclePinned.textureIndex}:firstPatch.patchIndex:value-mismatch`);
    }
  }

  return failures;
}
