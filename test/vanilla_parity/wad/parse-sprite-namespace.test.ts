import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import {
  SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE,
  SPRITE_FIXED_SHIFT,
  SPRITE_NAMESPACE_AUDIT,
  SPRITE_NAMESPACE_DERIVED_INVARIANTS,
  SPRITE_NAME_FRAME_LETTER_BASE_CHARCODE,
  SPRITE_NAME_FRAME_LETTER_OFFSET,
  SPRITE_NAME_ROTATION_DIGIT_BASE_CHARCODE,
  SPRITE_NAME_ROTATION_DIGIT_OFFSET,
  SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET,
  SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET,
  crossCheckShareWareDoom1WadSpriteNamespaceSample,
  crossCheckSpriteNamespaceRuntime,
  decodeSpriteFrameLetter,
  decodeSpriteRotationDigit,
  decodeSpriteSecondViewFrameLetter,
  decodeSpriteSecondViewRotationDigit,
  hasSpriteSecondView,
  parseSpriteNamespace,
  spriteNumForLumpIndex,
  spritePatchHeaderToFixed,
} from '../../../src/assets/parse-sprite-namespace.ts';
import type { ShareWareDoom1WadSpriteNamespaceSample, SpriteNamespaceAuditEntry, SpriteNamespaceRuntimeSnapshot } from '../../../src/assets/parse-sprite-namespace.ts';

const ALLOWED_AXIS_IDS = new Set<SpriteNamespaceAuditEntry['id']>([
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
]);
const ALLOWED_SUBJECTS = new Set<SpriteNamespaceAuditEntry['subject']>(['R_InitSpriteLumps', 'R_InstallSpriteLump', 'R_InitData', 'spritewidth', 'spriteoffset', 'spritetopoffset', 'parseSpriteNamespace', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<SpriteNamespaceAuditEntry['referenceSourceFile']>(['src/doom/r_data.c', 'src/doom/r_things.c', 'src/doom/w_wad.c']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);
const liveNamespace = parseSpriteNamespace(liveDirectory);

function tryThrows(thunk: () => unknown, pattern: RegExp): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof Error && pattern.test(err.message);
  }
}

function buildSyntheticDirectory(entries: ReadonlyArray<{ readonly name: string; readonly size?: number; readonly offset?: number }>): readonly DirectoryEntry[] {
  return entries.map((entry) => ({
    name: entry.name,
    size: entry.size ?? 0,
    offset: entry.offset ?? 0,
  }));
}

const noSStartDirectory = buildSyntheticDirectory([{ name: 'PLAYPAL' }, { name: 'COLORMAP' }, { name: 'S_END' }]);
const noSEndDirectory = buildSyntheticDirectory([{ name: 'PLAYPAL' }, { name: 'S_START' }, { name: 'TROOA1', size: 1632 }]);
const endBeforeStartDirectory = buildSyntheticDirectory([{ name: 'S_END' }, { name: 'TROOA1', size: 1632 }, { name: 'S_START' }]);
const adjacentMarkerDirectory = buildSyntheticDirectory([{ name: 'PLAYPAL' }, { name: 'S_START' }, { name: 'S_END' }]);
const minimalNamespaceDirectory = buildSyntheticDirectory([
  { name: 'PLAYPAL' },
  { name: 'S_START' },
  { name: 'TROOA1', size: 1632, offset: 1 },
  { name: 'TROOB1', size: 1700, offset: 1 + 1632 },
  { name: 'SARGB4B6', size: 2056, offset: 1 + 1632 + 1700 },
  { name: 'S_END' },
]);

const adjacentNamespace = parseSpriteNamespace(adjacentMarkerDirectory);
const minimalNamespace = parseSpriteNamespace(minimalNamespaceDirectory);

const parserRejectsMissingSStart = tryThrows(() => parseSpriteNamespace(noSStartDirectory), /S_START/);
const parserRejectsMissingSEnd = tryThrows(() => parseSpriteNamespace(noSEndDirectory), /S_END/);
const parserRejectsEndBeforeStart = tryThrows(() => parseSpriteNamespace(endBeforeStartDirectory), /S_END.*S_START/);

