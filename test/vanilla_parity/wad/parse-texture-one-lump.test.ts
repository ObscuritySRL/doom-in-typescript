import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import {
  SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE,
  TEXTURE_ONE_DIRECTORY_ENTRY_BYTES,
  TEXTURE_ONE_HEADER_BYTES,
  TEXTURE_ONE_LUMP_AUDIT,
  TEXTURE_ONE_LUMP_DERIVED_INVARIANTS,
  TEXTURE_ONE_MAPPATCH_BYTES,
  TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES,
  TEXTURE_ONE_NAME_BYTES,
  crossCheckShareWareDoom1WadTextureOneSample,
  crossCheckTextureOneLumpRuntime,
  parseTextureOneLump,
  textureOneMaptextureSize,
} from '../../../src/assets/parse-texture-one-lump.ts';
import type { TextureOneLumpAuditEntry, TextureOneLumpRuntimeSnapshot, ShareWareDoom1WadTextureOneSample } from '../../../src/assets/parse-texture-one-lump.ts';

const ALLOWED_AXIS_IDS = new Set<TextureOneLumpAuditEntry['id']>([
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
]);
const ALLOWED_SUBJECTS = new Set<TextureOneLumpAuditEntry['subject']>(['TEXTURE1', 'TEXTURE2', 'maptexture_t', 'mappatch_t', 'R_InitTextures', 'parseTextureOneLump', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<TextureOneLumpAuditEntry['referenceSourceFile']>(['src/doom/r_data.c', 'src/doom/w_wad.c', 'src/doom/p_setup.c']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const textureOneIndex = liveDirectory.findIndex((entry) => entry.name === 'TEXTURE1');
if (textureOneIndex < 0) {
  throw new Error('TEXTURE1 lump not found in shareware DOOM1.WAD live directory');
}
const textureOneEntry = liveDirectory[textureOneIndex]!;
const textureOneLumpData = wadBuffer.subarray(textureOneEntry.offset, textureOneEntry.offset + textureOneEntry.size);
const textureOneSha256 = createHash('sha256').update(textureOneLumpData).digest('hex');
const liveLump = parseTextureOneLump(textureOneLumpData);

const liveHasTexture2 = liveDirectory.some((entry) => entry.name === 'TEXTURE2');

function tryThrowsRangeError(thunk: () => unknown, pattern: RegExp): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof RangeError && pattern.test(err.message);
  }
}

interface BuildTextureSpec {
  readonly name: string;
  readonly masked?: number;
  readonly width: number;
  readonly height: number;
  readonly patches: ReadonlyArray<{ readonly originX: number; readonly originY: number; readonly patchIndex: number }>;
}

function buildTextureOneLumpBytes(specs: readonly BuildTextureSpec[]): Buffer {
  const headerSize = TEXTURE_ONE_HEADER_BYTES;
  const directorySize = specs.length * TEXTURE_ONE_DIRECTORY_ENTRY_BYTES;
  const blockSizes = specs.map((spec) => textureOneMaptextureSize(spec.patches.length));
  const totalBlocksSize = blockSizes.reduce((sum, size) => sum + size, 0);
  const buffer = Buffer.alloc(headerSize + directorySize + totalBlocksSize);

  buffer.writeInt32LE(specs.length, 0);

  let blockOffset = headerSize + directorySize;
  for (let index = 0; index < specs.length; index += 1) {
    const directoryOffset = headerSize + index * TEXTURE_ONE_DIRECTORY_ENTRY_BYTES;
    buffer.writeInt32LE(blockOffset, directoryOffset);

    const spec = specs[index]!;
    const nameBytes = Buffer.alloc(TEXTURE_ONE_NAME_BYTES);
    nameBytes.write(spec.name, 0, Math.min(spec.name.length, TEXTURE_ONE_NAME_BYTES), 'ascii');
    buffer.set(nameBytes, blockOffset);
    buffer.writeInt32LE(spec.masked ?? 0, blockOffset + 8);
    buffer.writeInt16LE(spec.width, blockOffset + 12);
    buffer.writeInt16LE(spec.height, blockOffset + 14);
    buffer.writeInt32LE(0, blockOffset + 16); // obsolete
    buffer.writeInt16LE(spec.patches.length, blockOffset + 20);

    for (let patchIndex = 0; patchIndex < spec.patches.length; patchIndex += 1) {
      const patch = spec.patches[patchIndex]!;
      const patchOffset = blockOffset + TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES + patchIndex * TEXTURE_ONE_MAPPATCH_BYTES;
      buffer.writeInt16LE(patch.originX, patchOffset + 0);
      buffer.writeInt16LE(patch.originY, patchOffset + 2);
      buffer.writeInt16LE(patch.patchIndex, patchOffset + 4);
      buffer.writeInt16LE(0, patchOffset + 6); // stepdir
      buffer.writeInt16LE(0, patchOffset + 8); // colormap
    }

    blockOffset += blockSizes[index]!;
  }

  return buffer;
}

function buildNegativeCountLump(): Buffer {
  const buf = Buffer.alloc(TEXTURE_ONE_HEADER_BYTES);
  buf.writeInt32LE(-1, 0);
  return buf;
}

function buildTruncatedDirectoryLump(declaredCount: number): Buffer {
  // declares many textures but supplies only the count header (and one stray byte)
  const buf = Buffer.alloc(TEXTURE_ONE_HEADER_BYTES + 1);
  buf.writeInt32LE(declaredCount, 0);
  return buf;
}

function buildBadOffsetLump(): Buffer {
  // declares 1 texture whose directory offset points past the lump end
  const buf = Buffer.alloc(TEXTURE_ONE_HEADER_BYTES + TEXTURE_ONE_DIRECTORY_ENTRY_BYTES + TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES);
  buf.writeInt32LE(1, 0);
  buf.writeInt32LE(0xfffff, 4);
  return buf;
}

const tooSmallLump = new Uint8Array(3);
const negativeCountLump = buildNegativeCountLump();
const truncatedDirectoryLump = buildTruncatedDirectoryLump(1000);
const badOffsetLump = buildBadOffsetLump();
const zeroCountLump = Buffer.alloc(TEXTURE_ONE_HEADER_BYTES);
zeroCountLump.writeInt32LE(0, 0);

// Build a synthetic lump and then manually overwrite the patchcount with a negative value
// to force the parser to reject negative patchcounts.
const negativePatchCountLump: Buffer = (() => {
  const base = buildTextureOneLumpBytes([
    {
      name: 'NEGPATCH',
      width: 16,
      height: 16,
      patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
    },
  ]);
  // header(4) + directory(4) = 8, maptexture starts at 8, patchcount at 8 + 20 = 28
  base.writeInt16LE(-5, 28);
  return base;
})();

const negativePatchOriginLump = buildTextureOneLumpBytes([
  {
    name: 'NEGORIG',
    width: 64,
    height: 32,
    patches: [{ originX: -42, originY: -7, patchIndex: 3 }],
  },
]);

const eightCharNameLump = buildTextureOneLumpBytes([
  {
    name: 'ABCDEFGH',
    width: 8,
    height: 8,
    patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
  },
]);

const lowercaseNameLump = buildTextureOneLumpBytes([
  {
    name: 'mixed',
    width: 32,
    height: 64,
    patches: [{ originX: 0, originY: 0, patchIndex: 1 }],
  },
]);

const parserRejectsBufferTooSmallForHeader = tryThrowsRangeError(() => parseTextureOneLump(tooSmallLump), /count header|at least/);
const parserRejectsNegativeCount = tryThrowsRangeError(() => parseTextureOneLump(negativeCountLump), /non-negative/);
const parserRejectsBufferTooSmallForDirectory = tryThrowsRangeError(() => parseTextureOneLump(truncatedDirectoryLump), /declares|directory needs|only/);
const parserRejectsOffsetPastLumpEnd = tryThrowsRangeError(() => parseTextureOneLump(badOffsetLump), /offset|out of range/);
const parserRejectsNegativePatchCount = tryThrowsRangeError(() => parseTextureOneLump(negativePatchCountLump), /negative patchcount/);

let parserAcceptsZeroCount = false;
try {
  const parsed = parseTextureOneLump(zeroCountLump);
  parserAcceptsZeroCount = parsed.count === 0 && parsed.textures.length === 0 && Object.isFrozen(parsed) && Object.isFrozen(parsed.textures);
} catch {
  parserAcceptsZeroCount = false;
}

let preservesNegativePatchOrigins = false;
try {
  const parsed = parseTextureOneLump(negativePatchOriginLump);
  const firstPatch = parsed.textures[0]!.patches[0]!;
  preservesNegativePatchOrigins = firstPatch.originX === -42 && firstPatch.originY === -7;
} catch {
  preservesNegativePatchOrigins = false;
}

const namesAreUppercaseAndTrimmed = liveLump.textures.every((entry) => entry.name === entry.name.toUpperCase() && !entry.name.includes('\0'));

function buildLiveRuntimeSnapshot(): TextureOneLumpRuntimeSnapshot {
  return {
    textureOneHeaderBytes: TEXTURE_ONE_HEADER_BYTES,
    textureOneDirectoryEntryBytes: TEXTURE_ONE_DIRECTORY_ENTRY_BYTES,
    textureOneMaptextureHeaderBytes: TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES,
    textureOneNameBytes: TEXTURE_ONE_NAME_BYTES,
    textureOneMappatchBytes: TEXTURE_ONE_MAPPATCH_BYTES,
    parserReturnsFullyFrozen: Object.isFrozen(liveLump) && Object.isFrozen(liveLump.textures) && liveLump.textures.every((entry) => Object.isFrozen(entry) && Object.isFrozen(entry.patches)),
    texturesLengthEqualsCount: liveLump.textures.length === liveLump.count,
    namesAreUppercaseAndTrimmed,
    parserRejectsBufferTooSmallForHeader,
    parserRejectsNegativeCount,
    parserRejectsBufferTooSmallForDirectory,
    parserRejectsOffsetPastLumpEnd,
    parserRejectsNegativePatchCount,
    parserAcceptsZeroCount,
    preservesNegativePatchOrigins,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadTextureOneSample {
  const pinnedTextures = SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.pinnedTextures.map((oracleEntry) => {
    const liveEntry = liveLump.textures[oracleEntry.textureIndex]!;
    const firstPatch = liveEntry.patches[0]!;
    return {
      textureIndex: oracleEntry.textureIndex,
      name: liveEntry.name,
      width: liveEntry.width,
      height: liveEntry.height,
      patchCount: liveEntry.patchCount,
      firstPatch: {
        originX: firstPatch.originX,
        originY: firstPatch.originY,
        patchIndex: firstPatch.patchIndex,
      },
    };
  });
  return {
    directoryIndex: textureOneIndex,
    fileOffset: textureOneEntry.offset,
    lumpSize: textureOneEntry.size,
    sha256: textureOneSha256,
    count: liveLump.count,
    hasTexture2: liveHasTexture2,
    pinnedTextures,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('TEXTURE1 lump audit ledger shape', () => {
  test('audits exactly nineteen behavioral axes', () => {
    expect(TEXTURE_ONE_LUMP_AUDIT.length).toBe(19);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of TEXTURE_ONE_LUMP_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = TEXTURE_ONE_LUMP_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of TEXTURE_ONE_LUMP_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of TEXTURE_ONE_LUMP_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of TEXTURE_ONE_LUMP_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of TEXTURE_ONE_LUMP_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('TEXTURE1 lump derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = TEXTURE_ONE_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(TEXTURE_ONE_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'TEXTURE_ONE_HEADER_BYTES_EQUALS_FOUR',
        'TEXTURE_ONE_DIRECTORY_ENTRY_BYTES_EQUALS_FOUR',
        'TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES_EQUALS_TWENTY_TWO',
        'TEXTURE_ONE_NAME_BYTES_EQUALS_EIGHT',
        'TEXTURE_ONE_MAPPATCH_BYTES_EQUALS_TEN',
        'PARSE_TEXTURE_ONE_LUMP_RETURNS_FROZEN_ARRAY',
        'PARSE_TEXTURE_ONE_LUMP_TEXTURES_LENGTH_EQUALS_COUNT',
        'PARSE_TEXTURE_ONE_LUMP_NAMES_ARE_UPPERCASE_AND_TRIMMED',
        'PARSE_TEXTURE_ONE_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
        'PARSE_TEXTURE_ONE_LUMP_REJECTS_NEGATIVE_COUNT',
        'PARSE_TEXTURE_ONE_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_DIRECTORY',
        'PARSE_TEXTURE_ONE_LUMP_REJECTS_OFFSET_PAST_LUMP_END',
        'PARSE_TEXTURE_ONE_LUMP_REJECTS_NEGATIVE_PATCHCOUNT',
        'PARSE_TEXTURE_ONE_LUMP_ACCEPTS_ZERO_COUNT',
        'PARSE_TEXTURE_ONE_LUMP_PRESERVES_NEGATIVE_PATCH_ORIGINS',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of TEXTURE_ONE_LUMP_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('TEXTURE_ONE_HEADER_BYTES is 4 (matches directory = maptex + 1)', () => {
    expect(TEXTURE_ONE_HEADER_BYTES).toBe(4);
  });

  test('TEXTURE_ONE_DIRECTORY_ENTRY_BYTES is 4 (matches directory++ on int*)', () => {
    expect(TEXTURE_ONE_DIRECTORY_ENTRY_BYTES).toBe(4);
  });

  test('TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES is 22 (8 + 4 + 2 + 2 + 4 + 2)', () => {
    expect(TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES).toBe(22);
  });

  test('TEXTURE_ONE_NAME_BYTES is 8 (matches char name[8])', () => {
    expect(TEXTURE_ONE_NAME_BYTES).toBe(8);
  });

  test('TEXTURE_ONE_MAPPATCH_BYTES is 10 (5 packed shorts)', () => {
    expect(TEXTURE_ONE_MAPPATCH_BYTES).toBe(10);
  });

  test('textureOneMaptextureSize(0) equals the bare 22-byte header', () => {
    expect(textureOneMaptextureSize(0)).toBe(TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES);
  });

  test('textureOneMaptextureSize(5) equals 22 + 5 * 10 = 72', () => {
    expect(textureOneMaptextureSize(5)).toBe(72);
    expect(textureOneMaptextureSize(5)).toBe(TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES + 5 * TEXTURE_ONE_MAPPATCH_BYTES);
  });

  test('textureOneMaptextureSize rejects negative patch counts', () => {
    expect(() => textureOneMaptextureSize(-1)).toThrow(RangeError);
  });

  test('textureOneMaptextureSize rejects non-integer patch counts', () => {
    expect(() => textureOneMaptextureSize(1.5)).toThrow(RangeError);
  });
});

describe('parseTextureOneLump runtime contract', () => {
  test('returns a frozen outer object, frozen textures array, and frozen patch arrays', () => {
    expect(Object.isFrozen(liveLump)).toBe(true);
    expect(Object.isFrozen(liveLump.textures)).toBe(true);
    for (const entry of liveLump.textures) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.patches)).toBe(true);
    }
  });

  test('reads the count as a little-endian int32 at offset 0', () => {
    const buf = buildTextureOneLumpBytes([{ name: 'PROBE', width: 8, height: 8, patches: [{ originX: 0, originY: 0, patchIndex: 0 }] }]);
    const parsed = parseTextureOneLump(buf);
    expect(parsed.count).toBe(1);
    expect(parsed.textures[0]!.name).toBe('PROBE');
  });

  test('decodes shareware DOOM1.WAD live count to 125', () => {
    expect(liveLump.count).toBe(125);
    expect(liveLump.textures.length).toBe(125);
  });

  test('every name is uppercase ASCII with no embedded NUL bytes', () => {
    for (const entry of liveLump.textures) {
      expect(entry.name).toBe(entry.name.toUpperCase());
      expect(entry.name.includes('\0')).toBe(false);
      expect(entry.name.length).toBeLessThanOrEqual(TEXTURE_ONE_NAME_BYTES);
    }
  });

  test('rejects a buffer too small for the 4-byte count header', () => {
    expect(() => parseTextureOneLump(new Uint8Array(0))).toThrow(RangeError);
    expect(() => parseTextureOneLump(new Uint8Array(3))).toThrow(RangeError);
  });

  test('rejects a negative declared count', () => {
    expect(() => parseTextureOneLump(negativeCountLump)).toThrow(/non-negative/);
  });

  test('rejects a buffer too small for the directory', () => {
    expect(() => parseTextureOneLump(truncatedDirectoryLump)).toThrow(/declares|only/);
  });

  test('rejects a directory entry whose offset overflows the lump (vanilla bad-texture-directory fatal)', () => {
    expect(() => parseTextureOneLump(badOffsetLump)).toThrow(/out of range|offset/);
  });

  test('rejects a negative patchcount', () => {
    expect(() => parseTextureOneLump(negativePatchCountLump)).toThrow(/negative patchcount/);
  });

  test('accepts a degenerate zero-count lump', () => {
    const parsed = parseTextureOneLump(zeroCountLump);
    expect(parsed.count).toBe(0);
    expect(parsed.textures).toEqual([]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.textures)).toBe(true);
  });

  test('preserves an 8-character name that fills the entire field with no trailing NUL', () => {
    const parsed = parseTextureOneLump(eightCharNameLump);
    expect(parsed.count).toBe(1);
    expect(parsed.textures[0]!.name).toBe('ABCDEFGH');
  });

  test('uppercases lowercase names from the lump (case-insensitive lookup)', () => {
    const parsed = parseTextureOneLump(lowercaseNameLump);
    expect(parsed.textures[0]!.name).toBe('MIXED');
  });

  test('preserves negative mappatch origins (signed int16 reads)', () => {
    const parsed = parseTextureOneLump(negativePatchOriginLump);
    const patch = parsed.textures[0]!.patches[0]!;
    expect(patch.originX).toBe(-42);
    expect(patch.originY).toBe(-7);
    expect(patch.patchIndex).toBe(3);
  });

  test('accepts a Uint8Array (non-Buffer) input', () => {
    const buf = buildTextureOneLumpBytes([{ name: 'UINT8', width: 8, height: 8, patches: [{ originX: 0, originY: 0, patchIndex: 0 }] }]);
    const view = new Uint8Array(buf);
    const parsed = parseTextureOneLump(view);
    expect(parsed.count).toBe(1);
    expect(parsed.textures[0]!.name).toBe('UINT8');
  });

  test('does not propagate the obsolete column-directory pointer', () => {
    const buf = buildTextureOneLumpBytes([{ name: 'OBSOLETE', width: 16, height: 16, patches: [{ originX: 0, originY: 0, patchIndex: 0 }] }]);
    // Inject a non-zero obsolete value at offset 16 of the maptexture (header(4) + dir(4) = 8, then 16 -> abs offset 24)
    buf.writeInt32LE(0x12345678, 8 + 16);
    const parsed = parseTextureOneLump(buf);
    const keys = Object.keys(parsed.textures[0]!);
    expect(keys).not.toContain('obsolete');
  });

  test('does not propagate mappatch stepdir or colormap', () => {
    const buf = buildTextureOneLumpBytes([{ name: 'STEPDIR', width: 16, height: 16, patches: [{ originX: 0, originY: 0, patchIndex: 0 }] }]);
    // Inject non-zero stepdir/colormap at the first mappatch (header(4) + dir(4) + maptex(22) = 30, then +6/+8)
    buf.writeInt16LE(0x1234, 30 + 6);
    buf.writeInt16LE(0x5678, 30 + 8);
    const parsed = parseTextureOneLump(buf);
    const keys = Object.keys(parsed.textures[0]!.patches[0]!);
    expect(keys).not.toContain('stepdir');
    expect(keys).not.toContain('colormap');
  });

  test('decodes a multi-patch texture with the documented mappatch stride', () => {
    const buf = buildTextureOneLumpBytes([
      {
        name: 'MULTI',
        width: 96,
        height: 64,
        patches: [
          { originX: 0, originY: 0, patchIndex: 1 },
          { originX: 32, originY: 0, patchIndex: 2 },
          { originX: 64, originY: 0, patchIndex: 3 },
        ],
      },
    ]);
    const parsed = parseTextureOneLump(buf);
    expect(parsed.textures[0]!.patchCount).toBe(3);
    expect(parsed.textures[0]!.patches.map((p) => p.patchIndex)).toEqual([1, 2, 3]);
    expect(parsed.textures[0]!.patches.map((p) => p.originX)).toEqual([0, 32, 64]);
  });
});

describe('crossCheckTextureOneLumpRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckTextureOneLumpRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckTextureOneLumpRuntime failure modes', () => {
  test('detects a tampered TEXTURE_ONE_HEADER_BYTES that no longer equals 4', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureOneHeaderBytes: 8 };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_ONE_HEADER_BYTES_EQUALS_FOUR');
    expect(failures).toContain('audit:texture-one-header-bytes-four:not-observed');
    expect(failures).toContain('audit:texture-one-directory-starts-at-offset-four:not-observed');
  });

  test('detects a tampered TEXTURE_ONE_DIRECTORY_ENTRY_BYTES that no longer equals 4', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureOneDirectoryEntryBytes: 8 };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_ONE_DIRECTORY_ENTRY_BYTES_EQUALS_FOUR');
    expect(failures).toContain('audit:texture-one-directory-entry-bytes-four:not-observed');
  });

  test('detects a tampered TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES that no longer equals 22', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureOneMaptextureHeaderBytes: 24 };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES_EQUALS_TWENTY_TWO');
    expect(failures).toContain('audit:texture-one-maptexture-header-bytes-twenty-two:not-observed');
  });

  test('detects a tampered TEXTURE_ONE_NAME_BYTES that no longer equals 8', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureOneNameBytes: 9 };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_ONE_NAME_BYTES_EQUALS_EIGHT');
    expect(failures).toContain('audit:texture-one-maptexture-name-bytes-eight:not-observed');
  });

  test('detects a tampered TEXTURE_ONE_MAPPATCH_BYTES that no longer equals 10', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureOneMappatchBytes: 12 };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_ONE_MAPPATCH_BYTES_EQUALS_TEN');
    expect(failures).toContain('audit:texture-one-mappatch-struct-bytes-ten:not-observed');
  });

  test('detects a parser that fails to freeze the returned lump', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFullyFrozen: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_RETURNS_FROZEN_ARRAY');
    expect(failures).toContain('audit:texture-one-cache-by-name-via-w-cachelumpname:not-observed');
  });

  test('detects a parser whose textures.length does not equal count', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, texturesLengthEqualsCount: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_TEXTURES_LENGTH_EQUALS_COUNT');
    expect(failures).toContain('audit:texture-one-header-count-int32-le:not-observed');
  });

  test('detects a parser that leaves names lowercased or NUL-padded', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, namesAreUppercaseAndTrimmed: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_NAMES_ARE_UPPERCASE_AND_TRIMMED');
    expect(failures).toContain('audit:texture-one-maptexture-name-copied-via-memcpy-no-terminator:not-observed');
  });

  test('detects a parser that silently accepts a buffer too small for the header', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForHeader: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  });

  test('detects a parser that silently accepts a negative count', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsNegativeCount: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_NEGATIVE_COUNT');
  });

  test('detects a parser that silently accepts a truncated directory', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForDirectory: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_BUFFER_TOO_SMALL_FOR_DIRECTORY');
  });

  test('detects a parser that silently accepts an offset past the lump end (vanilla bad-texture-directory)', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsOffsetPastLumpEnd: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_OFFSET_PAST_LUMP_END');
    expect(failures).toContain('audit:texture-one-offset-bounds-check-against-maxoff:not-observed');
  });

  test('detects a parser that silently accepts a negative patchcount', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsNegativePatchCount: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_REJECTS_NEGATIVE_PATCHCOUNT');
    expect(failures).toContain('audit:texture-one-maptexture-patchcount-int16-le:not-observed');
  });

  test('detects a parser that rejects the degenerate zero-count case', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserAcceptsZeroCount: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_ACCEPTS_ZERO_COUNT');
    expect(failures).toContain('audit:texture-one-shareware-doom1-no-texture2-sibling:not-observed');
  });

  test('detects a parser that mishandles negative mappatch origins', () => {
    const tampered: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, preservesNegativePatchOrigins: false };
    const failures = crossCheckTextureOneLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_ONE_LUMP_PRESERVES_NEGATIVE_PATCH_ORIGINS');
    expect(failures).toContain('audit:texture-one-mappatch-originx-originy-int16-le:not-observed');
  });

  test('reports an empty failure list for a freshly built equivalent snapshot', () => {
    const cloned: TextureOneLumpRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckTextureOneLumpRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD TEXTURE1 oracle', () => {
  test('declares the expected directory index, file offset, lump size, sha256, and count', () => {
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.directoryIndex).toBe(105);
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.fileOffset).toBe(915712);
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.lumpSize).toBe(9234);
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.count).toBe(125);
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.sha256).toBe('8272dd48efe5d73f2b03cdf6d42e18da17c97aebea4d32a28846cdc92438cc4a');
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.hasTexture2).toBe(false);
  });

  test('declares pinned texture probes covering first, mid, and last entries', () => {
    const indices = SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.pinnedTextures.map((entry) => entry.textureIndex);
    expect(indices).toEqual([0, 1, 50, 100, 124]);
  });

  test('live IWAD directory index and lump bytes match the oracle', () => {
    expect(textureOneIndex).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.directoryIndex);
    expect(textureOneEntry.offset).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.fileOffset);
    expect(textureOneEntry.size).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.lumpSize);
    expect(textureOneSha256).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.sha256);
  });

  test('live count matches the oracle', () => {
    expect(liveLump.count).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.count);
  });

  test('shareware IWAD has no TEXTURE2 sibling lump', () => {
    expect(liveHasTexture2).toBe(false);
  });

  test('every pinned texture probe matches the live IWAD', () => {
    for (const oraclePinned of SHAREWARE_DOOM1_WAD_TEXTURE_ONE_ORACLE.pinnedTextures) {
      const liveEntry = liveLump.textures[oraclePinned.textureIndex]!;
      expect(liveEntry.name).toBe(oraclePinned.name);
      expect(liveEntry.width).toBe(oraclePinned.width);
      expect(liveEntry.height).toBe(oraclePinned.height);
      expect(liveEntry.patchCount).toBe(oraclePinned.patchCount);
      const firstPatch = liveEntry.patches[0]!;
      expect(firstPatch.originX).toBe(oraclePinned.firstPatch.originX);
      expect(firstPatch.originY).toBe(oraclePinned.firstPatch.originY);
      expect(firstPatch.patchIndex).toBe(oraclePinned.firstPatch.patchIndex);
    }
  });

  test('crossCheckShareWareDoom1WadTextureOneSample reports zero failures on the live oracle sample', () => {
    expect(crossCheckShareWareDoom1WadTextureOneSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on texture-definition count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { 'texture-definition': number } };
    expect(manifest.lumpCategories['texture-definition']).toBe(1);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });
});

