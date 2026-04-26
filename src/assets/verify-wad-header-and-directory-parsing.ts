/**
 * Audit ledger for the vanilla DOOM 1.9 WAD file header (`wadinfo_t`) and
 * directory entry (`filelump_t`) layouts parsed by `src/wad/header.ts` and
 * `src/wad/directory.ts`.
 *
 * Each entry pins one struct field, one constant, or one invariant to its
 * upstream Chocolate Doom 2.2.1 declaration in `w_wad.h` / `w_wad.c`. The
 * accompanying focused test imports the runtime parsers and the local
 * `doom/DOOM1.WAD` oracle and cross-checks every audit entry against the
 * runtime exports plus the live oracle. If a future change silently shifts
 * `WAD_HEADER_SIZE`, `DIRECTORY_ENTRY_SIZE`, the field offsets, the
 * little-endian read order, the 8-byte ASCII name semantics, or the valid
 * IWAD/PWAD identification tags, the audit ledger and the focused test
 * together reject the change.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/w_wad.h`, `src/w_wad.c`,
 *      `src/r_data.c`, `src/p_setup.c`).
 *
 * The audit field declarations below are pinned against authority 5 because
 * the C struct layouts of `wadinfo_t` and `filelump_t` are textual constants
 * the binary cannot disagree with: every offset and width is a property of
 * the on-disk byte stream, not of any runtime register state. The shareware
 * `DOOM1.WAD` oracle facts (lump count, first/last lump names, first lump
 * offset and size) are pinned against authority 2 — the local IWAD itself —
 * and cross-checked against `reference/manifests/wad-map-summary.json` and
 * `src/reference/target.ts`.
 */

/**
 * One audited struct field pinned to its upstream `wadinfo_t` /
 * `filelump_t` declaration.
 */
