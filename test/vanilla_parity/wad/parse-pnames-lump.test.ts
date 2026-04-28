import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import {
  PNAMES_HEADER_BYTES,
  PNAMES_LUMP_AUDIT,
  PNAMES_LUMP_DERIVED_INVARIANTS,
  PNAMES_NAME_BUFFER_BYTES,
  PNAMES_NAME_BYTES,
  PNAMES_NAME_TERMINATOR_BYTE,
  PNAMES_NAME_TERMINATOR_OFFSET,
  SHAREWARE_DOOM1_WAD_PNAMES_ORACLE,
  crossCheckPnamesLumpRuntime,
  crossCheckShareWareDoom1WadPnamesSample,
  parsePnamesLump,
  pnamesLumpSizeForCount,
} from '../../../src/assets/parse-pnames-lump.ts';
import type { PnamesLumpAuditEntry, PnamesLumpRuntimeSnapshot, ShareWareDoom1WadPnamesSample } from '../../../src/assets/parse-pnames-lump.ts';

const ALLOWED_AXIS_IDS = new Set<PnamesLumpAuditEntry['id']>([
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
]);
const ALLOWED_SUBJECTS = new Set<PnamesLumpAuditEntry['subject']>(['PNAMES', 'R_InitTextures', 'patchlookup', 'parsePnamesLump', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<PnamesLumpAuditEntry['referenceSourceFile']>(['src/doom/r_data.c', 'src/doom/w_wad.c', 'src/doom/p_setup.c']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const pnamesIndex = liveDirectory.findIndex((entry) => entry.name === 'PNAMES');
if (pnamesIndex < 0) {
  throw new Error('PNAMES lump not found in shareware DOOM1.WAD live directory');
}
const pnamesEntry = liveDirectory[pnamesIndex]!;
const pnamesLumpData = wadBuffer.subarray(pnamesEntry.offset, pnamesEntry.offset + pnamesEntry.size);
const pnamesSha256 = createHash('sha256').update(pnamesLumpData).digest('hex');
const liveLump = parsePnamesLump(pnamesLumpData);

function tryThrowsRangeError(thunk: () => unknown, pattern: RegExp): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof RangeError && pattern.test(err.message);
  }
}

function buildPnamesLumpBytes(count: number, names: readonly string[], options: { readonly trailingPaddingBytes?: number } = {}): Buffer {
  const padding = options.trailingPaddingBytes ?? 0;
  const buf = Buffer.alloc(PNAMES_HEADER_BYTES + count * PNAMES_NAME_BYTES + padding);
  buf.writeInt32LE(count, 0);
  for (let index = 0; index < count; index += 1) {
    const name = names[index] ?? '';
    const slice = Buffer.alloc(PNAMES_NAME_BYTES);
    slice.write(name, 0, Math.min(name.length, PNAMES_NAME_BYTES), 'ascii');
    buf.set(slice, PNAMES_HEADER_BYTES + index * PNAMES_NAME_BYTES);
  }
  return buf;
}

function buildNegativeCountLump(): Buffer {
  const buf = Buffer.alloc(PNAMES_HEADER_BYTES);
  buf.writeInt32LE(-1, 0);
  return buf;
}

function buildTruncatedLump(declaredCount: number): Buffer {
  const buf = Buffer.alloc(PNAMES_HEADER_BYTES + 1); // declares many names but supplies almost no body
  buf.writeInt32LE(declaredCount, 0);
  return buf;
}

const tooSmallLump = new Uint8Array(3);
const negativeCountLump = buildNegativeCountLump();
const truncatedLump = buildTruncatedLump(2);
const zeroCountLump = buildPnamesLumpBytes(0, []);
const eightCharFillLump = buildPnamesLumpBytes(1, ['ABCDEFGH']);
const trailingPaddingLump = buildPnamesLumpBytes(2, ['ALPHA', 'BETA'], { trailingPaddingBytes: 7 });

const parserRejectsBufferTooSmallForHeader = tryThrowsRangeError(() => parsePnamesLump(tooSmallLump), /count header|at least/);
const parserRejectsNegativeCount = tryThrowsRangeError(() => parsePnamesLump(negativeCountLump), /non-negative/);
const parserRejectsBufferTooSmallForDeclaredCount = tryThrowsRangeError(() => parsePnamesLump(truncatedLump), /declares|needs|too small|only/);

let parserAcceptsZeroCount = false;
try {
  const parsed = parsePnamesLump(zeroCountLump);
  parserAcceptsZeroCount = parsed.count === 0 && parsed.names.length === 0 && Object.isFrozen(parsed) && Object.isFrozen(parsed.names);
} catch {
  parserAcceptsZeroCount = false;
}

let nameFieldsFillExactlyEightBytes = false;
try {
  const parsed = parsePnamesLump(eightCharFillLump);
  nameFieldsFillExactlyEightBytes = parsed.count === 1 && parsed.names[0] === 'ABCDEFGH';
} catch {
  nameFieldsFillExactlyEightBytes = false;
}

let trailingDataIsIgnored = false;
try {
  const parsed = parsePnamesLump(trailingPaddingLump);
  trailingDataIsIgnored = parsed.count === 2 && parsed.names[0] === 'ALPHA' && parsed.names[1] === 'BETA';
} catch {
  trailingDataIsIgnored = false;
}

const namesAreUppercaseAndTrimmed = liveLump.names.every((name) => name === name.toUpperCase() && !name.includes('\0'));

function buildLiveRuntimeSnapshot(): PnamesLumpRuntimeSnapshot {
  return {
    pnamesHeaderBytes: PNAMES_HEADER_BYTES,
    pnamesNameBytes: PNAMES_NAME_BYTES,
    pnamesNameBufferBytes: PNAMES_NAME_BUFFER_BYTES,
    pnamesNameTerminatorOffset: PNAMES_NAME_TERMINATOR_OFFSET,
    pnamesNameTerminatorByte: PNAMES_NAME_TERMINATOR_BYTE,
    lumpSizeForZeroCount: pnamesLumpSizeForCount(0),
    lumpSizeForShareWareCount: pnamesLumpSizeForCount(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.count),
    parserReturnsFullyFrozen: Object.isFrozen(liveLump) && Object.isFrozen(liveLump.names),
    namesLengthEqualsCount: liveLump.names.length === liveLump.count,
    namesAreUppercaseAndTrimmed,
    parserRejectsBufferTooSmallForHeader,
    parserRejectsNegativeCount,
    parserRejectsBufferTooSmallForDeclaredCount,
    parserAcceptsZeroCount,
    nameFieldsFillExactlyEightBytes,
    trailingDataIsIgnored,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadPnamesSample {
  const pinnedIndices = SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.pinnedNames.map((entry) => entry.nameIndex);
  const pinnedNames = pinnedIndices.map((nameIndex) => ({
    nameIndex,
    name: liveLump.names[nameIndex] ?? '',
  }));
  return {
    directoryIndex: pnamesIndex,
    fileOffset: pnamesEntry.offset,
    lumpSize: pnamesEntry.size,
    sha256: pnamesSha256,
    count: liveLump.count,
    pinnedNames,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('PNAMES lump audit ledger shape', () => {
  test('audits exactly fifteen behavioral axes', () => {
    expect(PNAMES_LUMP_AUDIT.length).toBe(15);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of PNAMES_LUMP_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = PNAMES_LUMP_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of PNAMES_LUMP_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of PNAMES_LUMP_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of PNAMES_LUMP_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of PNAMES_LUMP_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('PNAMES lump derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = PNAMES_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(PNAMES_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'PNAMES_HEADER_BYTES_EQUALS_FOUR',
        'PNAMES_NAME_BYTES_EQUALS_EIGHT',
        'PNAMES_NAME_BUFFER_BYTES_EQUALS_NINE',
        'PNAMES_NAME_TERMINATOR_OFFSET_EQUALS_EIGHT',
        'PNAMES_NAME_TERMINATOR_BYTE_EQUALS_ZERO',
        'PNAMES_LUMP_SIZE_FORMULA_EQUALS_HEADER_PLUS_COUNT_TIMES_NAME',
        'PARSE_PNAMES_LUMP_RETURNS_FROZEN_PNAMES_AND_NAMES',
        'PARSE_PNAMES_LUMP_NAMES_LENGTH_EQUALS_COUNT',
        'PARSE_PNAMES_LUMP_NAMES_ARE_UPPERCASE_AND_TRIMMED',
        'PARSE_PNAMES_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
        'PARSE_PNAMES_LUMP_REJECTS_NEGATIVE_COUNT',
        'PARSE_PNAMES_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_DECLARED_COUNT',
        'PARSE_PNAMES_LUMP_ACCEPTS_ZERO_COUNT',
        'PARSE_PNAMES_LUMP_NAME_FIELDS_FILL_EXACTLY_EIGHT_BYTES',
        'PARSE_PNAMES_LUMP_TRAILING_DATA_IS_IGNORED',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of PNAMES_LUMP_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('PNAMES_HEADER_BYTES is 4 (matches name_p = names + 4)', () => {
    expect(PNAMES_HEADER_BYTES).toBe(4);
  });

  test('PNAMES_NAME_BYTES is 8 (matches name_p + i * 8 stride)', () => {
    expect(PNAMES_NAME_BYTES).toBe(8);
  });

  test('PNAMES_NAME_BUFFER_BYTES is 9 (matches char name[9])', () => {
    expect(PNAMES_NAME_BUFFER_BYTES).toBe(9);
  });

  test('PNAMES_NAME_TERMINATOR_OFFSET is 8 (matches name[8] = 0)', () => {
    expect(PNAMES_NAME_TERMINATOR_OFFSET).toBe(8);
  });

  test('PNAMES_NAME_TERMINATOR_BYTE is 0 (matches name[8] = 0)', () => {
    expect(PNAMES_NAME_TERMINATOR_BYTE).toBe(0);
  });

  test('pnamesLumpSizeForCount(0) equals the bare 4-byte header', () => {
    expect(pnamesLumpSizeForCount(0)).toBe(PNAMES_HEADER_BYTES);
  });

  test('pnamesLumpSizeForCount(350) equals 2804 (shareware DOOM1.WAD)', () => {
    expect(pnamesLumpSizeForCount(350)).toBe(2804);
    expect(pnamesLumpSizeForCount(350)).toBe(PNAMES_HEADER_BYTES + 350 * PNAMES_NAME_BYTES);
  });

  test('pnamesLumpSizeForCount rejects negative counts', () => {
    expect(() => pnamesLumpSizeForCount(-1)).toThrow(RangeError);
  });

  test('pnamesLumpSizeForCount rejects non-integer counts', () => {
    expect(() => pnamesLumpSizeForCount(1.5)).toThrow(RangeError);
  });
});

describe('parsePnamesLump runtime contract', () => {
  test('returns a frozen outer object and frozen names array', () => {
    expect(Object.isFrozen(liveLump)).toBe(true);
    expect(Object.isFrozen(liveLump.names)).toBe(true);
  });

  test('reads the count as a little-endian int32 at offset 0', () => {
    const buf = Buffer.alloc(PNAMES_HEADER_BYTES + PNAMES_NAME_BYTES);
    buf.writeInt32LE(1, 0);
    buf.write('PATCH00', PNAMES_HEADER_BYTES, 'ascii');
    const parsed = parsePnamesLump(buf);
    expect(parsed.count).toBe(1);
    expect(parsed.names).toEqual(['PATCH00']);
  });

  test('decodes shareware DOOM1.WAD live count to 350', () => {
    expect(liveLump.count).toBe(350);
    expect(liveLump.names.length).toBe(350);
  });

  test('every name is uppercase ASCII with no embedded NUL bytes', () => {
    for (const name of liveLump.names) {
      expect(name).toBe(name.toUpperCase());
      expect(name.includes('\0')).toBe(false);
      expect(name.length).toBeLessThanOrEqual(PNAMES_NAME_BYTES);
    }
  });

  test('rejects a buffer too small for the 4-byte count header', () => {
    expect(() => parsePnamesLump(new Uint8Array(0))).toThrow(RangeError);
    expect(() => parsePnamesLump(new Uint8Array(3))).toThrow(RangeError);
  });

  test('rejects a negative declared count', () => {
    expect(() => parsePnamesLump(negativeCountLump)).toThrow(/non-negative/);
  });

  test('rejects a buffer too small for the declared count', () => {
    expect(() => parsePnamesLump(truncatedLump)).toThrow(/declares|too small|only/);
  });

  test('accepts a degenerate zero-count lump', () => {
    const parsed = parsePnamesLump(zeroCountLump);
    expect(parsed.count).toBe(0);
    expect(parsed.names).toEqual([]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.names)).toBe(true);
  });

  test('preserves an 8-character name that fills the entire field with no trailing NUL', () => {
    const parsed = parsePnamesLump(eightCharFillLump);
    expect(parsed.count).toBe(1);
    expect(parsed.names[0]).toBe('ABCDEFGH');
  });

  test('uppercases lowercase names from the lump (vanilla case-insensitive lookup)', () => {
    const buf = buildPnamesLumpBytes(2, ['mixed', 'lower']);
    const parsed = parsePnamesLump(buf);
    expect(parsed.names).toEqual(['MIXED', 'LOWER']);
  });

  test('strips trailing NUL bytes from short names', () => {
    const buf = buildPnamesLumpBytes(1, ['SHORT']);
    const parsed = parsePnamesLump(buf);
    expect(parsed.names[0]).toBe('SHORT');
    expect(parsed.names[0]?.includes('\0')).toBe(false);
  });

  test('ignores trailing data beyond the declared count', () => {
    const parsed = parsePnamesLump(trailingPaddingLump);
    expect(parsed.count).toBe(2);
    expect(parsed.names).toEqual(['ALPHA', 'BETA']);
  });

  test('accepts a Uint8Array (non-Buffer) input', () => {
    const buf = buildPnamesLumpBytes(1, ['UINT8']);
    const view = new Uint8Array(buf);
    const parsed = parsePnamesLump(view);
    expect(parsed.count).toBe(1);
    expect(parsed.names).toEqual(['UINT8']);
  });
});

describe('crossCheckPnamesLumpRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckPnamesLumpRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckPnamesLumpRuntime failure modes', () => {
  test('detects a tampered PNAMES_HEADER_BYTES that no longer equals 4', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, pnamesHeaderBytes: 8 };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PNAMES_HEADER_BYTES_EQUALS_FOUR');
    expect(failures).toContain('audit:pnames-header-bytes-four:not-observed');
  });

  test('detects a tampered PNAMES_NAME_BYTES that no longer equals 8', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, pnamesNameBytes: 9 };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PNAMES_NAME_BYTES_EQUALS_EIGHT');
    expect(failures).toContain('audit:pnames-name-field-bytes-eight:not-observed');
  });

  test('detects a tampered PNAMES_NAME_BUFFER_BYTES that no longer equals 9', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, pnamesNameBufferBytes: 8 };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PNAMES_NAME_BUFFER_BYTES_EQUALS_NINE');
    expect(failures).toContain('audit:pnames-name-stack-buffer-bytes-nine:not-observed');
  });

  test('detects a tampered PNAMES_NAME_TERMINATOR_OFFSET that no longer equals 8', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, pnamesNameTerminatorOffset: 7 };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PNAMES_NAME_TERMINATOR_OFFSET_EQUALS_EIGHT');
    expect(failures).toContain('audit:pnames-name-stack-buffer-explicit-null-terminator:not-observed');
  });

  test('detects a tampered PNAMES_NAME_TERMINATOR_BYTE that no longer equals 0', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, pnamesNameTerminatorByte: 0xff };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PNAMES_NAME_TERMINATOR_BYTE_EQUALS_ZERO');
    expect(failures).toContain('audit:pnames-name-stack-buffer-explicit-null-terminator:not-observed');
  });

  test('detects a tampered shareware lump-size formula', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, lumpSizeForShareWareCount: 9999 };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PNAMES_LUMP_SIZE_FORMULA_EQUALS_HEADER_PLUS_COUNT_TIMES_NAME');
    expect(failures).toContain('audit:pnames-total-size-formula-four-plus-count-times-eight:not-observed');
  });

  test('detects a parser that fails to freeze the returned lump', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFullyFrozen: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_RETURNS_FROZEN_PNAMES_AND_NAMES');
    expect(failures).toContain('audit:pnames-cache-by-name-via-w-cachelumpname:not-observed');
  });

  test('detects a parser whose names.length does not equal count', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, namesLengthEqualsCount: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_NAMES_LENGTH_EQUALS_COUNT');
    expect(failures).toContain('audit:pnames-patchlookup-size-equals-nummappatches:not-observed');
  });

  test('detects a parser that leaves names lowercased or NUL-padded', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, namesAreUppercaseAndTrimmed: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_NAMES_ARE_UPPERCASE_AND_TRIMMED');
    expect(failures).toContain('audit:pnames-name-copied-via-m-stringcopy:not-observed');
    expect(failures).toContain('audit:pnames-patchlookup-uses-w-checknumforname:not-observed');
  });

  test('detects a parser that silently accepts a buffer too small for the header', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForHeader: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
    expect(failures).toContain('audit:pnames-header-count-int32-le:not-observed');
  });

  test('detects a parser that silently accepts a negative count', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsNegativeCount: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_REJECTS_NEGATIVE_COUNT');
    expect(failures).toContain('audit:pnames-header-count-via-long-macro:not-observed');
  });

  test('detects a parser that silently accepts a truncated declared count', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForDeclaredCount: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_DECLARED_COUNT');
  });

  test('detects a parser that rejects the degenerate zero-count case', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserAcceptsZeroCount: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_ACCEPTS_ZERO_COUNT');
    expect(failures).toContain('audit:pnames-missing-patch-fatal-only-when-referenced-by-texture:not-observed');
    expect(failures).toContain('audit:pnames-patchlookup-missing-yields-negative-one:not-observed');
  });

  test('detects a parser that mishandles the eight-byte-fill case', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, nameFieldsFillExactlyEightBytes: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_NAME_FIELDS_FILL_EXACTLY_EIGHT_BYTES');
  });

  test('detects a parser that misreads trailing data', () => {
    const tampered: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, trailingDataIsIgnored: false };
    const failures = crossCheckPnamesLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_PNAMES_LUMP_TRAILING_DATA_IS_IGNORED');
  });

  test('reports an empty failure list for a freshly built equivalent snapshot', () => {
    const cloned: PnamesLumpRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckPnamesLumpRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD PNAMES oracle', () => {
  test('declares the expected directory index, file offset, lump size, sha256, and count', () => {
    expect(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.directoryIndex).toBe(106);
    expect(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.fileOffset).toBe(924948);
    expect(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.lumpSize).toBe(2804);
    expect(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.count).toBe(350);
    expect(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.sha256).toBe('b6881a83a3972b929b386a23088365c3617fd676edc4313e023f4760f06b5534');
  });

  test('lump size matches header + count * name stride', () => {
    expect(pnamesLumpSizeForCount(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.count)).toBe(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.lumpSize);
  });

  test('declares pinned name probes covering first, mid, and last entries', () => {
    const indices = SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.pinnedNames.map((entry) => entry.nameIndex);
    expect(indices).toEqual([0, 1, 100, 200, 349]);
  });

  test('live IWAD directory index and lump bytes match the oracle', () => {
    expect(pnamesIndex).toBe(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.directoryIndex);
    expect(pnamesEntry.offset).toBe(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.fileOffset);
    expect(pnamesEntry.size).toBe(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.lumpSize);
    expect(pnamesSha256).toBe(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.sha256);
  });

  test('live count matches the oracle', () => {
    expect(liveLump.count).toBe(SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.count);
  });

  test('every pinned name probe matches the live IWAD by name and index', () => {
    for (const oraclePinned of SHAREWARE_DOOM1_WAD_PNAMES_ORACLE.pinnedNames) {
      expect(liveLump.names[oraclePinned.nameIndex]).toBe(oraclePinned.name);
    }
  });

  test('crossCheckShareWareDoom1WadPnamesSample reports zero failures on the live oracle sample', () => {
    expect(crossCheckShareWareDoom1WadPnamesSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on patch-names count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { 'patch-names': number } };
    expect(manifest.lumpCategories['patch-names']).toBe(1);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });
});

