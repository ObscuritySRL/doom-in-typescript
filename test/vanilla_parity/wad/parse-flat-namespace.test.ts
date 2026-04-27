import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import {
  FLAT_LUMP_BYTES,
  FLAT_NAMESPACE_AUDIT,
  FLAT_NAMESPACE_DERIVED_INVARIANTS,
  SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE,
  crossCheckFlatNamespaceRuntime,
  crossCheckShareWareDoom1WadFlatNamespaceSample,
  flatNumForName,
  parseFlatNamespace,
} from '../../../src/assets/parse-flat-namespace.ts';
import type { FlatNamespaceAuditEntry, FlatNamespaceRuntimeSnapshot, ShareWareDoom1WadFlatNamespaceSample } from '../../../src/assets/parse-flat-namespace.ts';

const ALLOWED_AXIS_IDS = new Set<FlatNamespaceAuditEntry['id']>([
  'flat-namespace-firstflat-formula',
  'flat-namespace-lastflat-formula',
  'flat-namespace-numflats-formula',
  'flat-namespace-flattranslation-size-numflats-plus-one',
  'flat-namespace-flattranslation-identity-init',
  'flat-namespace-flatnumforname-uses-w-checknumforname',
  'flat-namespace-flatnumforname-returns-i-minus-firstflat',
  'flat-namespace-flatnumforname-i-error-on-missing',
  'flat-namespace-flatnumforname-name-eight-bytes',
  'flat-namespace-r-initflats-runs-inside-r-initdata',
  'flat-namespace-flat-pixels-4096-bytes',
  'flat-namespace-inner-submarkers-counted-as-flats',
  'flat-namespace-shareware-doom1-fifty-six-flats',
  'flat-namespace-flat-cache-by-num',
]);
const ALLOWED_SUBJECTS = new Set<FlatNamespaceAuditEntry['subject']>(['R_InitFlats', 'R_FlatNumForName', 'R_InitData', 'flattranslation', 'flat-pixels', 'shareware-doom1.wad', 'parseFlatNamespace']);
const ALLOWED_REFERENCE_FILES = new Set<FlatNamespaceAuditEntry['referenceSourceFile']>(['src/doom/r_data.c', 'src/doom/w_wad.c', 'src/doom/p_setup.c']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);
const liveNamespace = parseFlatNamespace(liveDirectory);

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

const noFStartDirectory = buildSyntheticDirectory([{ name: 'PLAYPAL' }, { name: 'COLORMAP' }, { name: 'F_END' }]);
const noFEndDirectory = buildSyntheticDirectory([{ name: 'PLAYPAL' }, { name: 'F_START' }, { name: 'FLAT1', size: FLAT_LUMP_BYTES }]);
const endBeforeStartDirectory = buildSyntheticDirectory([{ name: 'F_END' }, { name: 'FLAT1', size: FLAT_LUMP_BYTES }, { name: 'F_START' }]);
const adjacentMarkerDirectory = buildSyntheticDirectory([{ name: 'PLAYPAL' }, { name: 'F_START' }, { name: 'F_END' }]);
const minimalNamespaceDirectory = buildSyntheticDirectory([
  { name: 'PLAYPAL' },
  { name: 'F_START' },
  { name: 'F1_START' },
  { name: 'FLAT_A', size: FLAT_LUMP_BYTES, offset: 1 },
  { name: 'FLAT_B', size: FLAT_LUMP_BYTES, offset: 1 + FLAT_LUMP_BYTES },
  { name: 'F1_END' },
  { name: 'F_END' },
]);

const adjacentNamespace = parseFlatNamespace(adjacentMarkerDirectory);
const minimalNamespace = parseFlatNamespace(minimalNamespaceDirectory);

const parserRejectsMissingFStart = tryThrows(() => parseFlatNamespace(noFStartDirectory), /F_START/);
const parserRejectsMissingFEnd = tryThrows(() => parseFlatNamespace(noFEndDirectory), /F_END/);
const parserRejectsEndBeforeStart = tryThrows(() => parseFlatNamespace(endBeforeStartDirectory), /F_END.*F_START/);

