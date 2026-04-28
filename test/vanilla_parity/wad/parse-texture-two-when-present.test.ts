import { describe, expect, test } from 'bun:test';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { TEXTURE_ONE_DIRECTORY_ENTRY_BYTES, TEXTURE_ONE_HEADER_BYTES, TEXTURE_ONE_MAPPATCH_BYTES, TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES, TEXTURE_ONE_NAME_BYTES, parseTextureOneLump } from '../../../src/assets/parse-texture-one-lump.ts';
import {
  SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE,
  TEXTURE_TWO_DIRECTORY_ENTRY_BYTES,
  TEXTURE_TWO_HEADER_BYTES,
  TEXTURE_TWO_LUMP_AUDIT,
  TEXTURE_TWO_LUMP_DERIVED_INVARIANTS,
  TEXTURE_TWO_MAPPATCH_BYTES,
  TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES,
  TEXTURE_TWO_NAME_BYTES,
  combineNumTextures,
  crossCheckShareWareDoom1WadTextureTwoSample,
  crossCheckTextureTwoLumpRuntime,
  parseTextureTwoWhenPresent,
} from '../../../src/assets/parse-texture-two-when-present.ts';
import type { TextureTwoLumpAuditEntry, TextureTwoLumpRuntimeSnapshot, ShareWareDoom1WadTextureTwoSample } from '../../../src/assets/parse-texture-two-when-present.ts';