describe('crossCheckShareWareDoom1WadPnamesSample failure modes', () => {
  test('detects a wrong directoryIndex', () => {
    const tampered: ShareWareDoom1WadPnamesSample = { ...liveOracleSample, directoryIndex: 0 };
    expect(crossCheckShareWareDoom1WadPnamesSample(tampered)).toContain('oracle:directoryIndex:value-mismatch');
  });

  test('detects a wrong fileOffset', () => {
    const tampered: ShareWareDoom1WadPnamesSample = { ...liveOracleSample, fileOffset: 0 };
    expect(crossCheckShareWareDoom1WadPnamesSample(tampered)).toContain('oracle:fileOffset:value-mismatch');
  });

  test('detects a wrong lumpSize', () => {
    const tampered: ShareWareDoom1WadPnamesSample = { ...liveOracleSample, lumpSize: 0 };
    expect(crossCheckShareWareDoom1WadPnamesSample(tampered)).toContain('oracle:lumpSize:value-mismatch');
  });

  test('detects a wrong sha256', () => {
    const tampered: ShareWareDoom1WadPnamesSample = { ...liveOracleSample, sha256: '0'.repeat(64) };
    expect(crossCheckShareWareDoom1WadPnamesSample(tampered)).toContain('oracle:sha256:value-mismatch');
  });

  test('detects a wrong count', () => {
    const tampered: ShareWareDoom1WadPnamesSample = { ...liveOracleSample, count: 999 };
    expect(crossCheckShareWareDoom1WadPnamesSample(tampered)).toContain('oracle:count:value-mismatch');
  });

  test('detects a missing pinned name probe', () => {
    const tampered: ShareWareDoom1WadPnamesSample = {
      ...liveOracleSample,
      pinnedNames: liveOracleSample.pinnedNames.filter((entry) => entry.nameIndex !== 0),
    };
    expect(crossCheckShareWareDoom1WadPnamesSample(tampered)).toContain('oracle:name:0:not-found');
  });

  test('detects a wrong name on a pinned probe', () => {
    const tampered: ShareWareDoom1WadPnamesSample = {
      ...liveOracleSample,
      pinnedNames: liveOracleSample.pinnedNames.map((entry) => (entry.nameIndex === 349 ? { ...entry, name: 'WRONGNAME' } : entry)),
    };
    expect(crossCheckShareWareDoom1WadPnamesSample(tampered)).toContain('oracle:name:349:value-mismatch');
  });

  test('reports an empty failure list for a freshly built equivalent sample', () => {
    const cloned: ShareWareDoom1WadPnamesSample = { ...liveOracleSample };
    expect(crossCheckShareWareDoom1WadPnamesSample(cloned)).toEqual([]);
  });
});

describe('parse-pnames-lump step file', () => {
  test('declares the wad lane and the parse-pnames-lump write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-008-parse-pnames-lump.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/parse-pnames-lump.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/parse-pnames-lump.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-008-parse-pnames-lump.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });
});