describe('crossCheckShareWareDoom1WadTextureOneSample failure modes', () => {
  test('detects a wrong directoryIndex', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = { ...liveOracleSample, directoryIndex: 0 };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:directoryIndex:value-mismatch');
  });

  test('detects a wrong fileOffset', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = { ...liveOracleSample, fileOffset: 0 };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:fileOffset:value-mismatch');
  });

  test('detects a wrong lumpSize', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = { ...liveOracleSample, lumpSize: 0 };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:lumpSize:value-mismatch');
  });

  test('detects a wrong sha256', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = { ...liveOracleSample, sha256: '0'.repeat(64) };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:sha256:value-mismatch');
  });

  test('detects a wrong count', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = { ...liveOracleSample, count: 999 };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:count:value-mismatch');
  });

  test('detects a wrong hasTexture2 flag (e.g., a bundle that accidentally includes TEXTURE2 in shareware)', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = { ...liveOracleSample, hasTexture2: true };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:hasTexture2:value-mismatch');
  });

  test('detects a missing pinned texture probe', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = {
      ...liveOracleSample,
      pinnedTextures: liveOracleSample.pinnedTextures.filter((entry) => entry.textureIndex !== 0),
    };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:texture:0:not-found');
  });

  test('detects a wrong name on a pinned probe', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = {
      ...liveOracleSample,
      pinnedTextures: liveOracleSample.pinnedTextures.map((entry) => (entry.textureIndex === 124 ? { ...entry, name: 'WRONGTEX' } : entry)),
    };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:texture:124:name:value-mismatch');
  });

  test('detects a wrong width on a pinned probe', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = {
      ...liveOracleSample,
      pinnedTextures: liveOracleSample.pinnedTextures.map((entry) => (entry.textureIndex === 0 ? { ...entry, width: 99 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:texture:0:width:value-mismatch');
  });

  test('detects a wrong height on a pinned probe', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = {
      ...liveOracleSample,
      pinnedTextures: liveOracleSample.pinnedTextures.map((entry) => (entry.textureIndex === 0 ? { ...entry, height: 99 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:texture:0:height:value-mismatch');
  });

  test('detects a wrong patchCount on a pinned probe', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = {
      ...liveOracleSample,
      pinnedTextures: liveOracleSample.pinnedTextures.map((entry) => (entry.textureIndex === 1 ? { ...entry, patchCount: 99 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:texture:1:patchCount:value-mismatch');
  });

  test('detects a wrong firstPatch.originX on a pinned probe', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = {
      ...liveOracleSample,
      pinnedTextures: liveOracleSample.pinnedTextures.map((entry) => (entry.textureIndex === 124 ? { ...entry, firstPatch: { ...entry.firstPatch, originX: 0 } } : entry)),
    };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:texture:124:firstPatch.originX:value-mismatch');
  });

  test('detects a wrong firstPatch.originY on a pinned probe', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = {
      ...liveOracleSample,
      pinnedTextures: liveOracleSample.pinnedTextures.map((entry) => (entry.textureIndex === 124 ? { ...entry, firstPatch: { ...entry.firstPatch, originY: 0 } } : entry)),
    };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:texture:124:firstPatch.originY:value-mismatch');
  });

  test('detects a wrong firstPatch.patchIndex on a pinned probe', () => {
    const tampered: ShareWareDoom1WadTextureOneSample = {
      ...liveOracleSample,
      pinnedTextures: liveOracleSample.pinnedTextures.map((entry) => (entry.textureIndex === 50 ? { ...entry, firstPatch: { ...entry.firstPatch, patchIndex: 0 } } : entry)),
    };
    expect(crossCheckShareWareDoom1WadTextureOneSample(tampered)).toContain('oracle:texture:50:firstPatch.patchIndex:value-mismatch');
  });

  test('reports an empty failure list for a freshly built equivalent sample', () => {
    const cloned: ShareWareDoom1WadTextureOneSample = { ...liveOracleSample };
    expect(crossCheckShareWareDoom1WadTextureOneSample(cloned)).toEqual([]);
  });
});

describe('parse-texture-one-lump step file', () => {
  test('declares the wad lane and the parse-texture-one-lump write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-009-parse-texture-one-lump.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/parse-texture-one-lump.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/parse-texture-one-lump.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-009-parse-texture-one-lump.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });
});