const ALLOWED_AXIS_IDS = new Set<TextureTwoLumpAuditEntry['id']>([
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
]);
const ALLOWED_SUBJECTS = new Set<TextureTwoLumpAuditEntry['subject']>(['TEXTURE2', 'R_InitTextures', 'W_CheckNumForName', 'W_CacheLumpName', 'W_LumpLength', 'DEH_String', 'parseTextureTwoWhenPresent', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<TextureTwoLumpAuditEntry['referenceSourceFile']>(['src/doom/r_data.c', 'src/doom/w_wad.c', 'src/doom/p_setup.c']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const liveTextureTwoEntry = liveDirectory.find((entry) => entry.name === 'TEXTURE2');
const liveHasTexture2 = liveTextureTwoEntry !== undefined;

const liveTextureOneEntry = liveDirectory.find((entry) => entry.name === 'TEXTURE1');
if (!liveTextureOneEntry) {
  throw new Error('TEXTURE1 lump not found in shareware DOOM1.WAD live directory');
}
const liveTextureOneLumpData = wadBuffer.subarray(liveTextureOneEntry.offset, liveTextureOneEntry.offset + liveTextureOneEntry.size);
const liveTextureOneLump = parseTextureOneLump(liveTextureOneLumpData);

interface BuildTextureSpec {
  readonly name: string;
  readonly masked?: number;
  readonly width: number;
  readonly height: number;
  readonly patches: ReadonlyArray<{ readonly originX: number; readonly originY: number; readonly patchIndex: number }>;
}

function buildTextureTwoLumpBytes(specs: readonly BuildTextureSpec[]): Buffer {
  const headerSize = TEXTURE_TWO_HEADER_BYTES;
  const directorySize = specs.length * TEXTURE_TWO_DIRECTORY_ENTRY_BYTES;
  const blockSizes = specs.map((spec) => TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES + spec.patches.length * TEXTURE_TWO_MAPPATCH_BYTES);
  const totalBlocksSize = blockSizes.reduce((sum, size) => sum + size, 0);
  const buffer = Buffer.alloc(headerSize + directorySize + totalBlocksSize);

  buffer.writeInt32LE(specs.length, 0);

  let blockOffset = headerSize + directorySize;
  for (let index = 0; index < specs.length; index += 1) {
    const directoryOffset = headerSize + index * TEXTURE_TWO_DIRECTORY_ENTRY_BYTES;
    buffer.writeInt32LE(blockOffset, directoryOffset);

    const spec = specs[index]!;
    const nameBytes = Buffer.alloc(TEXTURE_TWO_NAME_BYTES);
    nameBytes.write(spec.name, 0, Math.min(spec.name.length, TEXTURE_TWO_NAME_BYTES), 'ascii');
    buffer.set(nameBytes, blockOffset);
    buffer.writeInt32LE(spec.masked ?? 0, blockOffset + 8);
    buffer.writeInt16LE(spec.width, blockOffset + 12);
    buffer.writeInt16LE(spec.height, blockOffset + 14);
    buffer.writeInt32LE(0, blockOffset + 16); // obsolete
    buffer.writeInt16LE(spec.patches.length, blockOffset + 20);

    for (let patchIndex = 0; patchIndex < spec.patches.length; patchIndex += 1) {
      const patch = spec.patches[patchIndex]!;
      const patchOffset = blockOffset + TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES + patchIndex * TEXTURE_TWO_MAPPATCH_BYTES;
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
  const buf = Buffer.alloc(TEXTURE_TWO_HEADER_BYTES);
  buf.writeInt32LE(-1, 0);
  return buf;
}

function buildBadOffsetLump(): Buffer {
  const buf = Buffer.alloc(TEXTURE_TWO_HEADER_BYTES + TEXTURE_TWO_DIRECTORY_ENTRY_BYTES + TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES);
  buf.writeInt32LE(1, 0);
  buf.writeInt32LE(0xfffff, 4);
  return buf;
}

function tryThrowsRangeError(thunk: () => unknown, pattern: RegExp): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof RangeError && pattern.test(err.message);
  }
}

const tooSmallLump = new Uint8Array(3);
const negativeCountLump = buildNegativeCountLump();
const badOffsetLump = buildBadOffsetLump();
const zeroCountLump = Buffer.alloc(TEXTURE_TWO_HEADER_BYTES);
zeroCountLump.writeInt32LE(0, 0);

const validTextureTwoLump = buildTextureTwoLumpBytes([
  { name: 'EXTRA1', width: 64, height: 128, patches: [{ originX: 0, originY: 0, patchIndex: 0 }] },
  { name: 'EXTRA2', width: 32, height: 64, patches: [{ originX: 0, originY: 0, patchIndex: 1 }] },
  {
    name: 'EXTRA3',
    width: 128,
    height: 128,
    patches: [
      { originX: 0, originY: 0, patchIndex: 2 },
      { originX: 64, originY: 0, patchIndex: 3 },
    ],
  },
]);

const negativePatchOriginLump = buildTextureTwoLumpBytes([
  {
    name: 'NEGORIG2',
    width: 64,
    height: 32,
    patches: [{ originX: -55, originY: -9, patchIndex: 7 }],
  },
]);

const eightCharNameLump = buildTextureTwoLumpBytes([
  {
    name: 'ABCDEFGH',
    width: 8,
    height: 8,
    patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
  },
]);

const lowercaseNameLump = buildTextureTwoLumpBytes([
  {
    name: 'mixed',
    width: 32,
    height: 64,
    patches: [{ originX: 0, originY: 0, patchIndex: 1 }],
  },
]);

const negativePatchCountLump: Buffer = (() => {
  const base = buildTextureTwoLumpBytes([
    {
      name: 'NEGPC',
      width: 16,
      height: 16,
      patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
    },
  ]);
  // header(4) + directory(4) = 8, maptexture starts at 8, patchcount at 8 + 20 = 28
  base.writeInt16LE(-7, 28);
  return base;
})();

const parserRejectsBufferTooSmallForHeader = tryThrowsRangeError(() => parseTextureTwoWhenPresent(tooSmallLump), /count header|at least/);
const parserRejectsNegativeCount = tryThrowsRangeError(() => parseTextureTwoWhenPresent(negativeCountLump), /non-negative/);
const parserRejectsOffsetPastLumpEnd = tryThrowsRangeError(() => parseTextureTwoWhenPresent(badOffsetLump), /offset|out of range/);

const parsedValidLump = parseTextureTwoWhenPresent(validTextureTwoLump);
if (parsedValidLump === null) {
  throw new Error('parseTextureTwoWhenPresent unexpectedly returned null for the valid synthetic lump');
}
const parsedZeroCountLump = parseTextureTwoWhenPresent(zeroCountLump);

const parserAcceptsZeroCount = parsedZeroCountLump !== null && parsedZeroCountLump.count === 0 && parsedZeroCountLump.textures.length === 0 && Object.isFrozen(parsedZeroCountLump) && Object.isFrozen(parsedZeroCountLump.textures);

const parserReturnsFullyFrozenForValidInput = Object.isFrozen(parsedValidLump) && Object.isFrozen(parsedValidLump.textures) && parsedValidLump.textures.every((entry) => Object.isFrozen(entry) && Object.isFrozen(entry.patches));

const namesAreUppercaseAndTrimmed = parsedValidLump.textures.every((entry) => entry.name === entry.name.toUpperCase() && !entry.name.includes('\0'));

const texturesLengthEqualsCount = parsedValidLump.textures.length === parsedValidLump.count;

const combineReturnsSumForPresentLump = combineNumTextures(125, parsedValidLump) === 125 + parsedValidLump.count;
const combineReturnsCount1ForNullLump = combineNumTextures(125, null) === 125;
const combineRejectsNegativeInput = (() => {
  try {
    combineNumTextures(-1, null);
    return false;
  } catch (err) {
    return err instanceof RangeError;
  }
})();

function buildLiveRuntimeSnapshot(): TextureTwoLumpRuntimeSnapshot {
  return {
    textureTwoHeaderBytes: TEXTURE_TWO_HEADER_BYTES,
    textureTwoDirectoryEntryBytes: TEXTURE_TWO_DIRECTORY_ENTRY_BYTES,
    textureTwoMaptextureHeaderBytes: TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES,
    textureTwoNameBytes: TEXTURE_TWO_NAME_BYTES,
    textureTwoMappatchBytes: TEXTURE_TWO_MAPPATCH_BYTES,
    parserReturnsNullForNullInput: parseTextureTwoWhenPresent(null) === null,
    parserReturnsNullForUndefinedInput: parseTextureTwoWhenPresent(undefined) === null,
    parserReturnsFullyFrozenForValidInput,
    texturesLengthEqualsCount,
    namesAreUppercaseAndTrimmed,
    parserRejectsBufferTooSmallForHeader,
    parserRejectsNegativeCount,
    parserRejectsOffsetPastLumpEnd,
    parserAcceptsZeroCount,
    combineReturnsSumForPresentLump,
    combineReturnsCount1ForNullLump,
    combineRejectsNegativeInput,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

const textureDefinitionLumpCount = liveDirectory.filter((entry) => entry.name === 'TEXTURE1' || entry.name === 'TEXTURE2').length;

function buildLiveOracleSample(): ShareWareDoom1WadTextureTwoSample {
  const numTextures1 = liveTextureOneLump.count;
  const numTextures2 = liveHasTexture2 ? 0 : 0;
  return {
    hasTexture2: liveHasTexture2,
    combinedNumTextures: combineNumTextures(numTextures1, null),
    numTextures1,
    numTextures2,
    textureDefinitionLumpCount,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('TEXTURE2 lump audit ledger shape', () => {
  test('audits exactly sixteen behavioral axes', () => {
    expect(TEXTURE_TWO_LUMP_AUDIT.length).toBe(16);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of TEXTURE_TWO_LUMP_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = TEXTURE_TWO_LUMP_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of TEXTURE_TWO_LUMP_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of TEXTURE_TWO_LUMP_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of TEXTURE_TWO_LUMP_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of TEXTURE_TWO_LUMP_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the optional-probe axis cites W_CheckNumForName and DEH_String', () => {
    const entry = TEXTURE_TWO_LUMP_AUDIT.find((axis) => axis.id === 'texture-two-optional-via-w-checknumforname-probe')!;
    expect(entry.cSourceLines.join('\n')).toContain('W_CheckNumForName');
    expect(entry.cSourceLines.join('\n')).toContain('DEH_String');
  });

  test('the else-branch axis cites maptex2 = NULL and numtextures2 = 0 and maxoff2 = 0', () => {
    const entry = TEXTURE_TWO_LUMP_AUDIT.find((axis) => axis.id === 'texture-two-else-branch-zeroes-maptex2-and-numtextures2-and-maxoff2')!;
    expect(entry.cSourceLines.join('\n')).toContain('maptex2 = NULL');
    expect(entry.cSourceLines.join('\n')).toContain('numtextures2 = 0');
    expect(entry.cSourceLines.join('\n')).toContain('maxoff2 = 0');
  });

  test('the aggregation axis cites numtextures = numtextures1 + numtextures2', () => {
    const entry = TEXTURE_TWO_LUMP_AUDIT.find((axis) => axis.id === 'texture-two-numtextures-aggregation')!;
    expect(entry.cSourceLines.join('\n')).toContain('numtextures = numtextures1 + numtextures2');
  });

  test('the runtime-index-continuation axis cites the i == numtextures1 rebind', () => {
    const entry = TEXTURE_TWO_LUMP_AUDIT.find((axis) => axis.id === 'texture-two-runtime-index-continuation-after-numtextures1')!;
    expect(entry.cSourceLines.join('\n')).toContain('i == numtextures1');
    expect(entry.cSourceLines.join('\n')).toContain('maptex = maptex2');
  });

  test('the bounds-check axis cites the I_Error("R_InitTextures: bad texture directory") fatal', () => {
    const entry = TEXTURE_TWO_LUMP_AUDIT.find((axis) => axis.id === 'texture-two-bounds-check-against-maxoff-when-present')!;
    expect(entry.cSourceLines.join('\n')).toContain('R_InitTextures: bad texture directory');
  });

  test('every axis declares src/doom/r_data.c as the reference source file', () => {
    for (const entry of TEXTURE_TWO_LUMP_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/doom/r_data.c');
    }
  });
});

describe('TEXTURE2 lump derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = TEXTURE_TWO_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(TEXTURE_TWO_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'TEXTURE_TWO_HEADER_BYTES_EQUALS_TEXTURE_ONE',
        'TEXTURE_TWO_DIRECTORY_ENTRY_BYTES_EQUALS_TEXTURE_ONE',
        'TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES_EQUALS_TEXTURE_ONE',
        'TEXTURE_TWO_NAME_BYTES_EQUALS_TEXTURE_ONE',
        'TEXTURE_TWO_MAPPATCH_BYTES_EQUALS_TEXTURE_ONE',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_NULL_FOR_NULL_INPUT',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_NULL_FOR_UNDEFINED_INPUT',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_FROZEN_LUMP_FOR_VALID_INPUT',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_TEXTURES_LENGTH_EQUALS_COUNT',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_NAMES_ARE_UPPERCASE_AND_TRIMMED',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_NEGATIVE_COUNT',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_OFFSET_PAST_LUMP_END',
        'PARSE_TEXTURE_TWO_WHEN_PRESENT_ACCEPTS_ZERO_COUNT',
        'COMBINE_NUMTEXTURES_RETURNS_SUM_FOR_PRESENT_LUMP',
        'COMBINE_NUMTEXTURES_RETURNS_COUNT1_FOR_NULL_LUMP',
        'COMBINE_NUMTEXTURES_REJECTS_NEGATIVE_INPUT',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of TEXTURE_TWO_LUMP_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the same byte format as TEXTURE1', () => {
  test('TEXTURE_TWO_HEADER_BYTES equals TEXTURE_ONE_HEADER_BYTES (4)', () => {
    expect(TEXTURE_TWO_HEADER_BYTES).toBe(TEXTURE_ONE_HEADER_BYTES);
    expect(TEXTURE_TWO_HEADER_BYTES).toBe(4);
  });

  test('TEXTURE_TWO_DIRECTORY_ENTRY_BYTES equals TEXTURE_ONE_DIRECTORY_ENTRY_BYTES (4)', () => {
    expect(TEXTURE_TWO_DIRECTORY_ENTRY_BYTES).toBe(TEXTURE_ONE_DIRECTORY_ENTRY_BYTES);
    expect(TEXTURE_TWO_DIRECTORY_ENTRY_BYTES).toBe(4);
  });

  test('TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES equals TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES (22)', () => {
    expect(TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES).toBe(TEXTURE_ONE_MAPTEXTURE_HEADER_BYTES);
    expect(TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES).toBe(22);
  });

  test('TEXTURE_TWO_NAME_BYTES equals TEXTURE_ONE_NAME_BYTES (8)', () => {
    expect(TEXTURE_TWO_NAME_BYTES).toBe(TEXTURE_ONE_NAME_BYTES);
    expect(TEXTURE_TWO_NAME_BYTES).toBe(8);
  });

  test('TEXTURE_TWO_MAPPATCH_BYTES equals TEXTURE_ONE_MAPPATCH_BYTES (10)', () => {
    expect(TEXTURE_TWO_MAPPATCH_BYTES).toBe(TEXTURE_ONE_MAPPATCH_BYTES);
    expect(TEXTURE_TWO_MAPPATCH_BYTES).toBe(10);
  });
});

describe('parseTextureTwoWhenPresent runtime contract: absent branch', () => {
  test('returns null for null input (matches the upstream else-branch)', () => {
    expect(parseTextureTwoWhenPresent(null)).toBeNull();
  });

  test('returns null for undefined input (caller-convenience for an absent lump)', () => {
    expect(parseTextureTwoWhenPresent(undefined)).toBeNull();
  });
});

describe('parseTextureTwoWhenPresent runtime contract: present branch', () => {
  test('returns a frozen outer object, frozen textures array, and frozen patch arrays', () => {
    expect(Object.isFrozen(parsedValidLump)).toBe(true);
    expect(Object.isFrozen(parsedValidLump.textures)).toBe(true);
    for (const entry of parsedValidLump.textures) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.patches)).toBe(true);
    }
  });

  test('reads the count as a little-endian int32 at offset 0', () => {
    expect(parsedValidLump.count).toBe(3);
    expect(parsedValidLump.textures.length).toBe(3);
  });

  test('decodes the synthetic three-texture lump in lump order', () => {
    expect(parsedValidLump.textures.map((entry) => entry.name)).toEqual(['EXTRA1', 'EXTRA2', 'EXTRA3']);
  });

  test('decodes per-texture dimensions and patch counts correctly', () => {
    expect(parsedValidLump.textures[0]!.width).toBe(64);
    expect(parsedValidLump.textures[0]!.height).toBe(128);
    expect(parsedValidLump.textures[0]!.patchCount).toBe(1);
    expect(parsedValidLump.textures[2]!.width).toBe(128);
    expect(parsedValidLump.textures[2]!.height).toBe(128);
    expect(parsedValidLump.textures[2]!.patchCount).toBe(2);
  });

  test('every name is uppercase ASCII with no embedded NUL bytes', () => {
    for (const entry of parsedValidLump.textures) {
      expect(entry.name).toBe(entry.name.toUpperCase());
      expect(entry.name.includes('\0')).toBe(false);
      expect(entry.name.length).toBeLessThanOrEqual(TEXTURE_TWO_NAME_BYTES);
    }
  });

  test('rejects a non-null buffer too small for the 4-byte count header', () => {
    expect(() => parseTextureTwoWhenPresent(new Uint8Array(0))).toThrow(RangeError);
    expect(() => parseTextureTwoWhenPresent(new Uint8Array(3))).toThrow(RangeError);
  });

  test('rejects a negative declared count', () => {
    expect(() => parseTextureTwoWhenPresent(negativeCountLump)).toThrow(/non-negative/);
  });

  test('rejects a directory entry whose offset overflows the lump (vanilla bad-texture-directory fatal)', () => {
    expect(() => parseTextureTwoWhenPresent(badOffsetLump)).toThrow(/out of range|offset/);
  });

  test('rejects a negative patchcount', () => {
    expect(() => parseTextureTwoWhenPresent(negativePatchCountLump)).toThrow(/negative patchcount/);
  });

  test('accepts a degenerate zero-count lump', () => {
    const parsed = parseTextureTwoWhenPresent(zeroCountLump)!;
    expect(parsed.count).toBe(0);
    expect(parsed.textures).toEqual([]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.textures)).toBe(true);
  });

  test('preserves an 8-character name that fills the entire field with no trailing NUL', () => {
    const parsed = parseTextureTwoWhenPresent(eightCharNameLump)!;
    expect(parsed.count).toBe(1);
    expect(parsed.textures[0]!.name).toBe('ABCDEFGH');
  });

  test('uppercases lowercase names from the lump (case-insensitive lookup)', () => {
    const parsed = parseTextureTwoWhenPresent(lowercaseNameLump)!;
    expect(parsed.textures[0]!.name).toBe('MIXED');
  });

  test('preserves negative mappatch origins (signed int16 reads)', () => {
    const parsed = parseTextureTwoWhenPresent(negativePatchOriginLump)!;
    const patch = parsed.textures[0]!.patches[0]!;
    expect(patch.originX).toBe(-55);
    expect(patch.originY).toBe(-9);
    expect(patch.patchIndex).toBe(7);
  });

  test('accepts a Uint8Array (non-Buffer) input', () => {
    const view = new Uint8Array(validTextureTwoLump);
    const parsed = parseTextureTwoWhenPresent(view)!;
    expect(parsed.count).toBe(3);
    expect(parsed.textures[0]!.name).toBe('EXTRA1');
  });

  test('does not propagate the obsolete column-directory pointer', () => {
    const buf = buildTextureTwoLumpBytes([{ name: 'OBSOLETE', width: 16, height: 16, patches: [{ originX: 0, originY: 0, patchIndex: 0 }] }]);
    buf.writeInt32LE(0x12345678, 8 + 16);
    const parsed = parseTextureTwoWhenPresent(buf)!;
    const keys = Object.keys(parsed.textures[0]!);
    expect(keys).not.toContain('obsolete');
  });

  test('does not propagate mappatch stepdir or colormap', () => {
    const buf = buildTextureTwoLumpBytes([{ name: 'STEPDIR', width: 16, height: 16, patches: [{ originX: 0, originY: 0, patchIndex: 0 }] }]);
    buf.writeInt16LE(0x1234, 30 + 6);
    buf.writeInt16LE(0x5678, 30 + 8);
    const parsed = parseTextureTwoWhenPresent(buf)!;
    const keys = Object.keys(parsed.textures[0]!.patches[0]!);
    expect(keys).not.toContain('stepdir');
    expect(keys).not.toContain('colormap');
  });

  test('decodes a multi-patch texture with the documented mappatch stride', () => {
    const buf = buildTextureTwoLumpBytes([
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
    const parsed = parseTextureTwoWhenPresent(buf)!;
    expect(parsed.textures[0]!.patchCount).toBe(3);
    expect(parsed.textures[0]!.patches.map((p) => p.patchIndex)).toEqual([1, 2, 3]);
    expect(parsed.textures[0]!.patches.map((p) => p.originX)).toEqual([0, 32, 64]);
  });

  test('decodes the same byte format as TEXTURE1 (parser delegation)', () => {
    const parsedAsTextureOne = parseTextureOneLump(validTextureTwoLump);
    expect(parsedAsTextureOne.count).toBe(parsedValidLump.count);
    for (let index = 0; index < parsedAsTextureOne.count; index += 1) {
      const oneEntry = parsedAsTextureOne.textures[index]!;
      const twoEntry = parsedValidLump.textures[index]!;
      expect(oneEntry.name).toBe(twoEntry.name);
      expect(oneEntry.width).toBe(twoEntry.width);
      expect(oneEntry.height).toBe(twoEntry.height);
      expect(oneEntry.patchCount).toBe(twoEntry.patchCount);
      expect(oneEntry.masked).toBe(twoEntry.masked);
      for (let patchSlot = 0; patchSlot < oneEntry.patchCount; patchSlot += 1) {
        expect(oneEntry.patches[patchSlot]!.originX).toBe(twoEntry.patches[patchSlot]!.originX);
        expect(oneEntry.patches[patchSlot]!.originY).toBe(twoEntry.patches[patchSlot]!.originY);
        expect(oneEntry.patches[patchSlot]!.patchIndex).toBe(twoEntry.patches[patchSlot]!.patchIndex);
      }
    }
  });
});

describe('combineNumTextures aggregation helper', () => {
  test('returns numtextures1 when textureTwo is null (else-branch reduction)', () => {
    expect(combineNumTextures(125, null)).toBe(125);
    expect(combineNumTextures(0, null)).toBe(0);
    expect(combineNumTextures(317, null)).toBe(317);
  });

  test('returns the sum when textureTwo is present', () => {
    expect(combineNumTextures(125, parsedValidLump)).toBe(125 + parsedValidLump.count);
    expect(combineNumTextures(0, parsedValidLump)).toBe(parsedValidLump.count);
    expect(combineNumTextures(317, parsedValidLump)).toBe(317 + parsedValidLump.count);
  });

  test('rejects a negative numtextures1 input', () => {
    expect(() => combineNumTextures(-1, null)).toThrow(RangeError);
    expect(() => combineNumTextures(-1, parsedValidLump)).toThrow(RangeError);
  });

  test('rejects a non-integer numtextures1 input', () => {
    expect(() => combineNumTextures(1.5, null)).toThrow(RangeError);
    expect(() => combineNumTextures(Number.NaN, null)).toThrow(RangeError);
  });

  test('rejects a textureTwo whose count is negative (defense-in-depth)', () => {
    const fakeTextureTwo = { count: -1, textures: Object.freeze([]) } as const;
    expect(() => combineNumTextures(0, fakeTextureTwo)).toThrow(RangeError);
  });
});

describe('crossCheckTextureTwoLumpRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckTextureTwoLumpRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckTextureTwoLumpRuntime failure modes', () => {
  test('detects a tampered TEXTURE_TWO_HEADER_BYTES that no longer equals TEXTURE_ONE', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureTwoHeaderBytes: 8 };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_TWO_HEADER_BYTES_EQUALS_TEXTURE_ONE');
    expect(failures).toContain('audit:texture-two-header-count-int32-le-when-present:not-observed');
  });

  test('detects a tampered TEXTURE_TWO_DIRECTORY_ENTRY_BYTES that no longer equals TEXTURE_ONE', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureTwoDirectoryEntryBytes: 8 };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_TWO_DIRECTORY_ENTRY_BYTES_EQUALS_TEXTURE_ONE');
    expect(failures).toContain('audit:texture-two-directory-entry-bytes-equivalent-to-texture-one:not-observed');
  });

  test('detects a tampered TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES that no longer equals TEXTURE_ONE', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureTwoMaptextureHeaderBytes: 24 };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_TWO_MAPTEXTURE_HEADER_BYTES_EQUALS_TEXTURE_ONE');
    expect(failures).toContain('audit:texture-two-maptexture-header-bytes-equivalent-to-texture-one:not-observed');
  });

  test('detects a tampered TEXTURE_TWO_NAME_BYTES that no longer equals TEXTURE_ONE', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureTwoNameBytes: 9 };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_TWO_NAME_BYTES_EQUALS_TEXTURE_ONE');
    expect(failures).toContain('audit:texture-two-name-bytes-equivalent-to-texture-one:not-observed');
  });

  test('detects a tampered TEXTURE_TWO_MAPPATCH_BYTES that no longer equals TEXTURE_ONE', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, textureTwoMappatchBytes: 12 };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:TEXTURE_TWO_MAPPATCH_BYTES_EQUALS_TEXTURE_ONE');
    expect(failures).toContain('audit:texture-two-mappatch-bytes-equivalent-to-texture-one:not-observed');
  });

  test('detects a parser that fails to return null for null input (else-branch broken)', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsNullForNullInput: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_NULL_FOR_NULL_INPUT');
    expect(failures).toContain('audit:texture-two-else-branch-zeroes-maptex2-and-numtextures2-and-maxoff2:not-observed');
    expect(failures).toContain('audit:texture-two-optional-via-w-checknumforname-probe:not-observed');
  });

  test('detects a parser that fails to return null for undefined input', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsNullForUndefinedInput: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_NULL_FOR_UNDEFINED_INPUT');
  });

  test('detects a parser that fails to freeze the returned lump', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFullyFrozenForValidInput: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_RETURNS_FROZEN_LUMP_FOR_VALID_INPUT');
    expect(failures).toContain('audit:texture-two-cache-by-name-via-w-cachelumpname:not-observed');
  });

  test('detects a parser whose textures.length does not equal count', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, texturesLengthEqualsCount: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_TEXTURES_LENGTH_EQUALS_COUNT');
    expect(failures).toContain('audit:texture-two-header-count-int32-le-when-present:not-observed');
  });

  test('detects a parser that leaves names lowercased or NUL-padded', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, namesAreUppercaseAndTrimmed: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_NAMES_ARE_UPPERCASE_AND_TRIMMED');
    expect(failures).toContain('audit:texture-two-name-bytes-equivalent-to-texture-one:not-observed');
  });

  test('detects a parser that silently accepts a buffer too small for the header', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForHeader: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  });

  test('detects a parser that silently accepts a negative count', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsNegativeCount: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_NEGATIVE_COUNT');
  });

  test('detects a parser that silently accepts an offset past the lump end', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsOffsetPastLumpEnd: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_REJECTS_OFFSET_PAST_LUMP_END');
    expect(failures).toContain('audit:texture-two-bounds-check-against-maxoff-when-present:not-observed');
  });

  test('detects a parser that rejects the degenerate zero-count case', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserAcceptsZeroCount: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_TEXTURE_TWO_WHEN_PRESENT_ACCEPTS_ZERO_COUNT');
  });

  test('detects a broken sum-aggregation helper', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, combineReturnsSumForPresentLump: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:COMBINE_NUMTEXTURES_RETURNS_SUM_FOR_PRESENT_LUMP');
    expect(failures).toContain('audit:texture-two-numtextures-aggregation:not-observed');
    expect(failures).toContain('audit:texture-two-runtime-index-continuation-after-numtextures1:not-observed');
  });

  test('detects a broken null-aggregation helper', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, combineReturnsCount1ForNullLump: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:COMBINE_NUMTEXTURES_RETURNS_COUNT1_FOR_NULL_LUMP');
    expect(failures).toContain('audit:texture-two-shareware-doom1-wad-numtextures-equals-numtextures1:not-observed');
  });

  test('detects an aggregation helper that silently accepts a negative input', () => {
    const tampered: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, combineRejectsNegativeInput: false };
    const failures = crossCheckTextureTwoLumpRuntime(tampered);
    expect(failures).toContain('derived:COMBINE_NUMTEXTURES_REJECTS_NEGATIVE_INPUT');
  });

  test('reports an empty failure list for a freshly built equivalent snapshot', () => {
    const cloned: TextureTwoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckTextureTwoLumpRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD TEXTURE2 oracle', () => {
  test('declares the no-TEXTURE2 contract for shareware', () => {
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.hasTexture2).toBe(false);
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.combinedNumTextures).toBe(125);
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.numTextures1).toBe(125);
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.numTextures2).toBe(0);
    expect(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.textureDefinitionLumpCount).toBe(1);
  });

  test('the live IWAD has no TEXTURE2 lump in its directory', () => {
    expect(liveHasTexture2).toBe(false);
    expect(liveTextureTwoEntry).toBeUndefined();
  });

  test('the live IWAD numtextures1 matches the oracle (125)', () => {
    expect(liveTextureOneLump.count).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.numTextures1);
  });

  test('the combineNumTextures(125, null) value matches the oracle combinedNumTextures', () => {
    expect(combineNumTextures(125, null)).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.combinedNumTextures);
  });

  test('the live IWAD has exactly one texture-definition lump (TEXTURE1 only)', () => {
    expect(textureDefinitionLumpCount).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.textureDefinitionLumpCount);
  });

  test('crossCheckShareWareDoom1WadTextureTwoSample reports zero failures on the live oracle sample', () => {
    expect(crossCheckShareWareDoom1WadTextureTwoSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on texture-definition count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { 'texture-definition': number } };
    expect(manifest.lumpCategories['texture-definition']).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.textureDefinitionLumpCount);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe(SHAREWARE_DOOM1_WAD_TEXTURE_TWO_ORACLE.filename);
  });
});

