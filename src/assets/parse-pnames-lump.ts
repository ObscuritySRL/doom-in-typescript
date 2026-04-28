/**
 * Audit ledger for the vanilla DOOM 1.9 PNAMES lump parser, the patch
 * name table that the texture-composition pipeline consults to map the
 * `mappatch_t.patch` indices stored inside TEXTURE1 / TEXTURE2 entries
 * onto WAD directory lump numbers via the `patchlookup` array built in
 * `R_InitTextures`.
 *
 * This module pins the runtime contract one level deeper than the prior
 * 05-001..05-004 marker / lookup audits, the 05-005 PLAYPAL / COLORMAP
 * audit, the 05-006 patch picture format audit, and the 05-007 flat
 * namespace audit: the 4-byte int32-LE `nummappatches` count header at
 * offset 0, the 8-byte null-padded ASCII name fields that follow it
 * (each fed through a 9-byte `char name[9]; name[8] = 0;` stack buffer
 * before being looked up), the `name_p = names + 4` start-of-name-table
 * pointer arithmetic, the `Z_Malloc(nummappatches*sizeof(*patchlookup))`
 * allocation that yields exactly `nummappatches` lookup slots, the
 * `patchlookup[i] = W_CheckNumForName(name)` lookup that yields `-1`
 * (rather than a fatal error) when a name is absent from the directory,
 * and the deferred `I_Error("R_InitTextures: Missing patch in texture
 * %s")` that fires later if a TEXTURE1 entry references a -1 lookup
 * slot. The accompanying focused test imports the ledger plus a
 * self-contained `parsePnamesLump` runtime exposed by this module and
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
 *      `src/doom/w_wad.c`, `src/doom/p_setup.c`).
 *
 * The format and constant declarations below are pinned against
 * authority 5 because the byte layout of the PNAMES lump and the
 * arithmetic that consumes it are textual constants the binary cannot
 * disagree with: every header byte stride, name field width, stack
 * buffer size, and lookup formula is a property of the on-disk byte
 * stream and of the `R_InitTextures` body in the upstream C source, not
 * of any runtime register state. The shareware `DOOM1.WAD` oracle facts
 * (PNAMES at directory index 106, file offset 924948, raw size 2804
 * bytes, 350 declared patch names, sha-256 fingerprint, and selected
 * pinned name-by-index probes) are pinned against authority 2 — the
 * local IWAD itself — and re-derived from the on-disk file every test
 * run.
 */

import { BinaryReader } from '../core/binaryReader.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract of the PNAMES lump parser, pinned to its upstream Chocolate
 * Doom 2.2.1 declaration.
 */