const flatNumForNameReturnsExpectedFlatNumber = (() => {
  const expectedFlatNumber = liveNamespace.entries.find((entry) => entry.name === 'FLOOR0_1')?.flatNumber ?? -999;
  return flatNumForName(liveNamespace, 'FLOOR0_1') === expectedFlatNumber;
})();
const flatNumForNameThrowsOnMissing = tryThrows(() => flatNumForName(liveNamespace, 'NO_SUCH_FLAT'), /NO_SUCH_/);

function buildLiveRuntimeSnapshot(): FlatNamespaceRuntimeSnapshot {
  return {
    flatLumpBytes: FLAT_LUMP_BYTES,
    numFlats: liveNamespace.numFlats,
    firstFlatIndex: liveNamespace.firstFlatIndex,
    lastFlatIndex: liveNamespace.lastFlatIndex,
    startMarkerIndex: liveNamespace.startMarkerIndex,
    endMarkerIndex: liveNamespace.endMarkerIndex,
    flatTranslationSlotCount: liveNamespace.flatTranslationSlotCount,
    parserReturnsFullyFrozen: Object.isFrozen(liveNamespace) && Object.isFrozen(liveNamespace.entries) && Object.isFrozen(liveNamespace.flatTranslationIdentity) && liveNamespace.entries.every((entry) => Object.isFrozen(entry)),
    flatTranslationIsIdentity: liveNamespace.flatTranslationIdentity.every((value, index) => value === index) && liveNamespace.flatTranslationIdentity.length === liveNamespace.numFlats,
    flatNumbersAreSequential: liveNamespace.entries.every((entry, index) => entry.flatNumber === index),
    directoryIndicesAreFirstFlatPlusFlatNumber: liveNamespace.entries.every((entry, index) => entry.directoryIndex === liveNamespace.firstFlatIndex + index),
    parserRejectsMissingFStart,
    parserRejectsMissingFEnd,
    parserRejectsEndBeforeStart,
    flatNumForNameReturnsExpectedFlatNumber,
    flatNumForNameThrowsOnMissing,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadFlatNamespaceSample {
  const innerStart = liveNamespace.entries.find((entry) => entry.name === 'F1_START')!;
  const innerEnd = liveNamespace.entries.find((entry) => entry.name === 'F1_END')!;
  const dataFlatCount = liveNamespace.entries.filter((entry) => !entry.isInnerMarker).length;
  const pinnedFlatNames: ReadonlyArray<'FLOOR0_1' | 'FLOOR4_8' | 'NUKAGE1' | 'F_SKY1'> = ['FLOOR0_1', 'FLOOR4_8', 'NUKAGE1', 'F_SKY1'];
  const pinnedFlats = pinnedFlatNames.map((name) => {
    const entry = liveNamespace.entries.find((candidate) => candidate.name === name);
    if (!entry) {
      throw new Error(`pinned flat ${name} not found in live namespace`);
    }
    const directoryEntry = liveDirectory[entry.directoryIndex]!;
    const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
    return {
      name: entry.name,
      directoryIndex: entry.directoryIndex,
      flatNumber: entry.flatNumber,
      fileOffset: directoryEntry.offset,
      size: directoryEntry.size,
      sha256: createHash('sha256').update(lump).digest('hex'),
    };
  });
  return {
    outerStartIndex: liveNamespace.startMarkerIndex,
    outerEndIndex: liveNamespace.endMarkerIndex,
    outerFlatCount: liveNamespace.numFlats,
    innerStartIndex: innerStart.directoryIndex,
    innerEndIndex: innerEnd.directoryIndex,
    dataFlatCount,
    pinnedFlats,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('flat namespace audit ledger shape', () => {
  test('audits exactly fourteen behavioral axes', () => {
    expect(FLAT_NAMESPACE_AUDIT.length).toBe(14);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of FLAT_NAMESPACE_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = FLAT_NAMESPACE_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of FLAT_NAMESPACE_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of FLAT_NAMESPACE_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of FLAT_NAMESPACE_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of FLAT_NAMESPACE_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('flat namespace derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = FLAT_NAMESPACE_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(FLAT_NAMESPACE_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'NUMFLATS_FORMULA_EQUALS_LAST_MINUS_FIRST_PLUS_ONE',
        'FIRST_FLAT_INDEX_EQUALS_START_MARKER_PLUS_ONE',
        'LAST_FLAT_INDEX_EQUALS_END_MARKER_MINUS_ONE',
        'FLATTRANSLATION_SLOT_COUNT_IS_NUMFLATS_PLUS_ONE',
        'FLATTRANSLATION_IDENTITY_FILLS_FIRST_NUMFLATS_SLOTS',
        'PARSE_FLAT_NAMESPACE_RETURNS_FROZEN_NAMESPACE_AND_ENTRIES',
        'PARSE_FLAT_NAMESPACE_ENTRIES_LENGTH_EQUALS_NUMFLATS',
        'PARSE_FLAT_NAMESPACE_FLAT_NUMBERS_ARE_SEQUENTIAL',
        'PARSE_FLAT_NAMESPACE_DIRECTORY_INDEX_EQUALS_FIRSTFLAT_PLUS_FLATNUMBER',
        'PARSE_FLAT_NAMESPACE_REJECTS_MISSING_F_START',
        'PARSE_FLAT_NAMESPACE_REJECTS_MISSING_F_END',
        'PARSE_FLAT_NAMESPACE_REJECTS_END_BEFORE_START',
        'FLAT_NUM_FOR_NAME_RETURNS_FLAT_NUMBER',
        'FLAT_NUM_FOR_NAME_THROWS_ON_UNKNOWN',
        'FLAT_LUMP_BYTES_EQUALS_4096',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of FLAT_NAMESPACE_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('FLAT_LUMP_BYTES is 4096 (64 * 64 raw 8-bit palette indices)', () => {
    expect(FLAT_LUMP_BYTES).toBe(4096);
    expect(FLAT_LUMP_BYTES).toBe(64 * 64);
  });
});

describe('parseFlatNamespace runtime contract', () => {
  test('returns a frozen outer object, frozen entries array, and frozen flatTranslationIdentity', () => {
    expect(Object.isFrozen(liveNamespace)).toBe(true);
    expect(Object.isFrozen(liveNamespace.entries)).toBe(true);
    expect(Object.isFrozen(liveNamespace.flatTranslationIdentity)).toBe(true);
  });

  test('every entry is itself frozen', () => {
    for (const entry of liveNamespace.entries) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  test('shareware DOOM1.WAD outer flat range matches the pinned oracle', () => {
    expect(liveNamespace.startMarkerIndex).toBe(1206);
    expect(liveNamespace.endMarkerIndex).toBe(1263);
    expect(liveNamespace.firstFlatIndex).toBe(1207);
    expect(liveNamespace.lastFlatIndex).toBe(1262);
    expect(liveNamespace.numFlats).toBe(56);
    expect(liveNamespace.flatTranslationSlotCount).toBe(57);
    expect(liveNamespace.entries.length).toBe(56);
  });

  test('flat numbers are sequential from 0 to numFlats-1', () => {
    for (let i = 0; i < liveNamespace.entries.length; i += 1) {
      expect(liveNamespace.entries[i]!.flatNumber).toBe(i);
    }
  });

  test('directoryIndex equals firstFlatIndex + flatNumber for every entry', () => {
    for (const entry of liveNamespace.entries) {
      expect(entry.directoryIndex).toBe(liveNamespace.firstFlatIndex + entry.flatNumber);
    }
  });

  test('flatTranslationIdentity is the identity map of length numFlats', () => {
    expect(liveNamespace.flatTranslationIdentity.length).toBe(liveNamespace.numFlats);
    for (let i = 0; i < liveNamespace.flatTranslationIdentity.length; i += 1) {
      expect(liveNamespace.flatTranslationIdentity[i]).toBe(i);
    }
  });

  test('flatTranslationSlotCount is exactly numFlats + 1', () => {
    expect(liveNamespace.flatTranslationSlotCount).toBe(liveNamespace.numFlats + 1);
  });

  test('inner sub-markers F1_START and F1_END are counted as flats with isInnerMarker=true', () => {
    const f1Start = liveNamespace.entries.find((entry) => entry.name === 'F1_START')!;
    const f1End = liveNamespace.entries.find((entry) => entry.name === 'F1_END')!;
    expect(f1Start).toBeDefined();
    expect(f1End).toBeDefined();
    expect(f1Start.isInnerMarker).toBe(true);
    expect(f1End.isInnerMarker).toBe(true);
    expect(f1Start.flatNumber).toBe(0);
    expect(f1End.flatNumber).toBe(55);
    expect(liveNamespace.entries[0]!.name).toBe('F1_START');
    expect(liveNamespace.entries[liveNamespace.entries.length - 1]!.name).toBe('F1_END');
  });

  test('every data flat (non-marker entry) ships at exactly FLAT_LUMP_BYTES (4096) bytes', () => {
    for (const entry of liveNamespace.entries) {
      if (entry.isInnerMarker) continue;
      const directoryEntry = liveDirectory[entry.directoryIndex]!;
      expect(directoryEntry.size).toBe(FLAT_LUMP_BYTES);
    }
  });

  test('inner sub-marker entries ship at zero bytes', () => {
    for (const entry of liveNamespace.entries) {
      if (!entry.isInnerMarker) continue;
      const directoryEntry = liveDirectory[entry.directoryIndex]!;
      expect(directoryEntry.size).toBe(0);
    }
  });

  test('rejects a directory missing F_START with an Error mentioning F_START', () => {
    expect(() => parseFlatNamespace(noFStartDirectory)).toThrow(/F_START/);
  });

  test('rejects a directory missing F_END with an Error mentioning F_END', () => {
    expect(() => parseFlatNamespace(noFEndDirectory)).toThrow(/F_END/);
  });

  test('rejects a directory whose F_END precedes F_START with an Error', () => {
    expect(() => parseFlatNamespace(endBeforeStartDirectory)).toThrow(/F_END.*F_START/);
  });

  test('handles the adjacent-marker (zero-flat) edge case by returning numFlats === 0', () => {
    expect(adjacentNamespace.numFlats).toBe(0);
    expect(adjacentNamespace.entries.length).toBe(0);
    expect(adjacentNamespace.flatTranslationSlotCount).toBe(1);
    expect(adjacentNamespace.flatTranslationIdentity.length).toBe(0);
  });

  test('a synthetic minimal namespace exposes both inner markers and the two data flats', () => {
    expect(minimalNamespace.numFlats).toBe(4);
    expect(minimalNamespace.entries[0]!.name).toBe('F1_START');
    expect(minimalNamespace.entries[0]!.isInnerMarker).toBe(true);
    expect(minimalNamespace.entries[1]!.name).toBe('FLAT_A');
    expect(minimalNamespace.entries[1]!.isInnerMarker).toBe(false);
    expect(minimalNamespace.entries[1]!.flatNumber).toBe(1);
    expect(minimalNamespace.entries[2]!.name).toBe('FLAT_B');
    expect(minimalNamespace.entries[2]!.flatNumber).toBe(2);
    expect(minimalNamespace.entries[3]!.name).toBe('F1_END');
    expect(minimalNamespace.entries[3]!.isInnerMarker).toBe(true);
  });

  test('last-marker-wins on duplicate F_START / F_END names (vanilla W_GetNumForName scans backward)', () => {
    const duplicateDirectory = buildSyntheticDirectory([{ name: 'F_START' }, { name: 'STALEFLAT', size: FLAT_LUMP_BYTES }, { name: 'F_END' }, { name: 'F_START' }, { name: 'FRESHFLAT', size: FLAT_LUMP_BYTES }, { name: 'F_END' }]);
    const namespace = parseFlatNamespace(duplicateDirectory);
    expect(namespace.startMarkerIndex).toBe(3);
    expect(namespace.endMarkerIndex).toBe(5);
    expect(namespace.numFlats).toBe(1);
    expect(namespace.entries[0]!.name).toBe('FRESHFLAT');
  });
});

describe('flatNumForName runtime contract', () => {
  test('returns the zero-based flat number relative to firstflat for known data flats', () => {
    expect(flatNumForName(liveNamespace, 'FLOOR0_1')).toBe(1);
    expect(flatNumForName(liveNamespace, 'FLOOR4_8')).toBe(10);
    expect(flatNumForName(liveNamespace, 'NUKAGE1')).toBe(51);
    expect(flatNumForName(liveNamespace, 'F_SKY1')).toBe(54);
  });

  test('truncates the caller-supplied name to 8 bytes (vanilla namet[8] = 0; memcpy(namet, name, 8))', () => {
    expect(flatNumForName(liveNamespace, 'FLOOR0_1_EXTRA_SUFFIX')).toBe(1);
  });

  test('matches names case-insensitively', () => {
    expect(flatNumForName(liveNamespace, 'floor0_1')).toBe(1);
    expect(flatNumForName(liveNamespace, 'NuKaGe1')).toBe(51);
  });

  test('throws an Error mentioning the name when the flat is not found', () => {
    expect(() => flatNumForName(liveNamespace, 'NO_SUCH')).toThrow(/NO_SUCH/);
    expect(() => flatNumForName(liveNamespace, 'NO_SUCH')).toThrow(/not found/);
  });

  test('inner markers are looked up like any other flat via flatNumForName (vanilla R_FlatNumForName accepts them)', () => {
    expect(flatNumForName(liveNamespace, 'F1_START')).toBe(0);
    expect(flatNumForName(liveNamespace, 'F1_END')).toBe(55);
  });
});

describe('crossCheckFlatNamespaceRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckFlatNamespaceRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckFlatNamespaceRuntime failure modes', () => {
  test('detects a tampered numFlats that breaks the inclusive count formula', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, numFlats: liveRuntimeSnapshot.numFlats + 1 };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:NUMFLATS_FORMULA_EQUALS_LAST_MINUS_FIRST_PLUS_ONE');
    expect(failures).toContain('audit:flat-namespace-numflats-formula:not-observed');
  });

  test('detects a tampered firstFlatIndex that breaks the start+1 rule', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, firstFlatIndex: liveRuntimeSnapshot.startMarkerIndex };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:FIRST_FLAT_INDEX_EQUALS_START_MARKER_PLUS_ONE');
    expect(failures).toContain('audit:flat-namespace-firstflat-formula:not-observed');
  });

  test('detects a tampered lastFlatIndex that breaks the end-1 rule', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, lastFlatIndex: liveRuntimeSnapshot.endMarkerIndex };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:LAST_FLAT_INDEX_EQUALS_END_MARKER_MINUS_ONE');
    expect(failures).toContain('audit:flat-namespace-lastflat-formula:not-observed');
  });

  test('detects a tampered flatTranslationSlotCount that drops the trailing +1 slot', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, flatTranslationSlotCount: liveRuntimeSnapshot.numFlats };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:FLATTRANSLATION_SLOT_COUNT_IS_NUMFLATS_PLUS_ONE');
    expect(failures).toContain('audit:flat-namespace-flattranslation-size-numflats-plus-one:not-observed');
  });

  test('detects a parser whose flatTranslationIdentity is not the identity map', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, flatTranslationIsIdentity: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:FLATTRANSLATION_IDENTITY_FILLS_FIRST_NUMFLATS_SLOTS');
    expect(failures).toContain('audit:flat-namespace-flattranslation-identity-init:not-observed');
  });

  test('detects a parser that fails to freeze the returned namespace', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFullyFrozen: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_FLAT_NAMESPACE_RETURNS_FROZEN_NAMESPACE_AND_ENTRIES');
    expect(failures).toContain('audit:flat-namespace-flat-cache-by-num:not-observed');
  });

  test('detects a parser whose flat numbers are not sequential', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, flatNumbersAreSequential: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_FLAT_NAMESPACE_FLAT_NUMBERS_ARE_SEQUENTIAL');
    expect(failures).toContain('audit:flat-namespace-inner-submarkers-counted-as-flats:not-observed');
  });

  test('detects a parser whose directoryIndex does not equal firstFlatIndex + flatNumber', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, directoryIndicesAreFirstFlatPlusFlatNumber: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_FLAT_NAMESPACE_DIRECTORY_INDEX_EQUALS_FIRSTFLAT_PLUS_FLATNUMBER');
    expect(failures).toContain('audit:flat-namespace-flat-cache-by-num:not-observed');
  });

  test('detects a parser that silently accepts a directory missing F_START', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsMissingFStart: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_FLAT_NAMESPACE_REJECTS_MISSING_F_START');
  });

  test('detects a parser that silently accepts a directory missing F_END', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsMissingFEnd: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_FLAT_NAMESPACE_REJECTS_MISSING_F_END');
  });

  test('detects a parser that silently accepts F_END preceding F_START', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsEndBeforeStart: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:PARSE_FLAT_NAMESPACE_REJECTS_END_BEFORE_START');
  });

  test('detects a flatNumForName that returns the wrong flat number', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, flatNumForNameReturnsExpectedFlatNumber: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:FLAT_NUM_FOR_NAME_RETURNS_FLAT_NUMBER');
    expect(failures).toContain('audit:flat-namespace-flatnumforname-returns-i-minus-firstflat:not-observed');
    expect(failures).toContain('audit:flat-namespace-flatnumforname-uses-w-checknumforname:not-observed');
  });

  test('detects a flatNumForName that fails to throw on a missing flat', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, flatNumForNameThrowsOnMissing: false };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:FLAT_NUM_FOR_NAME_THROWS_ON_UNKNOWN');
    expect(failures).toContain('audit:flat-namespace-flatnumforname-i-error-on-missing:not-observed');
    expect(failures).toContain('audit:flat-namespace-flatnumforname-name-eight-bytes:not-observed');
  });

  test('detects a tampered FLAT_LUMP_BYTES that no longer equals 4096', () => {
    const tampered: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot, flatLumpBytes: 2048 };
    const failures = crossCheckFlatNamespaceRuntime(tampered);
    expect(failures).toContain('derived:FLAT_LUMP_BYTES_EQUALS_4096');
    expect(failures).toContain('audit:flat-namespace-flat-pixels-4096-bytes:not-observed');
  });

  test('reports an empty failure list for a freshly built equivalent snapshot', () => {
    const cloned: FlatNamespaceRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckFlatNamespaceRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD flat namespace oracle', () => {
  test('declares the four pinned flats: FLOOR0_1, FLOOR4_8, NUKAGE1, F_SKY1', () => {
    const names = SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.pinnedFlats.map((entry) => entry.name);
    expect(names).toEqual(['FLOOR0_1', 'FLOOR4_8', 'NUKAGE1', 'F_SKY1']);
  });

  test('every pinned flat sha256 matches the live IWAD bytes', () => {
    for (const oracleFlat of SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.pinnedFlats) {
      const directoryEntry = liveDirectory[oracleFlat.directoryIndex]!;
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      const sha256 = createHash('sha256').update(lump).digest('hex');
      expect(sha256).toBe(oracleFlat.sha256);
      expect(directoryEntry.name).toBe(oracleFlat.name);
      expect(directoryEntry.size).toBe(oracleFlat.size);
      expect(directoryEntry.offset).toBe(oracleFlat.fileOffset);
    }
  });

  test('outerStartIndex / outerEndIndex / outerFlatCount match the live IWAD', () => {
    expect(liveOracleSample.outerStartIndex).toBe(SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.outerStartIndex);
    expect(liveOracleSample.outerEndIndex).toBe(SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.outerEndIndex);
    expect(liveOracleSample.outerFlatCount).toBe(SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.outerFlatCount);
  });

  test('innerStartIndex / innerEndIndex / dataFlatCount match the live IWAD', () => {
    expect(liveOracleSample.innerStartIndex).toBe(SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.innerStartIndex);
    expect(liveOracleSample.innerEndIndex).toBe(SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.innerEndIndex);
    expect(liveOracleSample.dataFlatCount).toBe(SHAREWARE_DOOM1_WAD_FLAT_NAMESPACE_ORACLE.dataFlatCount);
  });

  test('every live flat sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckShareWareDoom1WadFlatNamespaceSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on flat count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { flat: number } };
    expect(manifest.lumpCategories.flat).toBe(56);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });
});