export interface WadStructFieldAuditEntry {
  /** Which on-disk struct this field belongs to. */
  readonly struct: 'wadinfo_t' | 'filelump_t';
  /** Field name as written in the C struct. */
  readonly fieldName: 'identification' | 'numlumps' | 'infotableofs' | 'filepos' | 'size' | 'name';
  /** Byte offset of this field within its struct. */
  readonly byteOffset: number;
  /** Byte width of this field. */
  readonly byteSize: number;
  /** C type as written in the upstream declaration. */
  readonly cType: 'char[4]' | 'char[8]' | 'int';
  /** Byte order applied when reading the field, or `n/a` for raw byte runs. */
  readonly endianness: 'little' | 'n/a';
  /** Verbatim C declaration line. */
  readonly cDeclaration: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/w_wad.h';
  /** Plain-language note explaining why the layout cannot vary. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level field in `wadinfo_t` (the 12-byte WAD
 * file header) and `filelump_t` (the 16-byte directory entry).
 *
 * The ledger is intentionally append-only: future audits MUST extend the
 * ledger rather than mutate prior entries. The focused test enforces that
 * every field offset and width agrees with the runtime parser.
 */
export const WAD_STRUCT_FIELD_AUDIT: readonly WadStructFieldAuditEntry[] = [
  {
    struct: 'wadinfo_t',
    fieldName: 'identification',
    byteOffset: 0,
    byteSize: 4,
    cType: 'char[4]',
    endianness: 'n/a',
    cDeclaration: 'char identification[4];',
    referenceSourceFile: 'src/w_wad.h',
    invariant: 'Four ASCII bytes "IWAD" or "PWAD" identifying the WAD type. The id occupies the first four bytes of every WAD file and is read verbatim — no endian conversion applies because the field is a raw byte run, not an integer.',
  },
  {
    struct: 'wadinfo_t',
    fieldName: 'numlumps',
    byteOffset: 4,
    byteSize: 4,
    cType: 'int',
    endianness: 'little',
    cDeclaration: 'int numlumps;',
    referenceSourceFile: 'src/w_wad.h',
    invariant:
      'Signed 32-bit little-endian count of directory entries. DOOM was written for x86, so all on-disk integers are little-endian; the field width is exactly 4 bytes because Chocolate Doom 2.2.1 marks `wadinfo_t` with `PACKEDATTR` to forbid struct padding.',
  },
  {
    struct: 'wadinfo_t',
    fieldName: 'infotableofs',
    byteOffset: 8,
    byteSize: 4,
    cType: 'int',
    endianness: 'little',
    cDeclaration: 'int infotableofs;',
    referenceSourceFile: 'src/w_wad.h',
    invariant:
      'Signed 32-bit little-endian byte offset from the start of the WAD file to the first directory entry. The directory occupies `numlumps * 16` bytes starting at this offset; the parser must reject negative values because the offset is treated as an unsigned file position by `W_AddFile`.',
  },
  {
    struct: 'filelump_t',
    fieldName: 'filepos',
    byteOffset: 0,
    byteSize: 4,
    cType: 'int',
    endianness: 'little',
    cDeclaration: 'int filepos;',
    referenceSourceFile: 'src/w_wad.h',
    invariant:
      "Signed 32-bit little-endian byte offset from the start of the WAD file to this lump's data. Marker lumps such as `F_START`, `F_END`, `S_START`, `S_END`, and the per-map `E1Mx` markers carry zero data, but their `filepos` still records a valid file position so `W_ReadLump` can run uniformly.",
  },
  {
    struct: 'filelump_t',
    fieldName: 'size',
    byteOffset: 4,
    byteSize: 4,
    cType: 'int',
    endianness: 'little',
    cDeclaration: 'int size;',
    referenceSourceFile: 'src/w_wad.h',
    invariant:
      "Signed 32-bit little-endian size in bytes of the lump's data. Marker lumps have `size == 0`. The parser must reject negative values because `W_CacheLumpNum` allocates the lump using this width and a negative size aliases to a giant unsigned allocation in C.",
  },
  {
    struct: 'filelump_t',
    fieldName: 'name',
    byteOffset: 8,
    byteSize: 8,
    cType: 'char[8]',
    endianness: 'n/a',
    cDeclaration: 'char name[8];',
    referenceSourceFile: 'src/w_wad.h',
    invariant:
      'Up to 8 ASCII bytes naming the lump. Names shorter than 8 characters are null-padded; names exactly 8 characters long carry no terminator. `W_CheckNumForName` strncpy/uppercases against the 8-byte field, so the parser must strip trailing nulls without inserting a terminator and must preserve the field as case-insensitive ASCII.',
  },
] as const;

/**
 * One audited byte-level constant exported by `src/wad/header.ts` or
 * `src/wad/directory.ts`.
 */
export interface WadStructSizeAuditEntry {
  /** Which on-disk struct this constant sizes. */
  readonly struct: 'wadinfo_t' | 'filelump_t';
  /** Symbol name exported from the runtime. */
  readonly runtimeConstant: 'WAD_HEADER_SIZE' | 'DIRECTORY_ENTRY_SIZE';
  /** Numeric value as a JavaScript `number`. Must equal the runtime export. */
  readonly value: 12 | 16;
  /** Verbatim C declaration the size is derived from. */
  readonly cDeclaration: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/w_wad.h';
  /** Plain-language note explaining why the size cannot vary. */
  readonly invariant: string;
}

/** Pinned byte sizes for the two on-disk WAD structs. */
export const WAD_STRUCT_SIZE_AUDIT: readonly WadStructSizeAuditEntry[] = [
  {
    struct: 'wadinfo_t',
    runtimeConstant: 'WAD_HEADER_SIZE',
    value: 12,
    cDeclaration: 'typedef struct { char identification[4]; int numlumps; int infotableofs; } PACKEDATTR wadinfo_t;',
    referenceSourceFile: 'src/w_wad.h',
    invariant: 'Exactly 4 + 4 + 4 = 12 bytes. The struct is `PACKEDATTR` so no compiler padding can extend it, and the on-disk header in every shipped IWAD and PWAD lays its three fields contiguously starting at file offset 0.',
  },
  {
    struct: 'filelump_t',
    runtimeConstant: 'DIRECTORY_ENTRY_SIZE',
    value: 16,
    cDeclaration: 'typedef struct { int filepos; int size; char name[8]; } PACKEDATTR filelump_t;',
    referenceSourceFile: 'src/w_wad.h',
    invariant: 'Exactly 4 + 4 + 8 = 16 bytes. The struct is `PACKEDATTR`, so the directory at `infotableofs` is a tightly packed run of 16-byte records that the parser indexes by simple multiplication.',
  },
] as const;

/**
 * One audited valid value of the `wadinfo_t.identification` field.
 */
export interface WadIdentificationAuditEntry {
  /** Four-byte ASCII tag. */
  readonly tag: 'IWAD' | 'PWAD';
  /** Plain-language meaning of the tag. */
  readonly meaning: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/w_wad.c';
  /** Invariant the tag locks down. */
  readonly invariant: string;
}

/** Pinned ledger of every WAD identification tag the parser must accept. */
export const WAD_IDENTIFICATION_AUDIT: readonly WadIdentificationAuditEntry[] = [
  {
    tag: 'IWAD',
    meaning: 'Internal WAD — a primary game data file shipped by id Software.',
    referenceSourceFile: 'src/w_wad.c',
    invariant: '`W_AddFile` accepts a wad whose identification field is exactly the four ASCII bytes "IWAD" and treats it as authoritative game data.',
  },
  {
    tag: 'PWAD',
    meaning: 'Patch WAD — a user-supplied modification overlaying lumps from the IWAD.',
    referenceSourceFile: 'src/w_wad.c',
    invariant: '`W_AddFile` accepts a wad whose identification field is exactly the four ASCII bytes "PWAD" and merges its directory after the IWAD so that duplicate lump names override earlier entries.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top of
 * the raw struct field declarations. Failures point at concrete identities
 * that any vanilla parity rebuild must preserve.
 */
export interface WadStructDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const WAD_STRUCT_DERIVED_INVARIANTS: readonly WadStructDerivedInvariant[] = [
  {
    id: 'WADINFO_FIELD_OFFSETS_ARE_CONTIGUOUS',
    description: 'The three `wadinfo_t` fields lie back-to-back at byte offsets 0, 4, and 8 with no padding between them.',
  },
  {
    id: 'WADINFO_TOTAL_BYTE_SIZE_EQUALS_TWELVE',
    description: 'The sum of the three `wadinfo_t` field widths equals `WAD_HEADER_SIZE === 12`.',
  },
  {
    id: 'FILELUMP_FIELD_OFFSETS_ARE_CONTIGUOUS',
    description: 'The three `filelump_t` fields lie back-to-back at byte offsets 0, 4, and 8 with no padding between them.',
  },
  {
    id: 'FILELUMP_TOTAL_BYTE_SIZE_EQUALS_SIXTEEN',
    description: 'The sum of the three `filelump_t` field widths equals `DIRECTORY_ENTRY_SIZE === 16`.',
  },
  {
    id: 'IDENTIFICATION_VALID_TAGS_ARE_IWAD_AND_PWAD',
    description: 'The runtime accepts exactly the two tags `"IWAD"` and `"PWAD"` as valid `wadinfo_t.identification` values.',
  },
  {
    id: 'INTEGER_FIELDS_ARE_LITTLE_ENDIAN',
    description: 'Every audit entry whose `cType` is `"int"` carries `endianness === "little"` to match the x86 host order DOOM was written for.',
  },
  {
    id: 'NAME_FIELD_IS_EIGHT_BYTE_ASCII',
    description: 'The `filelump_t.name` field is exactly 8 bytes wide and stores ASCII; trailing nulls pad shorter names.',
  },
];

/**
 * Snapshot of the byte-level WAD layout exposed by the runtime parsers.
 * The cross-check helper consumes this shape so the focused test can both
 * verify the live runtime exports and exercise a deliberately tampered
 * snapshot to prove the failure modes are observable.
 */
export interface WadStructLayoutSnapshot {
  readonly WAD_HEADER_SIZE: number;
  readonly DIRECTORY_ENTRY_SIZE: number;
  readonly acceptedIdentifications: readonly string[];
}

/**
 * Cross-check a `WadStructLayoutSnapshot` against `WAD_STRUCT_SIZE_AUDIT`,
 * `WAD_STRUCT_FIELD_AUDIT`, `WAD_IDENTIFICATION_AUDIT`, and
 * `WAD_STRUCT_DERIVED_INVARIANTS`. Returns the list of failures by stable
 * identifier; an empty list means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `audit:size:<RUNTIME_CONSTANT>:value-mismatch` for a constant whose
 *    runtime value differs from the audit ledger.
 *  - `audit:identifications:<TAG>:missing` for a tag the runtime should
 *    accept but does not.
 *  - `audit:identifications:unexpected:<TAG>` for a tag the runtime
 *    accepts beyond the two pinned values.
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 */
export function crossCheckWadStructLayout(snapshot: WadStructLayoutSnapshot): readonly string[] {
  const failures: string[] = [];

  for (const entry of WAD_STRUCT_SIZE_AUDIT) {
    const runtimeValue = snapshot[entry.runtimeConstant];
    if (runtimeValue !== entry.value) {
      failures.push(`audit:size:${entry.runtimeConstant}:value-mismatch`);
    }
  }

  const expectedTags = new Set(WAD_IDENTIFICATION_AUDIT.map((entry) => entry.tag));
  const observedTags = new Set(snapshot.acceptedIdentifications);
  for (const tag of expectedTags) {
    if (!observedTags.has(tag)) {
      failures.push(`audit:identifications:${tag}:missing`);
    }
  }
  for (const tag of observedTags) {
    if (!expectedTags.has(tag as 'IWAD' | 'PWAD')) {
      failures.push(`audit:identifications:unexpected:${tag}`);
    }
  }

  const wadinfoFields = WAD_STRUCT_FIELD_AUDIT.filter((entry) => entry.struct === 'wadinfo_t');
  const filelumpFields = WAD_STRUCT_FIELD_AUDIT.filter((entry) => entry.struct === 'filelump_t');

  if (!fieldsAreContiguous(wadinfoFields)) {
    failures.push('derived:WADINFO_FIELD_OFFSETS_ARE_CONTIGUOUS');
  }
  if (sumFieldBytes(wadinfoFields) !== snapshot.WAD_HEADER_SIZE || snapshot.WAD_HEADER_SIZE !== 12) {
    failures.push('derived:WADINFO_TOTAL_BYTE_SIZE_EQUALS_TWELVE');
  }
  if (!fieldsAreContiguous(filelumpFields)) {
    failures.push('derived:FILELUMP_FIELD_OFFSETS_ARE_CONTIGUOUS');
  }
  if (sumFieldBytes(filelumpFields) !== snapshot.DIRECTORY_ENTRY_SIZE || snapshot.DIRECTORY_ENTRY_SIZE !== 16) {
    failures.push('derived:FILELUMP_TOTAL_BYTE_SIZE_EQUALS_SIXTEEN');
  }

  if (observedTags.size !== 2 || !observedTags.has('IWAD') || !observedTags.has('PWAD')) {
    failures.push('derived:IDENTIFICATION_VALID_TAGS_ARE_IWAD_AND_PWAD');
  }

  for (const field of WAD_STRUCT_FIELD_AUDIT) {
    if (field.cType === 'int' && field.endianness !== 'little') {
      failures.push('derived:INTEGER_FIELDS_ARE_LITTLE_ENDIAN');
      break;
    }
  }

  const nameField = WAD_STRUCT_FIELD_AUDIT.find((entry) => entry.struct === 'filelump_t' && entry.fieldName === 'name');
  if (!nameField || nameField.byteSize !== 8 || nameField.cType !== 'char[8]') {
    failures.push('derived:NAME_FIELD_IS_EIGHT_BYTE_ASCII');
  }

  return failures;
}

function fieldsAreContiguous(fields: readonly WadStructFieldAuditEntry[]): boolean {
  let cursor = 0;
  for (const field of fields) {
    if (field.byteOffset !== cursor) {
      return false;
    }
    cursor += field.byteSize;
  }
  return true;
}

function sumFieldBytes(fields: readonly WadStructFieldAuditEntry[]): number {
  let total = 0;
  for (const field of fields) {
    total += field.byteSize;
  }
  return total;
}

/**
 * Pinned facts about the local shareware `doom/DOOM1.WAD` IWAD that the
 * focused test cross-checks against the live on-disk file. Sourced from
 * authority 2 (the local IWAD itself, parsed once by hand) and
 * cross-referenced with `reference/manifests/wad-map-summary.json`.
 */
export interface ShareWareDoom1WadOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Total file size in bytes. */
  readonly fileSize: number;
  /** Identification tag exactly as written at byte offset 0. */
  readonly identification: 'IWAD';
  /** Number of directory entries the header advertises. */
  readonly lumpCount: number;
  /** Byte offset to the start of the directory. */
  readonly directoryOffset: number;
  /** Byte offset where the directory ends (header.directoryOffset + lumpCount * 16). */
  readonly directoryEnd: number;
  /** Name of the first lump in directory order. */
  readonly firstLumpName: 'PLAYPAL';
  /** Name of the last lump in directory order. */
  readonly lastLumpName: 'F_END';
  /** File offset of the first lump's data. */
  readonly firstLumpFilePos: number;
  /** Size of the first lump (PLAYPAL = 14 palettes * 768 bytes = 10752 bytes). */
  readonly firstLumpSize: 10_752;
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD`. Every value here
 * is verifiable by reading the local IWAD's first 12 bytes plus the first
 * and last directory entries; the focused test re-derives all of them from
 * the on-disk file every run and rejects any drift.
 */
export const SHAREWARE_DOOM1_WAD_ORACLE: ShareWareDoom1WadOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  fileSize: 4_196_020,
  identification: 'IWAD',
  lumpCount: 1264,
  directoryOffset: 4_175_796,
  directoryEnd: 4_196_020,
  firstLumpName: 'PLAYPAL',
  lastLumpName: 'F_END',
  firstLumpFilePos: 12,
  firstLumpSize: 10_752,
});

/**
 * Cross-check a freshly parsed shareware `DOOM1.WAD` sample against the
 * pinned oracle. Returns the list of failures by stable identifier; an
 * empty list means the on-disk file matches the oracle.
 *
 * The sample shape mirrors the runtime parser output so the focused test
 * can call `parseWadHeader` plus `parseWadDirectory` directly and feed
 * the result into this helper.
 */
export interface ShareWareDoom1WadSample {
  readonly fileSize: number;
  readonly identification: string;
  readonly lumpCount: number;
  readonly directoryOffset: number;
  readonly firstLumpName: string;
  readonly lastLumpName: string;
  readonly firstLumpFilePos: number;
  readonly firstLumpSize: number;
}

/**
 * Cross-check a shareware DOOM1.WAD sample against the pinned oracle.
 * Returns the list of failures by stable identifier.
 *
 * Identifiers used:
 *  - `oracle:fileSize:value-mismatch`
 *  - `oracle:identification:value-mismatch`
 *  - `oracle:lumpCount:value-mismatch`
 *  - `oracle:directoryOffset:value-mismatch`
 *  - `oracle:directoryEnd:value-mismatch`
 *  - `oracle:firstLumpName:value-mismatch`
 *  - `oracle:lastLumpName:value-mismatch`
 *  - `oracle:firstLumpFilePos:value-mismatch`
 *  - `oracle:firstLumpSize:value-mismatch`
 */
export function crossCheckShareWareDoom1WadSample(sample: ShareWareDoom1WadSample): readonly string[] {
  const failures: string[] = [];

  if (sample.fileSize !== SHAREWARE_DOOM1_WAD_ORACLE.fileSize) {
    failures.push('oracle:fileSize:value-mismatch');
  }
  if (sample.identification !== SHAREWARE_DOOM1_WAD_ORACLE.identification) {
    failures.push('oracle:identification:value-mismatch');
  }
  if (sample.lumpCount !== SHAREWARE_DOOM1_WAD_ORACLE.lumpCount) {
    failures.push('oracle:lumpCount:value-mismatch');
  }
  if (sample.directoryOffset !== SHAREWARE_DOOM1_WAD_ORACLE.directoryOffset) {
    failures.push('oracle:directoryOffset:value-mismatch');
  }
  if (sample.directoryOffset + sample.lumpCount * 16 !== SHAREWARE_DOOM1_WAD_ORACLE.directoryEnd) {
    failures.push('oracle:directoryEnd:value-mismatch');
  }
  if (sample.firstLumpName !== SHAREWARE_DOOM1_WAD_ORACLE.firstLumpName) {
    failures.push('oracle:firstLumpName:value-mismatch');
  }
  if (sample.lastLumpName !== SHAREWARE_DOOM1_WAD_ORACLE.lastLumpName) {
    failures.push('oracle:lastLumpName:value-mismatch');
  }
  if (sample.firstLumpFilePos !== SHAREWARE_DOOM1_WAD_ORACLE.firstLumpFilePos) {
    failures.push('oracle:firstLumpFilePos:value-mismatch');
  }
  if (sample.firstLumpSize !== SHAREWARE_DOOM1_WAD_ORACLE.firstLumpSize) {
    failures.push('oracle:firstLumpSize:value-mismatch');
  }

  return failures;
}