const spriteNumForLumpIndexReturnsExpectedSpriteNumber = (() => {
  const expectedSpriteNumber = 5;
  const directoryIndex = liveNamespace.firstSpriteIndex + expectedSpriteNumber;
  return spriteNumForLumpIndex(liveNamespace, directoryIndex) === expectedSpriteNumber;
})();
const spriteNumForLumpIndexThrowsOnOutOfRange = tryThrows(() => spriteNumForLumpIndex(liveNamespace, liveNamespace.lastSpriteIndex + 1), /outside the sprite namespace/);

const decodeSpriteFrameLetterReturnsNameOffsetFourMinusA = decodeSpriteFrameLetter('XXXXA0') === 0 && decodeSpriteFrameLetter('XXXXB0') === 1 && decodeSpriteFrameLetter('XXXXC0') === 2;
const decodeSpriteRotationDigitReturnsNameOffsetFiveMinusZero = decodeSpriteRotationDigit('XXXXA0') === 0 && decodeSpriteRotationDigit('XXXXA1') === 1 && decodeSpriteRotationDigit('XXXXA8') === 8;

const hasSpriteSecondViewReturnsTrueOnLengthEightAndNonNulOffsetSix = hasSpriteSecondView('SARGB4B6') === true && hasSpriteSecondView('TROOA1') === false && hasSpriteSecondView('TROOA1\0\0') === false;