describe('crossCheckShareWareDoom1WadFlatNamespaceSample failure modes', () => {
  test('detects a wrong outerFlatCount', () => {
    const tampered: ShareWareDoom1WadFlatNamespaceSample = { ...liveOracleSample, outerFlatCount: 999 };
    expect(crossCheckShareWareDoom1WadFlatNamespaceSample(tampered)).toContain('oracle:outerFlatCount:value-mismatch');
  });

  test('detects a wrong innerStartIndex', () => {
    const tampered: ShareWareDoom1WadFlatNamespaceSample = { ...liveOracleSample, innerStartIndex: 42 };
    expect(crossCheckShareWareDoom1WadFlatNamespaceSample(tampered)).toContain('oracle:innerStartIndex:value-mismatch');
  });

  test('detects a wrong dataFlatCount', () => {
    const tampered: ShareWareDoom1WadFlatNamespaceSample = { ...liveOracleSample, dataFlatCount: 999 };
    expect(crossCheckShareWareDoom1WadFlatNamespaceSample(tampered)).toContain('oracle:dataFlatCount:value-mismatch');
  });

  test('detects a missing pinned flat', () => {
    const tampered: ShareWareDoom1WadFlatNamespaceSample = {
      ...liveOracleSample,
      pinnedFlats: liveOracleSample.pinnedFlats.filter((entry) => entry.name !== 'FLOOR0_1'),
    };
    expect(crossCheckShareWareDoom1WadFlatNamespaceSample(tampered)).toContain('oracle:flat:FLOOR0_1:not-found');
  });

  test('detects a wrong flatNumber on a pinned flat', () => {
    const tampered: ShareWareDoom1WadFlatNamespaceSample = {
      ...liveOracleSample,
      pinnedFlats: liveOracleSample.pinnedFlats.map((entry) => (entry.name === 'NUKAGE1' ? { ...entry, flatNumber: 99 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadFlatNamespaceSample(tampered)).toContain('oracle:flat:NUKAGE1:flatNumber:value-mismatch');
  });

  test('detects a wrong sha256 on a pinned flat', () => {
    const tampered: ShareWareDoom1WadFlatNamespaceSample = {
      ...liveOracleSample,
      pinnedFlats: liveOracleSample.pinnedFlats.map((entry) => (entry.name === 'F_SKY1' ? { ...entry, sha256: '0'.repeat(64) } : entry)),
    };
    expect(crossCheckShareWareDoom1WadFlatNamespaceSample(tampered)).toContain('oracle:flat:F_SKY1:sha256:value-mismatch');
  });

  test('reports an empty failure list for a freshly built equivalent sample', () => {
    const cloned: ShareWareDoom1WadFlatNamespaceSample = { ...liveOracleSample };
    expect(crossCheckShareWareDoom1WadFlatNamespaceSample(cloned)).toEqual([]);
  });
});

describe('parse-flat-namespace step file', () => {
  test('declares the wad lane and the parse-flat-namespace write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-007-parse-flat-namespace.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/parse-flat-namespace.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/parse-flat-namespace.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-007-parse-flat-namespace.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });
});