describe('crossCheckShareWareDoom1WadTextureTwoSample failure modes', () => {
  test('detects a wrong hasTexture2 flag (e.g., a bundle that accidentally introduces TEXTURE2 in shareware)', () => {
    const tampered: ShareWareDoom1WadTextureTwoSample = { ...liveOracleSample, hasTexture2: true };
    expect(crossCheckShareWareDoom1WadTextureTwoSample(tampered)).toContain('oracle:hasTexture2:value-mismatch');
  });

  test('detects a wrong combinedNumTextures (aggregation drift)', () => {
    const tampered: ShareWareDoom1WadTextureTwoSample = { ...liveOracleSample, combinedNumTextures: 999 };
    expect(crossCheckShareWareDoom1WadTextureTwoSample(tampered)).toContain('oracle:combinedNumTextures:value-mismatch');
  });

  test('detects a wrong numTextures1', () => {
    const tampered: ShareWareDoom1WadTextureTwoSample = { ...liveOracleSample, numTextures1: 0 };
    expect(crossCheckShareWareDoom1WadTextureTwoSample(tampered)).toContain('oracle:numTextures1:value-mismatch');
  });

  test('detects a wrong numTextures2 (a lump that accidentally registers a non-zero TEXTURE2 count)', () => {
    const tampered: ShareWareDoom1WadTextureTwoSample = { ...liveOracleSample, numTextures2: 42 };
    expect(crossCheckShareWareDoom1WadTextureTwoSample(tampered)).toContain('oracle:numTextures2:value-mismatch');
  });

  test('detects a wrong textureDefinitionLumpCount', () => {
    const tampered: ShareWareDoom1WadTextureTwoSample = { ...liveOracleSample, textureDefinitionLumpCount: 2 };
    expect(crossCheckShareWareDoom1WadTextureTwoSample(tampered)).toContain('oracle:textureDefinitionLumpCount:value-mismatch');
  });

  test('reports an empty failure list for a freshly built equivalent sample', () => {
    const cloned: ShareWareDoom1WadTextureTwoSample = { ...liveOracleSample };
    expect(crossCheckShareWareDoom1WadTextureTwoSample(cloned)).toEqual([]);
  });
});

describe('parse-texture-two-when-present step file', () => {
  test('declares the wad lane and the parse-texture-two-when-present write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-010-parse-texture-two-when-present.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/parse-texture-two-when-present.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/parse-texture-two-when-present.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-010-parse-texture-two-when-present.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });
});