function buildLiveRuntimeSnapshot(): SpriteNamespaceRuntimeSnapshot {
  return {
    spriteFixedShift: SPRITE_FIXED_SHIFT,
    numSpriteLumps: liveNamespace.numSpriteLumps,
    firstSpriteIndex: liveNamespace.firstSpriteIndex,
    lastSpriteIndex: liveNamespace.lastSpriteIndex,
    startMarkerIndex: liveNamespace.startMarkerIndex,
    endMarkerIndex: liveNamespace.endMarkerIndex,
    spriteTableSlotCount: liveNamespace.spriteTableSlotCount,
    parserReturnsFullyFrozen: Object.isFrozen(liveNamespace) && Object.isFrozen(liveNamespace.entries) && liveNamespace.entries.every((entry) => Object.isFrozen(entry)),
    spriteNumbersAreSequential: liveNamespace.entries.every((entry, index) => entry.spriteNumber === index),
    directoryIndicesAreFirstSpriteIndexPlusSpriteNumber: liveNamespace.entries.every((entry, index) => entry.directoryIndex === liveNamespace.firstSpriteIndex + index),
    parserRejectsMissingSStart,
    parserRejectsMissingSEnd,
    parserRejectsEndBeforeStart,
    spriteNumForLumpIndexReturnsExpectedSpriteNumber,
    spriteNumForLumpIndexThrowsOnOutOfRange,
    decodeSpriteFrameLetterReturnsNameOffsetFourMinusA,
    decodeSpriteRotationDigitReturnsNameOffsetFiveMinusZero,
    hasSpriteSecondViewReturnsTrueOnLengthEightAndNonNulOffsetSix,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function readPatchHeader(directoryIndex: number): { width: number; leftoffset: number; topoffset: number } {
  const directoryEntry = liveDirectory[directoryIndex]!;
  const offset = directoryEntry.offset;
  return {
    width: wadBuffer.readInt16LE(offset),
    leftoffset: wadBuffer.readInt16LE(offset + 4),
    topoffset: wadBuffer.readInt16LE(offset + 6),
  };
}

function buildLiveOracleSample(): ShareWareDoom1WadSpriteNamespaceSample {
  const pinnedSprites = SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.pinnedSprites.map((oracleEntry) => {
    const liveEntry = liveNamespace.entries.find((candidate) => candidate.name === oracleEntry.name);
    if (!liveEntry) {
      throw new Error(`pinned sprite ${oracleEntry.name} not found in live namespace`);
    }
    const directoryEntry = liveDirectory[liveEntry.directoryIndex]!;
    const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
    const header = readPatchHeader(liveEntry.directoryIndex);
    return {
      name: liveEntry.name,
      directoryIndex: liveEntry.directoryIndex,
      spriteNumber: liveEntry.spriteNumber,
      fileOffset: directoryEntry.offset,
      size: directoryEntry.size,
      sha256: createHash('sha256').update(lump).digest('hex'),
      patchWidth: header.width,
      patchLeftoffset: header.leftoffset,
      patchTopoffset: header.topoffset,
    };
  });
  return {
    startMarkerIndex: liveNamespace.startMarkerIndex,
    endMarkerIndex: liveNamespace.endMarkerIndex,
    firstSpriteIndex: liveNamespace.firstSpriteIndex,
    lastSpriteIndex: liveNamespace.lastSpriteIndex,
    numSpriteLumps: liveNamespace.numSpriteLumps,
    pinnedSprites,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('sprite namespace audit ledger shape', () => {
  test('audits exactly fifteen behavioral axes', () => {
    expect(SPRITE_NAMESPACE_AUDIT.length).toBe(15);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of SPRITE_NAMESPACE_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = SPRITE_NAMESPACE_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of SPRITE_NAMESPACE_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of SPRITE_NAMESPACE_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of SPRITE_NAMESPACE_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of SPRITE_NAMESPACE_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('sprite namespace derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = SPRITE_NAMESPACE_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(SPRITE_NAMESPACE_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'NUMSPRITELUMPS_FORMULA_EQUALS_LAST_MINUS_FIRST_PLUS_ONE',
        'FIRST_SPRITE_INDEX_EQUALS_START_MARKER_PLUS_ONE',
        'LAST_SPRITE_INDEX_EQUALS_END_MARKER_MINUS_ONE',
        'SPRITE_TABLE_SLOT_COUNT_IS_NUMSPRITELUMPS',
        'SPRITE_FIXED_SHIFT_EQUALS_FRACBITS',
        'PARSE_SPRITE_NAMESPACE_RETURNS_FROZEN_NAMESPACE_AND_ENTRIES',
        'PARSE_SPRITE_NAMESPACE_ENTRIES_LENGTH_EQUALS_NUMSPRITELUMPS',
        'PARSE_SPRITE_NAMESPACE_SPRITE_NUMBERS_ARE_SEQUENTIAL',
        'PARSE_SPRITE_NAMESPACE_DIRECTORY_INDEX_EQUALS_FIRSTSPRITELUMP_PLUS_SPRITENUMBER',
        'PARSE_SPRITE_NAMESPACE_REJECTS_MISSING_S_START',
        'PARSE_SPRITE_NAMESPACE_REJECTS_MISSING_S_END',
        'PARSE_SPRITE_NAMESPACE_REJECTS_END_BEFORE_START',
        'SPRITE_NUM_FOR_LUMP_INDEX_RETURNS_DIRECTORY_INDEX_MINUS_FIRSTSPRITELUMP',
        'SPRITE_NUM_FOR_LUMP_INDEX_THROWS_ON_OUT_OF_RANGE',
        'DECODE_SPRITE_FRAME_LETTER_RETURNS_NAME_OFFSET_FOUR_MINUS_A',
        'DECODE_SPRITE_ROTATION_DIGIT_RETURNS_NAME_OFFSET_FIVE_MINUS_ZERO',
        'HAS_SPRITE_SECOND_VIEW_REQUIRES_NAME_LENGTH_EIGHT_AND_NON_NUL_OFFSET_SIX',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of SPRITE_NAMESPACE_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('SPRITE_FIXED_SHIFT equals FRACBITS (16)', () => {
    expect(SPRITE_FIXED_SHIFT).toBe(FRACBITS);
    expect(SPRITE_FIXED_SHIFT).toBe(16);
  });

  test('SPRITE_NAME_FRAME_LETTER_OFFSET is 4 (matches name[4])', () => {
    expect(SPRITE_NAME_FRAME_LETTER_OFFSET).toBe(4);
  });

  test('SPRITE_NAME_ROTATION_DIGIT_OFFSET is 5 (matches name[5])', () => {
    expect(SPRITE_NAME_ROTATION_DIGIT_OFFSET).toBe(5);
  });

  test('SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET is 6 (matches name[6])', () => {
    expect(SPRITE_NAME_SECOND_VIEW_FRAME_OFFSET).toBe(6);
  });

  test('SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET is 7 (matches name[7])', () => {
    expect(SPRITE_NAME_SECOND_VIEW_ROTATION_OFFSET).toBe(7);
  });

  test("SPRITE_NAME_FRAME_LETTER_BASE_CHARCODE is 0x41 (matches 'A')", () => {
    expect(SPRITE_NAME_FRAME_LETTER_BASE_CHARCODE).toBe('A'.charCodeAt(0));
    expect(SPRITE_NAME_FRAME_LETTER_BASE_CHARCODE).toBe(0x41);
  });

  test("SPRITE_NAME_ROTATION_DIGIT_BASE_CHARCODE is 0x30 (matches '0')", () => {
    expect(SPRITE_NAME_ROTATION_DIGIT_BASE_CHARCODE).toBe('0'.charCodeAt(0));
    expect(SPRITE_NAME_ROTATION_DIGIT_BASE_CHARCODE).toBe(0x30);
  });
});

describe('parseSpriteNamespace runtime contract', () => {
  test('returns a frozen outer object and frozen entries array', () => {
    expect(Object.isFrozen(liveNamespace)).toBe(true);
    expect(Object.isFrozen(liveNamespace.entries)).toBe(true);
  });

  test('every entry is itself frozen', () => {
    for (const entry of liveNamespace.entries) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  test('shareware DOOM1.WAD sprite namespace bounds match the pinned oracle', () => {
    expect(liveNamespace.startMarkerIndex).toBe(552);
    expect(liveNamespace.endMarkerIndex).toBe(1036);
    expect(liveNamespace.firstSpriteIndex).toBe(553);
    expect(liveNamespace.lastSpriteIndex).toBe(1035);
    expect(liveNamespace.numSpriteLumps).toBe(483);
    expect(liveNamespace.spriteTableSlotCount).toBe(483);
    expect(liveNamespace.entries.length).toBe(483);
  });

  test('sprite numbers are sequential from 0 to numSpriteLumps-1', () => {
    for (let i = 0; i < liveNamespace.entries.length; i += 1) {
      expect(liveNamespace.entries[i]!.spriteNumber).toBe(i);
    }
  });

  test('directoryIndex equals firstSpriteIndex + spriteNumber for every entry', () => {
    for (const entry of liveNamespace.entries) {
      expect(entry.directoryIndex).toBe(liveNamespace.firstSpriteIndex + entry.spriteNumber);
    }
  });

  test('spriteTableSlotCount is exactly numSpriteLumps (no trailing +1 guard slot, unlike flattranslation)', () => {
    expect(liveNamespace.spriteTableSlotCount).toBe(liveNamespace.numSpriteLumps);
  });

  test('every sprite name has at least 6 characters (4-char prefix + frame + rotation)', () => {
    for (const entry of liveNamespace.entries) {
      expect(entry.name.length).toBeGreaterThanOrEqual(6);
    }
  });

  test('rejects a directory missing S_START with an Error mentioning S_START', () => {
    expect(() => parseSpriteNamespace(noSStartDirectory)).toThrow(/S_START/);
  });

  test('rejects a directory missing S_END with an Error mentioning S_END', () => {
    expect(() => parseSpriteNamespace(noSEndDirectory)).toThrow(/S_END/);
  });

  test('rejects a directory whose S_END precedes S_START with an Error', () => {
    expect(() => parseSpriteNamespace(endBeforeStartDirectory)).toThrow(/S_END.*S_START/);
  });

  test('handles the adjacent-marker (zero-sprite) edge case by returning numSpriteLumps === 0', () => {
    expect(adjacentNamespace.numSpriteLumps).toBe(0);
    expect(adjacentNamespace.entries.length).toBe(0);
    expect(adjacentNamespace.spriteTableSlotCount).toBe(0);
  });

  test('a synthetic minimal namespace exposes three sprite entries with sequential sprite numbers', () => {
    expect(minimalNamespace.numSpriteLumps).toBe(3);
    expect(minimalNamespace.entries[0]!.name).toBe('TROOA1');
    expect(minimalNamespace.entries[0]!.spriteNumber).toBe(0);
    expect(minimalNamespace.entries[1]!.name).toBe('TROOB1');
    expect(minimalNamespace.entries[1]!.spriteNumber).toBe(1);
    expect(minimalNamespace.entries[2]!.name).toBe('SARGB4B6');
    expect(minimalNamespace.entries[2]!.spriteNumber).toBe(2);
  });

  test('last-marker-wins on duplicate S_START / S_END names (vanilla W_GetNumForName scans backward)', () => {
    const duplicateDirectory = buildSyntheticDirectory([{ name: 'S_START' }, { name: 'STALEFRAMEA0', size: 1632 }, { name: 'S_END' }, { name: 'S_START' }, { name: 'FRESHA0', size: 1632 }, { name: 'S_END' }]);
    const namespace = parseSpriteNamespace(duplicateDirectory);
    expect(namespace.startMarkerIndex).toBe(3);
    expect(namespace.endMarkerIndex).toBe(5);
    expect(namespace.numSpriteLumps).toBe(1);
    expect(namespace.entries[0]!.name).toBe('FRESHA0');
  });
});

describe('spriteNumForLumpIndex runtime contract', () => {
  test('returns directoryIndex - firstSpriteIndex for known sprite lumps', () => {
    expect(spriteNumForLumpIndex(liveNamespace, 553)).toBe(0);
    expect(spriteNumForLumpIndex(liveNamespace, 553 + 100)).toBe(100);
    expect(spriteNumForLumpIndex(liveNamespace, 1035)).toBe(482);
  });

  test('throws RangeError when directoryIndex falls before the namespace', () => {
    expect(() => spriteNumForLumpIndex(liveNamespace, liveNamespace.firstSpriteIndex - 1)).toThrow(RangeError);
  });

  test('throws RangeError when directoryIndex falls after the namespace', () => {
    expect(() => spriteNumForLumpIndex(liveNamespace, liveNamespace.lastSpriteIndex + 1)).toThrow(RangeError);
  });

  test('matches the pinned oracle sprite numbers for named entries', () => {
    for (const oracle of SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.pinnedSprites) {
      expect(spriteNumForLumpIndex(liveNamespace, oracle.directoryIndex)).toBe(oracle.spriteNumber);
    }
  });
});

describe('decodeSpriteFrameLetter runtime contract', () => {
  test("decodes name[4] - 'A' for the 6-character form", () => {
    expect(decodeSpriteFrameLetter('TROOA1')).toBe(0);
    expect(decodeSpriteFrameLetter('TROOB1')).toBe(1);
    expect(decodeSpriteFrameLetter('TROOC1')).toBe(2);
  });

  test('handles an 8-character second-view sprite (returns the FIRST view frame index, matches vanilla)', () => {
    expect(decodeSpriteFrameLetter('SARGB4B6')).toBe(1);
  });

  test('throws RangeError when the name is shorter than 5 characters', () => {
    expect(() => decodeSpriteFrameLetter('TROO')).toThrow(RangeError);
  });
});

describe('decodeSpriteRotationDigit runtime contract', () => {
  test("decodes name[5] - '0' for the 6-character form", () => {
    expect(decodeSpriteRotationDigit('TROOA0')).toBe(0);
    expect(decodeSpriteRotationDigit('TROOA1')).toBe(1);
    expect(decodeSpriteRotationDigit('TROOA8')).toBe(8);
  });

  test('handles an 8-character second-view sprite (returns the FIRST view rotation, matches vanilla)', () => {
    expect(decodeSpriteRotationDigit('SARGB4B6')).toBe(4);
  });

  test('throws RangeError when the name is shorter than 6 characters', () => {
    expect(() => decodeSpriteRotationDigit('TROOA')).toThrow(RangeError);
  });
});

describe('hasSpriteSecondView / decode second-view runtime contract', () => {
  test('hasSpriteSecondView returns false for 6-character sprites', () => {
    expect(hasSpriteSecondView('TROOA1')).toBe(false);
    expect(hasSpriteSecondView('PLAYA1')).toBe(false);
  });

  test('hasSpriteSecondView returns true for 8-character second-view sprites', () => {
    expect(hasSpriteSecondView('SARGB4B6')).toBe(true);
  });

  test('hasSpriteSecondView returns false when name length < 8', () => {
    expect(hasSpriteSecondView('SHORT')).toBe(false);
  });

  test("decodeSpriteSecondViewFrameLetter decodes name[6] - 'A'", () => {
    expect(decodeSpriteSecondViewFrameLetter('SARGB4B6')).toBe(1);
    expect(decodeSpriteSecondViewFrameLetter('SARGB4C6')).toBe(2);
  });

  test("decodeSpriteSecondViewRotationDigit decodes name[7] - '0'", () => {
    expect(decodeSpriteSecondViewRotationDigit('SARGB4B6')).toBe(6);
    expect(decodeSpriteSecondViewRotationDigit('SARGB4B8')).toBe(8);
  });

  test('second-view decoders throw RangeError on too-short names', () => {
    expect(() => decodeSpriteSecondViewFrameLetter('SARGB4')).toThrow(RangeError);
    expect(() => decodeSpriteSecondViewRotationDigit('SARGB4B')).toThrow(RangeError);
  });
});

describe('spritePatchHeaderToFixed runtime contract', () => {
  test('shifts width / leftoffset / topoffset left by FRACBITS (16)', () => {
    const fixed = spritePatchHeaderToFixed({ width: 41, height: 57, leftoffset: 19, topoffset: 52 });
    expect(fixed.spriteWidth).toBe(41 << 16);
    expect(fixed.spriteOffset).toBe(19 << 16);
    expect(fixed.spriteTopoffset).toBe(52 << 16);
  });

  test('preserves negative leftoffset and topoffset (CHGGA0 has -104 / -117)', () => {
    const fixed = spritePatchHeaderToFixed({ width: 114, height: 83, leftoffset: -104, topoffset: -117 });
    expect(fixed.spriteWidth).toBe(114 << 16);
    expect(fixed.spriteOffset).toBe(-104 << 16);
    expect(fixed.spriteTopoffset).toBe(-117 << 16);
  });

  test('returns a frozen object', () => {
    const fixed = spritePatchHeaderToFixed({ width: 1, height: 1, leftoffset: 0, topoffset: 0 });
    expect(Object.isFrozen(fixed)).toBe(true);
  });
});

describe('crossCheckSpriteNamespaceRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckSpriteNamespaceRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckSpriteNamespaceRuntime failure modes', () => {
  test('detects a tampered numSpriteLumps that breaks the inclusive count formula', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, numSpriteLumps: liveRuntimeSnapshot.numSpriteLumps + 1 };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:NUMSPRITELUMPS_FORMULA_EQUALS_LAST_MINUS_FIRST_PLUS_ONE');
    expect(failures).toContain('audit:sprite-namespace-numspritelumps-formula:not-observed');
  });

  test('detects a tampered firstSpriteIndex that breaks the start+1 rule', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, firstSpriteIndex: liveRuntimeSnapshot.startMarkerIndex };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:FIRST_SPRITE_INDEX_EQUALS_START_MARKER_PLUS_ONE');
    expect(failures).toContain('audit:sprite-namespace-firstspritelump-formula:not-observed');
  });

  test('detects a tampered lastSpriteIndex that breaks the end-1 rule', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, lastSpriteIndex: liveRuntimeSnapshot.endMarkerIndex };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:LAST_SPRITE_INDEX_EQUALS_END_MARKER_MINUS_ONE');
    expect(failures).toContain('audit:sprite-namespace-lastspritelump-formula:not-observed');
  });

  test('detects a tampered spriteTableSlotCount that adds a trailing +1 guard slot', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, spriteTableSlotCount: liveRuntimeSnapshot.numSpriteLumps + 1 };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:SPRITE_TABLE_SLOT_COUNT_IS_NUMSPRITELUMPS');
    expect(failures).toContain('audit:sprite-namespace-spritewidth-allocation-numspritelumps:not-observed');
    expect(failures).toContain('audit:sprite-namespace-spriteoffset-allocation-numspritelumps:not-observed');
    expect(failures).toContain('audit:sprite-namespace-spritetopoffset-allocation-numspritelumps:not-observed');
  });

  test('detects a tampered SPRITE_FIXED_SHIFT that no longer equals FRACBITS', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, spriteFixedShift: 8 };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:SPRITE_FIXED_SHIFT_EQUALS_FRACBITS');
    expect(failures).toContain('audit:sprite-namespace-spritewidth-fixed-point-shift:not-observed');
    expect(failures).toContain('audit:sprite-namespace-spriteoffset-fixed-point-shift:not-observed');
    expect(failures).toContain('audit:sprite-namespace-spritetopoffset-fixed-point-shift:not-observed');
  });

  test('detects a parser that fails to freeze the returned namespace', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFullyFrozen: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SPRITE_NAMESPACE_RETURNS_FROZEN_NAMESPACE_AND_ENTRIES');
  });

  test('detects a parser whose sprite numbers are not sequential', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, spriteNumbersAreSequential: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SPRITE_NAMESPACE_SPRITE_NUMBERS_ARE_SEQUENTIAL');
    expect(failures).toContain('audit:sprite-namespace-installspritelump-returns-lump-minus-firstspritelump:not-observed');
  });

  test('detects a parser whose directoryIndex does not equal firstSpriteIndex + spriteNumber', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, directoryIndicesAreFirstSpriteIndexPlusSpriteNumber: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SPRITE_NAMESPACE_DIRECTORY_INDEX_EQUALS_FIRSTSPRITELUMP_PLUS_SPRITENUMBER');
  });

  test('detects a parser that silently accepts a directory missing S_START', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsMissingSStart: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SPRITE_NAMESPACE_REJECTS_MISSING_S_START');
  });

  test('detects a parser that silently accepts a directory missing S_END', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsMissingSEnd: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SPRITE_NAMESPACE_REJECTS_MISSING_S_END');
  });

  test('detects a parser that silently accepts S_END preceding S_START', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsEndBeforeStart: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_SPRITE_NAMESPACE_REJECTS_END_BEFORE_START');
  });

  test('detects a spriteNumForLumpIndex that returns the wrong sprite number', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, spriteNumForLumpIndexReturnsExpectedSpriteNumber: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:SPRITE_NUM_FOR_LUMP_INDEX_RETURNS_DIRECTORY_INDEX_MINUS_FIRSTSPRITELUMP');
    expect(failures).toContain('audit:sprite-namespace-installspritelump-returns-lump-minus-firstspritelump:not-observed');
  });

  test('detects a spriteNumForLumpIndex that fails to throw on out-of-range', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, spriteNumForLumpIndexThrowsOnOutOfRange: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:SPRITE_NUM_FOR_LUMP_INDEX_THROWS_ON_OUT_OF_RANGE');
  });

  test('detects a tampered decodeSpriteFrameLetter that no longer maps offset 4 to frame index', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, decodeSpriteFrameLetterReturnsNameOffsetFourMinusA: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:DECODE_SPRITE_FRAME_LETTER_RETURNS_NAME_OFFSET_FOUR_MINUS_A');
    expect(failures).toContain('audit:sprite-namespace-frame-letter-decoded-at-offset-four:not-observed');
  });

  test('detects a tampered decodeSpriteRotationDigit that no longer maps offset 5 to rotation index', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, decodeSpriteRotationDigitReturnsNameOffsetFiveMinusZero: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:DECODE_SPRITE_ROTATION_DIGIT_RETURNS_NAME_OFFSET_FIVE_MINUS_ZERO');
    expect(failures).toContain('audit:sprite-namespace-rotation-digit-decoded-at-offset-five:not-observed');
  });

  test('detects a tampered hasSpriteSecondView that misclassifies the offset-6 byte', () => {
    const tampered: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, hasSpriteSecondViewReturnsTrueOnLengthEightAndNonNulOffsetSix: false };
    const failures = crossCheckSpriteNamespaceRuntime(tampered);
    expect(failures).toContain('derived:HAS_SPRITE_SECOND_VIEW_REQUIRES_NAME_LENGTH_EIGHT_AND_NON_NUL_OFFSET_SIX');
    expect(failures).toContain('audit:sprite-namespace-second-view-decoded-at-offset-six-and-seven:not-observed');
  });

  test('reports an empty failure list for a freshly built equivalent snapshot', () => {
    const cloned: SpriteNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckSpriteNamespaceRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD sprite namespace oracle', () => {
  test('declares the six pinned sprites: CHGGA0, SARGB4B6, TROOA1, BOSSH4, PLAYA1, TREDD0', () => {
    const names = SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.pinnedSprites.map((entry) => entry.name);
    expect(names).toEqual(['CHGGA0', 'SARGB4B6', 'TROOA1', 'BOSSH4', 'PLAYA1', 'TREDD0']);
  });

  test('every pinned sprite sha256 matches the live IWAD bytes', () => {
    for (const oracleSprite of SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.pinnedSprites) {
      const directoryEntry = liveDirectory[oracleSprite.directoryIndex]!;
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      const sha256 = createHash('sha256').update(lump).digest('hex');
      expect(sha256).toBe(oracleSprite.sha256);
      expect(directoryEntry.name).toBe(oracleSprite.name);
      expect(directoryEntry.size).toBe(oracleSprite.size);
      expect(directoryEntry.offset).toBe(oracleSprite.fileOffset);
    }
  });

  test('every pinned sprite patch header matches the live IWAD raw int16-LE fields', () => {
    for (const oracleSprite of SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.pinnedSprites) {
      const header = readPatchHeader(oracleSprite.directoryIndex);
      expect(header.width).toBe(oracleSprite.patchWidth);
      expect(header.leftoffset).toBe(oracleSprite.patchLeftoffset);
      expect(header.topoffset).toBe(oracleSprite.patchTopoffset);
    }
  });

  test('startMarkerIndex / endMarkerIndex / numSpriteLumps match the live IWAD', () => {
    expect(liveOracleSample.startMarkerIndex).toBe(SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.startMarkerIndex);
    expect(liveOracleSample.endMarkerIndex).toBe(SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.endMarkerIndex);
    expect(liveOracleSample.numSpriteLumps).toBe(SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.numSpriteLumps);
  });

  test('every live sprite sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckShareWareDoom1WadSpriteNamespaceSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on sprite count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { sprite: number } };
    expect(manifest.lumpCategories.sprite).toBe(483);
    expect(manifest.lumpCategories.sprite).toBe(SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE.numSpriteLumps);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });
});