export interface PnamesLumpAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'pnames-header-bytes-four'
    | 'pnames-header-count-int32-le'
    | 'pnames-header-count-via-long-macro'
    | 'pnames-name-table-starts-at-offset-four'
    | 'pnames-name-field-bytes-eight'
    | 'pnames-name-stack-buffer-bytes-nine'
    | 'pnames-name-stack-buffer-explicit-null-terminator'
    | 'pnames-name-copied-via-m-stringcopy'
    | 'pnames-total-size-formula-four-plus-count-times-eight'
    | 'pnames-cache-by-name-via-w-cachelumpname'
    | 'pnames-patchlookup-size-equals-nummappatches'
    | 'pnames-patchlookup-uses-w-checknumforname'
    | 'pnames-patchlookup-missing-yields-negative-one'
    | 'pnames-missing-patch-fatal-only-when-referenced-by-texture'
    | 'pnames-shareware-doom1-three-hundred-fifty-patches';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'PNAMES' | 'R_InitTextures' | 'patchlookup' | 'parsePnamesLump' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/doom/r_data.c' | 'src/doom/w_wad.c' | 'src/doom/p_setup.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and runtime
 * parser contract the runtime PNAMES loader must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const PNAMES_LUMP_AUDIT: readonly PnamesLumpAuditEntry[] = [
  {
    id: 'pnames-header-bytes-four',
    subject: 'PNAMES',
    cSourceLines: ['nummappatches = LONG ( *((int *)names) );', 'name_p = names+4;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` reads the first 4 bytes of the PNAMES lump as a single `int` and then advances `name_p` to `names + 4` to start the name table. The 4-byte header stride is a load-bearing property of the lump format. The runtime models this with `PNAMES_HEADER_BYTES = 4` exposed by `parse-pnames-lump.ts`.',
  },
  {
    id: 'pnames-header-count-int32-le',
    subject: 'PNAMES',
    cSourceLines: ['nummappatches = LONG ( *((int *)names) );'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` reads `nummappatches` as a little-endian 32-bit integer at offset 0 of the PNAMES lump (an `int*` reinterpret on a buffer that is byte-swap-corrected via the `LONG` macro, which is a no-op on little-endian hosts). The runtime models this with `parsePnamesLump` reading the count via `BinaryReader.readInt32()` (signed, little-endian).',
  },
  {
    id: 'pnames-header-count-via-long-macro',
    subject: 'R_InitTextures',
    cSourceLines: ['nummappatches = LONG ( *((int *)names) );'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The vanilla source wraps the count read in the `LONG` macro so the same source compiles unchanged on big-endian hosts. The runtime models this by always interpreting the 4-byte header as little-endian regardless of host byte order, which is what `LONG` resolves to on the only host vanilla DOOM 1.9 was shipped on (x86 little-endian DOS).',
  },
  {
    id: 'pnames-name-table-starts-at-offset-four',
    subject: 'PNAMES',
    cSourceLines: ['name_p = names+4;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` sets the name-table pointer `name_p` to `names + 4`, immediately after the 4-byte count header. There is no padding between the header and the first name. The runtime models this by reading the names sequentially after the header inside `parsePnamesLump`.',
  },
  {
    id: 'pnames-name-field-bytes-eight',
    subject: 'PNAMES',
    cSourceLines: ['M_StringCopy(name, name_p + i * 8, sizeof(name));'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` copies exactly 8 bytes per name from the lump (the `i * 8` stride). Names shorter than 8 characters are padded with NUL bytes; names that fill the field are NOT NUL-terminated inside the lump. The runtime models this with `PNAMES_NAME_BYTES = 8` exposed by `parse-pnames-lump.ts` and a per-name `readAscii(PNAMES_NAME_BYTES)` that strips trailing NULs.',
  },
  {
    id: 'pnames-name-stack-buffer-bytes-nine',
    subject: 'R_InitTextures',
    cSourceLines: ['char\t\tname[9];'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` allocates a 9-byte stack buffer `name[9]` to hold each looked-up name. The 9th byte exists solely to provide room for a NUL terminator after the 8-byte name field; lookups, comparisons, and the missing-patch error message all treat the buffer as a C string, which requires the trailing NUL. The runtime models this with `PNAMES_NAME_BUFFER_BYTES = 9` exposed by `parse-pnames-lump.ts`.',
  },
  {
    id: 'pnames-name-stack-buffer-explicit-null-terminator',
    subject: 'R_InitTextures',
    cSourceLines: ['name[8] = 0;'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` writes `name[8] = 0;` once before the lookup loop, then reuses the same buffer for every iteration. The explicit NUL terminator at offset 8 is what makes the buffer safe to use with C string APIs even when the on-disk name fills all 8 bytes. The runtime models this by exposing `PNAMES_NAME_TERMINATOR_OFFSET = 8` and `PNAMES_NAME_TERMINATOR_BYTE = 0` so a snapshot of the runtime can prove the offset matches the upstream literal.',
  },
  {
    id: 'pnames-name-copied-via-m-stringcopy',
    subject: 'R_InitTextures',
    cSourceLines: ['M_StringCopy(name, name_p + i * 8, sizeof(name));'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` copies each name with `M_StringCopy(name, name_p + i*8, sizeof(name))` (Chocolate Doom 2.2.1) — a `strncpy` wrapper that copies up to `sizeof(name) - 1 = 8` bytes and forces NUL termination at offset 8. Vanilla DOOM 1.9 used `strncpy(name, name_p+i*8, 8)`. Both yield the same observable contents because `name[8] = 0` was already set. The runtime models this with `parsePnamesLump` reading exactly `PNAMES_NAME_BYTES` bytes per name and stripping trailing NULs in JavaScript string space.',
  },
  {
    id: 'pnames-total-size-formula-four-plus-count-times-eight',
    subject: 'PNAMES',
    cSourceLines: ['nummappatches = LONG ( *((int *)names) );', 'name_p = names+4;', 'M_StringCopy(name, name_p + i * 8, sizeof(name));'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The total PNAMES lump size in bytes is `4 + nummappatches * 8`: a 4-byte count header followed by `nummappatches` 8-byte name fields with no inter-field padding and no trailing data. The runtime models this with `pnamesLumpSizeForCount(count) = 4 + count * 8` exposed by `parse-pnames-lump.ts`.',
  },
  {
    id: 'pnames-cache-by-name-via-w-cachelumpname',
    subject: 'R_InitTextures',
    cSourceLines: ['names = W_CacheLumpName (DEH_String("PNAMES"), PU_STATIC);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` loads the PNAMES lump via `W_CacheLumpName(DEH_String("PNAMES"), PU_STATIC)` — by name, not by directory index, and routed through `DEH_String` so DeHackEd patches can rename the lump. This is load-bearing because PWADs override PNAMES by publishing a lump with the same name (no marker range required). The runtime models this by accepting the lump bytes as input rather than re-reading the directory inside the parser.',
  },
  {
    id: 'pnames-patchlookup-size-equals-nummappatches',
    subject: 'patchlookup',
    cSourceLines: ['patchlookup = Z_Malloc(nummappatches*sizeof(*patchlookup), PU_STATIC, NULL);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` allocates exactly `nummappatches` slots for the `patchlookup` array. There is NO trailing guard slot (unlike `flattranslation`, which is `numflats+1`). The runtime models this by exposing `parsePnamesLump(lump).names.length === parsePnamesLump(lump).count`.',
  },
  {
    id: 'pnames-patchlookup-uses-w-checknumforname',
    subject: 'patchlookup',
    cSourceLines: ['patchlookup[i] = W_CheckNumForName(name);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      '`R_InitTextures` resolves each patch name via `W_CheckNumForName`, NOT `W_GetNumForName`. `W_CheckNumForName` returns `-1` on miss instead of crashing, so PNAMES is allowed to declare patches that are not present in the loaded directory (for example, registered-content patch names left in a shareware-built PNAMES). The runtime models this by exposing the raw decoded name list and leaving the directory lookup to a downstream texture-composition module.',
  },
  {
    id: 'pnames-patchlookup-missing-yields-negative-one',
    subject: 'patchlookup',
    cSourceLines: ['patchlookup[i] = W_CheckNumForName(name);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'When `W_CheckNumForName` returns `-1`, that value is stored verbatim into `patchlookup[i]`. The negative sentinel propagates downstream and is the signal vanilla uses to detect missing patches at TEXTURE1 composition time. The runtime models this by promising parse-time success on a syntactically valid PNAMES lump even when some declared names cannot be resolved against the WAD directory.',
  },
  {
    id: 'pnames-missing-patch-fatal-only-when-referenced-by-texture',
    subject: 'R_InitTextures',
    cSourceLines: ['patch->patch = patchlookup[SHORT(mpatch->patch)];', 'if (patch->patch == -1)', '{', '\tI_Error ("R_InitTextures: Missing patch in texture %s",', '\t\t\t texture->name);', '}'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The missing-patch fatal `I_Error("R_InitTextures: Missing patch in texture %s", texture->name)` fires only when a TEXTURE1 / TEXTURE2 entry references a `mpatch->patch` index whose `patchlookup` slot is `-1`. PNAMES entries that no texture references can be `-1` without aborting the engine. The runtime models this by separating PNAMES parsing (this module, never throws on a missing-but-syntactically-valid name) from TEXTURE1 composition (a downstream module that will eventually surface the same fatal contract).',
  },
  {
    id: 'pnames-shareware-doom1-three-hundred-fifty-patches',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['nummappatches = LONG ( *((int *)names) );'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` declares exactly 350 patch names (`nummappatches = 350`). The lump occupies `4 + 350 * 8 = 2804` bytes and is the single entry of the `patch-names` lump category in `reference/manifests/wad-map-summary.json`. The runtime models this with the oracle entry whose `count === 350` and `lumpSize === 2804`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface PnamesLumpDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const PNAMES_LUMP_DERIVED_INVARIANTS: readonly PnamesLumpDerivedInvariant[] = [
  {
    id: 'PNAMES_HEADER_BYTES_EQUALS_FOUR',
    description: '`PNAMES_HEADER_BYTES === 4`. Matches the upstream `name_p = names + 4` pointer arithmetic.',
  },
  {
    id: 'PNAMES_NAME_BYTES_EQUALS_EIGHT',
    description: '`PNAMES_NAME_BYTES === 8`. Matches the upstream `name_p + i * 8` stride and the 8-byte WAD lump-name convention.',
  },
  {
    id: 'PNAMES_NAME_BUFFER_BYTES_EQUALS_NINE',
    description: '`PNAMES_NAME_BUFFER_BYTES === 9`. Matches the upstream `char name[9];` stack buffer that holds the 8-byte field plus a trailing NUL terminator.',
  },
  {
    id: 'PNAMES_NAME_TERMINATOR_OFFSET_EQUALS_EIGHT',
    description: '`PNAMES_NAME_TERMINATOR_OFFSET === 8`. Matches the upstream `name[8] = 0;` literal that sets the trailing NUL byte.',
  },
  {
    id: 'PNAMES_NAME_TERMINATOR_BYTE_EQUALS_ZERO',
    description: '`PNAMES_NAME_TERMINATOR_BYTE === 0`. Matches the upstream `name[8] = 0;` literal.',
  },
  {
    id: 'PNAMES_LUMP_SIZE_FORMULA_EQUALS_HEADER_PLUS_COUNT_TIMES_NAME',
    description: '`pnamesLumpSizeForCount(count) === PNAMES_HEADER_BYTES + count * PNAMES_NAME_BYTES`. Matches the upstream layout: a 4-byte count followed by `count` 8-byte names.',
  },
  {
    id: 'PARSE_PNAMES_LUMP_RETURNS_FROZEN_PNAMES_AND_NAMES',
    description: 'A successful `parsePnamesLump(buffer)` returns an object that is `Object.isFrozen`, with a frozen `names` array.',
  },
  {
    id: 'PARSE_PNAMES_LUMP_NAMES_LENGTH_EQUALS_COUNT',
    description: '`parsed.names.length === parsed.count`. Matches the upstream `Z_Malloc(nummappatches*sizeof(*patchlookup))` allocation, which yields exactly `nummappatches` lookup slots.',
  },
  {
    id: 'PARSE_PNAMES_LUMP_NAMES_ARE_UPPERCASE_AND_TRIMMED',
    description: 'Every name in `parsed.names` is uppercase ASCII with no embedded NUL bytes. Matches the case-insensitive lump-name convention enforced by `W_CheckNumForName` (which uppercases before hashing).',
  },
  {
    id: 'PARSE_PNAMES_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
    description: '`parsePnamesLump(new Uint8Array(3))` throws a `RangeError`. The 4-byte count header is mandatory.',
  },
  {
    id: 'PARSE_PNAMES_LUMP_REJECTS_NEGATIVE_COUNT',
    description: '`parsePnamesLump(bufferWithNegativeCount)` throws a `RangeError`. A negative `nummappatches` cannot be allocated.',
  },
  {
    id: 'PARSE_PNAMES_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_DECLARED_COUNT',
    description: '`parsePnamesLump(bufferWithTruncatedNames)` throws a `RangeError` when the declared count would read past the end of the lump.',
  },
  {
    id: 'PARSE_PNAMES_LUMP_ACCEPTS_ZERO_COUNT',
    description: '`parsePnamesLump(zeroCountLump).count === 0` and `parsed.names` is an empty frozen array. A degenerate but syntactically valid PNAMES lump.',
  },
  {
    id: 'PARSE_PNAMES_LUMP_NAME_FIELDS_FILL_EXACTLY_EIGHT_BYTES',
    description: 'A name that fills the entire 8-byte field with no trailing NUL bytes round-trips intact (proves there is no off-by-one in the trim step).',
  },
  {
    id: 'PARSE_PNAMES_LUMP_TRAILING_DATA_IS_IGNORED',
    description: '`parsePnamesLump(bufferWithTrailingPadding)` succeeds and reads exactly `4 + count * 8` bytes; trailing bytes beyond the declared count are ignored. Matches the upstream loop bound `i < nummappatches`.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Byte size of the `nummappatches` count header at the start of the PNAMES lump. */
export const PNAMES_HEADER_BYTES = 4;

/** Byte size of each PNAMES name field (8-byte null-padded ASCII). */
export const PNAMES_NAME_BYTES = 8;

/** Byte size of the C `char name[9]` stack buffer the upstream loop uses (8-byte field + 1-byte NUL terminator). */
export const PNAMES_NAME_BUFFER_BYTES = 9;

/** Offset of the trailing NUL byte inside the 9-byte `name` stack buffer (set once via `name[8] = 0;`). */
export const PNAMES_NAME_TERMINATOR_OFFSET = 8;

/** Value the upstream code writes to `name[8]` (`name[8] = 0;`). */
export const PNAMES_NAME_TERMINATOR_BYTE = 0;

/**
 * Compute the total byte size of a syntactically valid PNAMES lump for
 * a given `count` of declared names. Mirrors the upstream `4 +
 * nummappatches * 8` total: a 4-byte little-endian count header followed
 * by `count` 8-byte name fields with no inter-field padding and no
 * trailing data.
 *
 * @param count - Number of declared patch names.
 * @returns Required byte size of the PNAMES lump.
 * @throws {RangeError} If `count` is negative or not an integer.
 */
export function pnamesLumpSizeForCount(count: number): number {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`pnamesLumpSizeForCount: count must be a non-negative integer, got ${count}`);
  }
  return PNAMES_HEADER_BYTES + count * PNAMES_NAME_BYTES;
}

/** Resolved PNAMES lump. */
export interface PnamesLump {
  /** Decoded `nummappatches` count from the 4-byte header. */
  readonly count: number;
  /**
   * Frozen array of `count` patch names in lump order, uppercased and
   * with trailing NUL bytes stripped. Names that fill the 8-byte field
   * exactly are preserved at full length.
   */
  readonly names: readonly string[];
}

/**
 * Parse the PNAMES lump bytes into a frozen `{ count, names }` pair.
 *
 * Mirrors the vanilla `R_InitTextures` PNAMES read path:
 *   - reads `nummappatches` as a little-endian 32-bit integer at offset 0
 *     (matching `nummappatches = LONG(*((int *)names))`),
 *   - advances past the 4-byte header to the name table at offset 4
 *     (matching `name_p = names + 4`),
 *   - reads exactly `count` 8-byte ASCII name fields (matching the
 *     `i * 8` stride in `M_StringCopy(name, name_p + i*8, sizeof(name))`),
 *   - strips trailing NUL bytes and uppercases the result (matching the
 *     case-insensitive `W_CheckNumForName` lookup that consumes each
 *     name).
 *
 * The parser does NOT resolve the names against a WAD directory — that
 * is the responsibility of a downstream texture-composition module
 * (vanilla `patchlookup[i] = W_CheckNumForName(name)`), which yields
 * `-1` for missing names and only fatals on a missing-patch reference
 * inside a TEXTURE1 / TEXTURE2 entry.
 *
 * @param lumpData - Raw PNAMES lump data.
 * @returns Frozen {@link PnamesLump}.
 * @throws {RangeError} If the lump is too small for the count header,
 *   declares a negative count, or is too small for the declared count.
 */
export function parsePnamesLump(lumpData: Buffer | Uint8Array): PnamesLump {
  if (lumpData.length < PNAMES_HEADER_BYTES) {
    throw new RangeError(`parsePnamesLump: lump must be at least ${PNAMES_HEADER_BYTES} bytes for the count header, got ${lumpData.length}`);
  }

  const buffer = lumpData instanceof Buffer ? lumpData : Buffer.from(lumpData.buffer, lumpData.byteOffset, lumpData.byteLength);
  const reader = new BinaryReader(buffer);

  const count = reader.readInt32();
  if (count < 0) {
    throw new RangeError(`parsePnamesLump: nummappatches must be non-negative, got ${count}`);
  }

  const requiredSize = pnamesLumpSizeForCount(count);
  if (lumpData.length < requiredSize) {
    throw new RangeError(`parsePnamesLump: lump declares ${count} names (needs ${requiredSize} bytes), but lump is only ${lumpData.length} bytes`);
  }

  const names: string[] = new Array(count);
  for (let index = 0; index < count; index += 1) {
    names[index] = reader.readAscii(PNAMES_NAME_BYTES).toUpperCase();
  }

  return Object.freeze({
    count,
    names: Object.freeze(names),
  });
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-pnames-lump.ts`. The cross-check helper consumes
 * this shape so the focused test can both verify the live runtime
 * exports and exercise a deliberately tampered snapshot to prove the
 * failure modes are observable.
 */
export interface PnamesLumpRuntimeSnapshot {
  /** `PNAMES_HEADER_BYTES` exported by this module. */
  readonly pnamesHeaderBytes: number;
  /** `PNAMES_NAME_BYTES` exported by this module. */
  readonly pnamesNameBytes: number;
  /** `PNAMES_NAME_BUFFER_BYTES` exported by this module. */
  readonly pnamesNameBufferBytes: number;
  /** `PNAMES_NAME_TERMINATOR_OFFSET` exported by this module. */
  readonly pnamesNameTerminatorOffset: number;
  /** `PNAMES_NAME_TERMINATOR_BYTE` exported by this module. */
  readonly pnamesNameTerminatorByte: number;
  /** Result of `pnamesLumpSizeForCount(0)` (must equal `PNAMES_HEADER_BYTES`). */
  readonly lumpSizeForZeroCount: number;
  /** Result of `pnamesLumpSizeForCount(350)` for the shareware DOOM1.WAD count. */
  readonly lumpSizeForShareWareCount: number;
  /** Whether `parsePnamesLump(validLump)` returns an object that is fully frozen. */
  readonly parserReturnsFullyFrozen: boolean;
  /** Whether `parsePnamesLump(validLump).names.length === parsed.count`. */
  readonly namesLengthEqualsCount: boolean;
  /** Whether every name in `parsed.names` is uppercase with no embedded NUL bytes. */
  readonly namesAreUppercaseAndTrimmed: boolean;
  /** Whether `parsePnamesLump(new Uint8Array(3))` throws a `RangeError`. */
  readonly parserRejectsBufferTooSmallForHeader: boolean;
  /** Whether `parsePnamesLump(bufferWithNegativeCount)` throws a `RangeError`. */
  readonly parserRejectsNegativeCount: boolean;
  /** Whether `parsePnamesLump(bufferWithTruncatedNames)` throws a `RangeError`. */
  readonly parserRejectsBufferTooSmallForDeclaredCount: boolean;
  /** Whether `parsePnamesLump(zeroCountLump)` accepts the degenerate empty case. */
  readonly parserAcceptsZeroCount: boolean;
  /** Whether a name that fills exactly 8 bytes round-trips intact. */
  readonly nameFieldsFillExactlyEightBytes: boolean;
  /** Whether trailing data beyond the declared count is ignored. */
  readonly trailingDataIsIgnored: boolean;
}

/**
 * Cross-check a `PnamesLumpRuntimeSnapshot` against `PNAMES_LUMP_AUDIT`
 * and `PNAMES_LUMP_DERIVED_INVARIANTS`. Returns the list of failures
 * by stable identifier; an empty list means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckPnamesLumpRuntime(snapshot: PnamesLumpRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.pnamesHeaderBytes !== 4) {
    failures.push('derived:PNAMES_HEADER_BYTES_EQUALS_FOUR');
    failures.push('audit:pnames-header-bytes-four:not-observed');
    failures.push('audit:pnames-name-table-starts-at-offset-four:not-observed');
  }

  if (snapshot.pnamesNameBytes !== 8) {
    failures.push('derived:PNAMES_NAME_BYTES_EQUALS_EIGHT');
    failures.push('audit:pnames-name-field-bytes-eight:not-observed');
  }

  if (snapshot.pnamesNameBufferBytes !== 9) {
    failures.push('derived:PNAMES_NAME_BUFFER_BYTES_EQUALS_NINE');
    failures.push('audit:pnames-name-stack-buffer-bytes-nine:not-observed');
  }

  if (snapshot.pnamesNameTerminatorOffset !== 8) {
    failures.push('derived:PNAMES_NAME_TERMINATOR_OFFSET_EQUALS_EIGHT');
    failures.push('audit:pnames-name-stack-buffer-explicit-null-terminator:not-observed');
  }

  if (snapshot.pnamesNameTerminatorByte !== 0) {
    failures.push('derived:PNAMES_NAME_TERMINATOR_BYTE_EQUALS_ZERO');
    failures.push('audit:pnames-name-stack-buffer-explicit-null-terminator:not-observed');
  }

  if (snapshot.lumpSizeForZeroCount !== 4 || snapshot.lumpSizeForShareWareCount !== 2804) {
    failures.push('derived:PNAMES_LUMP_SIZE_FORMULA_EQUALS_HEADER_PLUS_COUNT_TIMES_NAME');
    failures.push('audit:pnames-total-size-formula-four-plus-count-times-eight:not-observed');
  }

  if (!snapshot.parserReturnsFullyFrozen) {
    failures.push('derived:PARSE_PNAMES_LUMP_RETURNS_FROZEN_PNAMES_AND_NAMES');
    failures.push('audit:pnames-cache-by-name-via-w-cachelumpname:not-observed');
  }

  if (!snapshot.namesLengthEqualsCount) {
    failures.push('derived:PARSE_PNAMES_LUMP_NAMES_LENGTH_EQUALS_COUNT');
    failures.push('audit:pnames-patchlookup-size-equals-nummappatches:not-observed');
  }

  if (!snapshot.namesAreUppercaseAndTrimmed) {
    failures.push('derived:PARSE_PNAMES_LUMP_NAMES_ARE_UPPERCASE_AND_TRIMMED');
    failures.push('audit:pnames-name-copied-via-m-stringcopy:not-observed');
    failures.push('audit:pnames-patchlookup-uses-w-checknumforname:not-observed');
  }

  if (!snapshot.parserRejectsBufferTooSmallForHeader) {
    failures.push('derived:PARSE_PNAMES_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
    failures.push('audit:pnames-header-count-int32-le:not-observed');
  }

  if (!snapshot.parserRejectsNegativeCount) {
    failures.push('derived:PARSE_PNAMES_LUMP_REJECTS_NEGATIVE_COUNT');
    failures.push('audit:pnames-header-count-via-long-macro:not-observed');
  }

  if (!snapshot.parserRejectsBufferTooSmallForDeclaredCount) {
    failures.push('derived:PARSE_PNAMES_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_DECLARED_COUNT');
  }

  if (!snapshot.parserAcceptsZeroCount) {
    failures.push('derived:PARSE_PNAMES_LUMP_ACCEPTS_ZERO_COUNT');
    failures.push('audit:pnames-missing-patch-fatal-only-when-referenced-by-texture:not-observed');
    failures.push('audit:pnames-patchlookup-missing-yields-negative-one:not-observed');
  }

  if (!snapshot.nameFieldsFillExactlyEightBytes) {
    failures.push('derived:PARSE_PNAMES_LUMP_NAME_FIELDS_FILL_EXACTLY_EIGHT_BYTES');
  }

  if (!snapshot.trailingDataIsIgnored) {
    failures.push('derived:PARSE_PNAMES_LUMP_TRAILING_DATA_IS_IGNORED');
  }

  const declaredAxes = new Set(PNAMES_LUMP_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<PnamesLumpAuditEntry['id']> = [
    'pnames-header-bytes-four',
    'pnames-header-count-int32-le',
    'pnames-header-count-via-long-macro',
    'pnames-name-table-starts-at-offset-four',
    'pnames-name-field-bytes-eight',
    'pnames-name-stack-buffer-bytes-nine',
    'pnames-name-stack-buffer-explicit-null-terminator',
    'pnames-name-copied-via-m-stringcopy',
    'pnames-total-size-formula-four-plus-count-times-eight',
    'pnames-cache-by-name-via-w-cachelumpname',
    'pnames-patchlookup-size-equals-nummappatches',
    'pnames-patchlookup-uses-w-checknumforname',
    'pnames-patchlookup-missing-yields-negative-one',
    'pnames-missing-patch-fatal-only-when-referenced-by-texture',
    'pnames-shareware-doom1-three-hundred-fifty-patches',
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
 * Pinned facts about a single named patch entry inside the shareware
 * `doom/DOOM1.WAD` PNAMES lump that the focused test cross-checks
 * against the live on-disk file.
 */
export interface ShareWareDoom1WadPnameOracleEntry {
  /** Zero-based index inside the PNAMES name table. */
  readonly nameIndex: number;
  /** Patch name (uppercase, NUL-stripped). */
  readonly name: string;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` PNAMES structure. */
export interface ShareWareDoom1WadPnamesOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Directory index of the PNAMES lump in the live IWAD directory. */
  readonly directoryIndex: 106;
  /** Byte offset of the PNAMES lump inside the WAD file. */
  readonly fileOffset: 924948;
  /** Byte size of the PNAMES lump (must equal 4 + count * 8). */
  readonly lumpSize: 2804;
  /** SHA-256 hex digest of the PNAMES lump bytes (lower-case, 64 chars). */
  readonly sha256: 'b6881a83a3972b929b386a23088365c3617fd676edc4313e023f4760f06b5534';
  /** Decoded `nummappatches` count from the count header. */
  readonly count: 350;
  /** Pinned named-by-index probes covering first, mid, and last entries. */
  readonly pinnedNames: readonly ShareWareDoom1WadPnameOracleEntry[];
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` PNAMES lump.
 *
 * The pinned name probes were captured by hand from the live IWAD
 * (`probe-pnames.ts`) and cover four points of the namespace:
 *  - index 0 (`WALL00_3`): the very first patch name; an 8-character
 *    name that fills the field exactly with no trailing NUL bytes,
 *    proving the trim step does not over-eat.
 *  - index 1 (`W13_1`): a short 5-character name with a numeric
 *    component, sanity-check for the per-name stride.
 *  - index 100 (`TSCRN4`): a mid-range entry, exercises the
 *    `name_p + i * 8` stride at non-trivial `i`.
 *  - index 200 (`W108_3`): a second mid-range entry on a different
 *    page of the lump, doubles the stride coverage.
 *  - index 349 (`SW2_4`): the very last entry; proves the loop reads
 *    exactly `count` names, no more and no fewer.
 *
 * The sha-256 fingerprint freezes the exact byte content of the lump
 * at the time of audit; any IWAD-modifying change that does not also
 * update the audit will surface as an oracle mismatch and reject the
 * change.
 */
export const SHAREWARE_DOOM1_WAD_PNAMES_ORACLE: ShareWareDoom1WadPnamesOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  directoryIndex: 106,
  fileOffset: 924948,
  lumpSize: 2804,
  sha256: 'b6881a83a3972b929b386a23088365c3617fd676edc4313e023f4760f06b5534',
  count: 350,
  pinnedNames: Object.freeze([
    Object.freeze({ nameIndex: 0, name: 'WALL00_3' }),
    Object.freeze({ nameIndex: 1, name: 'W13_1' }),
    Object.freeze({ nameIndex: 100, name: 'TSCRN4' }),
    Object.freeze({ nameIndex: 200, name: 'W108_3' }),
    Object.freeze({ nameIndex: 349, name: 'SW2_4' }),
  ]) as readonly ShareWareDoom1WadPnameOracleEntry[],
}) as ShareWareDoom1WadPnamesOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * PNAMES lump so the focused test can re-derive the values from the
 * live file every run and feed the result into the cross-check.
 */
export interface ShareWareDoom1WadPnamesSample {
  readonly directoryIndex: number;
  readonly fileOffset: number;
  readonly lumpSize: number;
  readonly sha256: string;
  readonly count: number;
  readonly pinnedNames: readonly {
    readonly nameIndex: number;
    readonly name: string;
  }[];
}

/**
 * Cross-check a shareware DOOM1.WAD PNAMES sample against the pinned
 * oracle. Returns the list of failures by stable identifier; an empty
 * list means the live PNAMES matches the oracle byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:name:<index>:not-found` when the sample is missing a
 *    pinned named-by-index probe.
 *  - `oracle:name:<index>:value-mismatch` when a pinned probe's name
 *    disagrees with the live value.
 */
export function crossCheckShareWareDoom1WadPnamesSample(sample: ShareWareDoom1WadPnamesSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'directoryIndex' | 'fileOffset' | 'lumpSize' | 'sha256' | 'count'> = ['directoryIndex', 'fileOffset', 'lumpSize', 'sha256', 'count'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_PNAMES_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  for (const oraclePinned of SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.pinnedNames) {
    const livePinned = sample.pinnedNames.find((entry) => entry.nameIndex === oraclePinned.nameIndex);
    if (!livePinned) {
      failures.push(`oracle:name:${oraclePinned.nameIndex}:not-found`);
      continue;
    }
    if (livePinned.name !== oraclePinned.name) {
      failures.push(`oracle:name:${oraclePinned.nameIndex}:value-mismatch`);
    }
  }

  return failures;
}