describe('crossCheckShareWareDoom1WadSpriteNamespaceSample failure modes', () => {
  test('detects a wrong numSpriteLumps', () => {
    const tampered: ShareWareDoom1WadSpriteNamespaceSample = { ...liveOracleSample, numSpriteLumps: 999 };
    expect(crossCheckShareWareDoom1WadSpriteNamespaceSample(tampered)).toContain('oracle:numSpriteLumps:value-mismatch');
  });

  test('detects a wrong startMarkerIndex', () => {
    const tampered: ShareWareDoom1WadSpriteNamespaceSample = { ...liveOracleSample, startMarkerIndex: 42 };
    expect(crossCheckShareWareDoom1WadSpriteNamespaceSample(tampered)).toContain('oracle:startMarkerIndex:value-mismatch');
  });

  test('detects a missing pinned sprite', () => {
    const tampered: ShareWareDoom1WadSpriteNamespaceSample = {
      ...liveOracleSample,
      pinnedSprites: liveOracleSample.pinnedSprites.filter((entry) => entry.name !== 'CHGGA0'),
    };
    expect(crossCheckShareWareDoom1WadSpriteNamespaceSample(tampered)).toContain('oracle:sprite:CHGGA0:not-found');
  });

  test('detects a wrong patchLeftoffset on a pinned sprite', () => {
    const tampered: ShareWareDoom1WadSpriteNamespaceSample = {
      ...liveOracleSample,
      pinnedSprites: liveOracleSample.pinnedSprites.map((entry) => (entry.name === 'CHGGA0' ? { ...entry, patchLeftoffset: 0 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadSpriteNamespaceSample(tampered)).toContain('oracle:sprite:CHGGA0:patchLeftoffset:value-mismatch');
  });

  test('detects a wrong sha256 on a pinned sprite', () => {
    const tampered: ShareWareDoom1WadSpriteNamespaceSample = {
      ...liveOracleSample,
      pinnedSprites: liveOracleSample.pinnedSprites.map((entry) => (entry.name === 'TREDD0' ? { ...entry, sha256: '0'.repeat(64) } : entry)),
    };
    expect(crossCheckShareWareDoom1WadSpriteNamespaceSample(tampered)).toContain('oracle:sprite:TREDD0:sha256:value-mismatch');
  });
});
