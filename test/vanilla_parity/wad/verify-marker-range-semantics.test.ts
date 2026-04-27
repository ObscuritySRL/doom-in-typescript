import { describe, expect, test } from 'bun:test';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { resolveMarkerRange } from '../../../src/wad/markerRange.ts';
import {
  MARKER_RANGE_DERIVED_INVARIANTS,
  MARKER_RANGE_SEMANTIC_AUDIT,
  SHAREWARE_DOOM1_WAD_MARKER_ORACLE,
  buildSyntheticAdjacentMarkerDirectory,
  buildSyntheticDuplicateMarkerDirectory,
  crossCheckMarkerRangeSemantics,
  crossCheckShareWareDoom1WadMarkerSample,
} from '../../../src/assets/verify-marker-range-semantics.ts';
import type { MarkerRangeSemanticAuditEntry, MarkerRangeSnapshot, ShareWareDoom1WadMarkerSample } from '../../../src/assets/verify-marker-range-semantics.ts';

const ALLOWED_AXIS_IDS = new Set<MarkerRangeSemanticAuditEntry['id']>([
  'inclusive-count-formula',
  'first-content-index-is-start-plus-one',
  'last-content-index-is-end-minus-one',
  'inner-markers-are-counted-as-content',
  'last-marker-wins-on-duplicate-names',
  'case-insensitive-marker-name-lookup',
  'end-must-strictly-follow-start',
  'missing-marker-throws-w-get-num-for-name',
]);
const ALLOWED_SOURCES = new Set<MarkerRangeSemanticAuditEntry['source']>(['R_InitFlats', 'R_InitSpriteLumps', 'W_CheckNumForName', 'W_GetNumForName', 'resolveMarkerRange']);
const ALLOWED_REFERENCE_FILES = new Set<MarkerRangeSemanticAuditEntry['referenceSourceFile']>(['src/r_data.c', 'src/w_wad.c', 'src/wad/markerRange.ts']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const liveSpriteRange = resolveMarkerRange(liveDirectory, 'S_START', 'S_END');
const liveOuterFlatRange = resolveMarkerRange(liveDirectory, 'F_START', 'F_END');
const liveInnerFlatRange = resolveMarkerRange(liveDirectory, 'F1_START', 'F1_END');
const liveOuterPatchRange = resolveMarkerRange(liveDirectory, 'P_START', 'P_END');
const liveInnerPatchRange = resolveMarkerRange(liveDirectory, 'P1_START', 'P1_END');

const syntheticDuplicate = buildSyntheticDuplicateMarkerDirectory();
const syntheticAdjacent = buildSyntheticAdjacentMarkerDirectory();
const syntheticDuplicateRange = resolveMarkerRange(syntheticDuplicate, 'X_START', 'X_END');
const syntheticAdjacentRange = resolveMarkerRange(syntheticAdjacent, 'Y_START', 'Y_END');
const syntheticCaseInsensitiveRange = resolveMarkerRange(liveDirectory, 's_start', 'S_End');

function tryThrows(thunk: () => unknown, pattern: RegExp): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof Error && pattern.test(err.message);
  }
}

const missingStartMarkerThrows = tryThrows(() => resolveMarkerRange(liveDirectory, 'NOTEXIST', 'S_END'), /W_GetNumForName: NOTEXIST not found/);
const missingEndMarkerThrows = tryThrows(() => resolveMarkerRange(liveDirectory, 'S_START', 'NOTEXIST'), /W_GetNumForName: NOTEXIST not found/);
const endBeforeStartThrows = tryThrows(() => resolveMarkerRange(liveDirectory, 'S_END', 'S_START'), /must come after/);

function buildLiveSnapshot(): MarkerRangeSnapshot {
  return {
    liveSpriteRange: { ...liveSpriteRange },
    liveOuterFlatRange: { ...liveOuterFlatRange },
    liveInnerFlatRange: { ...liveInnerFlatRange },
    syntheticDuplicateMarkers: { startMarkerIndex: syntheticDuplicateRange.startMarkerIndex, endMarkerIndex: syntheticDuplicateRange.endMarkerIndex, count: syntheticDuplicateRange.count },
    syntheticAdjacentMarkers: { ...syntheticAdjacentRange },
    syntheticCaseInsensitive: { startMarkerIndex: syntheticCaseInsensitiveRange.startMarkerIndex, endMarkerIndex: syntheticCaseInsensitiveRange.endMarkerIndex, count: syntheticCaseInsensitiveRange.count },
    missingStartMarkerThrows,
    missingEndMarkerThrows,
    endBeforeStartThrows,
  };
}

const liveSnapshot = Object.freeze(buildLiveSnapshot());

describe('marker range semantic audit ledger shape', () => {
  test('audits exactly eight behavioral axes', () => {
    expect(MARKER_RANGE_SEMANTIC_AUDIT.length).toBe(8);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of MARKER_RANGE_SEMANTIC_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = MARKER_RANGE_SEMANTIC_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed sources', () => {
    for (const entry of MARKER_RANGE_SEMANTIC_AUDIT) {
      expect(ALLOWED_SOURCES.has(entry.source)).toBe(true);
    }
  });

  test('every audit entry references one of the allowed reference files', () => {
    for (const entry of MARKER_RANGE_SEMANTIC_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim source line', () => {
    for (const entry of MARKER_RANGE_SEMANTIC_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant note', () => {
    for (const entry of MARKER_RANGE_SEMANTIC_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('every (id, source) pair is allowed', () => {
    const allowed = new Map<MarkerRangeSemanticAuditEntry['id'], MarkerRangeSemanticAuditEntry['source']>([
      ['inclusive-count-formula', 'R_InitFlats'],
      ['first-content-index-is-start-plus-one', 'R_InitFlats'],
      ['last-content-index-is-end-minus-one', 'R_InitFlats'],
      ['inner-markers-are-counted-as-content', 'R_InitSpriteLumps'],
      ['last-marker-wins-on-duplicate-names', 'W_CheckNumForName'],
      ['case-insensitive-marker-name-lookup', 'W_GetNumForName'],
      ['end-must-strictly-follow-start', 'resolveMarkerRange'],
      ['missing-marker-throws-w-get-num-for-name', 'W_GetNumForName'],
    ]);
    for (const entry of MARKER_RANGE_SEMANTIC_AUDIT) {
      expect(allowed.get(entry.id)).toBe(entry.source);
    }
  });

  test('the inclusive-count-formula axis cites the firstflat / lastflat / numflats lines verbatim', () => {
    const entry = MARKER_RANGE_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'inclusive-count-formula');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('firstflat = W_GetNumForName ("F_START") + 1;');
    expect(entry?.cSourceLines).toContain('lastflat = W_GetNumForName ("F_END") - 1;');
    expect(entry?.cSourceLines).toContain('numflats = lastflat - firstflat + 1;');
  });

  test('the first-content-index axis cites the firstflat = ... + 1 line verbatim', () => {
    const entry = MARKER_RANGE_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'first-content-index-is-start-plus-one');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('firstflat = W_GetNumForName ("F_START") + 1;');
  });

  test('the last-content-index axis cites the lastflat = ... - 1 line verbatim', () => {
    const entry = MARKER_RANGE_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'last-content-index-is-end-minus-one');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('lastflat = W_GetNumForName ("F_END") - 1;');
  });

  test('the inner-markers-are-counted-as-content axis cites the R_InitSpriteLumps formula verbatim', () => {
    const entry = MARKER_RANGE_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'inner-markers-are-counted-as-content');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('firstspritelump = W_GetNumForName ("S_START") + 1;');
    expect(entry?.cSourceLines).toContain('numspritelumps = lastspritelump - firstspritelump + 1;');
  });

  test('the last-marker-wins axis cites the backwards-scan comment verbatim', () => {
    const entry = MARKER_RANGE_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'last-marker-wins-on-duplicate-names');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('// scan backwards so patch lump files take precedence');
  });

  test('the case-insensitive axis cites the strupr line verbatim', () => {
    const entry = MARKER_RANGE_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'case-insensitive-marker-name-lookup');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('strupr (name8);');
  });

  test('the missing-marker axis cites the I_Error line verbatim', () => {
    const entry = MARKER_RANGE_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'missing-marker-throws-w-get-num-for-name');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('I_Error ("W_GetNumForName: %s not found!", name);');
  });

  test('the end-must-strictly-follow-start axis is the only one pinned to resolveMarkerRange', () => {
    const runtimeAxes = MARKER_RANGE_SEMANTIC_AUDIT.filter((entry) => entry.source === 'resolveMarkerRange');
    expect(runtimeAxes.length).toBe(1);
    expect(runtimeAxes[0]?.id).toBe('end-must-strictly-follow-start');
  });

  test('exactly three axes are pinned to R_InitFlats', () => {
    const flatsAxes = MARKER_RANGE_SEMANTIC_AUDIT.filter((entry) => entry.source === 'R_InitFlats');
    const ids = new Set(flatsAxes.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['inclusive-count-formula', 'first-content-index-is-start-plus-one', 'last-content-index-is-end-minus-one']));
  });

  test('exactly two axes are pinned to W_GetNumForName', () => {
    const wGetAxes = MARKER_RANGE_SEMANTIC_AUDIT.filter((entry) => entry.source === 'W_GetNumForName');
    const ids = new Set(wGetAxes.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['case-insensitive-marker-name-lookup', 'missing-marker-throws-w-get-num-for-name']));
  });
});

describe('marker range derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = MARKER_RANGE_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the eleven derived invariants the cross-check enforces', () => {
    const ids = new Set(MARKER_RANGE_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'COUNT_EQUALS_END_MINUS_START_MINUS_ONE',
        'FIRST_CONTENT_INDEX_EQUALS_START_PLUS_ONE',
        'LAST_CONTENT_INDEX_EQUALS_END_MINUS_ONE',
        'CONTENT_INDICES_FORM_A_CONTIGUOUS_SPAN',
        'EMPTY_RANGE_PRODUCES_ZERO_COUNT',
        'INNER_MARKERS_INSIDE_OUTER_RANGE_ARE_COUNTED',
        'LAST_MARKER_WINS_ON_DUPLICATE_NAMES',
        'CASE_INSENSITIVE_MARKER_LOOKUP',
        'END_BEFORE_START_IS_REJECTED',
        'MISSING_MARKER_IS_REJECTED',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of MARKER_RANGE_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('crossCheckMarkerRangeSemantics on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckMarkerRangeSemantics(liveSnapshot)).toEqual([]);
  });

  test('live sprite range matches the oracle (count 483, no inner markers)', () => {
    expect(liveSnapshot.liveSpriteRange.startMarkerIndex).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteStartIndex);
    expect(liveSnapshot.liveSpriteRange.endMarkerIndex).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteEndIndex);
    expect(liveSnapshot.liveSpriteRange.count).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteCount);
  });

  test('live outer flat range matches the oracle (count 56 includes F1_START/F1_END)', () => {
    expect(liveSnapshot.liveOuterFlatRange.startMarkerIndex).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatStartIndex);
    expect(liveSnapshot.liveOuterFlatRange.endMarkerIndex).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatEndIndex);
    expect(liveSnapshot.liveOuterFlatRange.count).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatCount);
  });

  test('live inner flat range matches the oracle (count 54, data flats only)', () => {
    expect(liveSnapshot.liveInnerFlatRange.startMarkerIndex).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatStartIndex);
    expect(liveSnapshot.liveInnerFlatRange.endMarkerIndex).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatEndIndex);
    expect(liveSnapshot.liveInnerFlatRange.count).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatCount);
  });

  test('outer flat count exceeds inner flat count by exactly two (the F1_START and F1_END inner markers)', () => {
    expect(liveSnapshot.liveOuterFlatRange.count - liveSnapshot.liveInnerFlatRange.count).toBe(2);
  });

  test('synthetic duplicate-marker directory yields the LAST X_START and X_END indices', () => {
    expect(liveSnapshot.syntheticDuplicateMarkers.startMarkerIndex).toBe(3);
    expect(liveSnapshot.syntheticDuplicateMarkers.endMarkerIndex).toBe(6);
    expect(liveSnapshot.syntheticDuplicateMarkers.count).toBe(2);
  });

  test('synthetic adjacent-marker directory yields count 0 with firstContentIndex one past lastContentIndex', () => {
    expect(liveSnapshot.syntheticAdjacentMarkers.count).toBe(0);
    expect(liveSnapshot.syntheticAdjacentMarkers.firstContentIndex).toBe(1);
    expect(liveSnapshot.syntheticAdjacentMarkers.lastContentIndex).toBe(0);
  });

  test('synthetic case-insensitive resolution matches the live sprite range exactly', () => {
    expect(liveSnapshot.syntheticCaseInsensitive.startMarkerIndex).toBe(liveSnapshot.liveSpriteRange.startMarkerIndex);
    expect(liveSnapshot.syntheticCaseInsensitive.endMarkerIndex).toBe(liveSnapshot.liveSpriteRange.endMarkerIndex);
    expect(liveSnapshot.syntheticCaseInsensitive.count).toBe(liveSnapshot.liveSpriteRange.count);
  });

  test('a missing start marker, a missing end marker, and a swapped pair all throw', () => {
    expect(liveSnapshot.missingStartMarkerThrows).toBe(true);
    expect(liveSnapshot.missingEndMarkerThrows).toBe(true);
    expect(liveSnapshot.endBeforeStartThrows).toBe(true);
  });
});

describe('crossCheckMarkerRangeSemantics failure modes', () => {
  test('detects a snapshot whose count formula is wrong', () => {
    const tampered: MarkerRangeSnapshot = { ...liveSnapshot, liveSpriteRange: { ...liveSnapshot.liveSpriteRange, count: liveSnapshot.liveSpriteRange.count + 1 } };
    const failures = crossCheckMarkerRangeSemantics(tampered);
    expect(failures).toContain('derived:COUNT_EQUALS_END_MINUS_START_MINUS_ONE');
    expect(failures).toContain('audit:inclusive-count-formula:not-observed');
  });

  test('detects a snapshot whose firstContentIndex omits the +1 offset', () => {
    const tampered: MarkerRangeSnapshot = { ...liveSnapshot, liveSpriteRange: { ...liveSnapshot.liveSpriteRange, firstContentIndex: liveSnapshot.liveSpriteRange.startMarkerIndex } };
    const failures = crossCheckMarkerRangeSemantics(tampered);
    expect(failures).toContain('derived:FIRST_CONTENT_INDEX_EQUALS_START_PLUS_ONE');
    expect(failures).toContain('audit:first-content-index-is-start-plus-one:not-observed');
  });

  test('detects a snapshot whose lastContentIndex omits the -1 offset', () => {
    const tampered: MarkerRangeSnapshot = { ...liveSnapshot, liveSpriteRange: { ...liveSnapshot.liveSpriteRange, lastContentIndex: liveSnapshot.liveSpriteRange.endMarkerIndex } };
    const failures = crossCheckMarkerRangeSemantics(tampered);
    expect(failures).toContain('derived:LAST_CONTENT_INDEX_EQUALS_END_MINUS_ONE');
    expect(failures).toContain('audit:last-content-index-is-end-minus-one:not-observed');
  });

  test('detects a snapshot whose adjacent-marker range did not collapse to count zero', () => {
    const tampered: MarkerRangeSnapshot = { ...liveSnapshot, syntheticAdjacentMarkers: { ...liveSnapshot.syntheticAdjacentMarkers, count: 1 } };
    const failures = crossCheckMarkerRangeSemantics(tampered);
    expect(failures).toContain('derived:EMPTY_RANGE_PRODUCES_ZERO_COUNT');
  });

  test('detects a snapshot whose outer flat count silently dropped the inner markers', () => {
    const tampered: MarkerRangeSnapshot = {
      ...liveSnapshot,
      liveOuterFlatRange: { ...liveSnapshot.liveOuterFlatRange, count: liveSnapshot.liveInnerFlatRange.count },
    };
    const failures = crossCheckMarkerRangeSemantics(tampered);
    expect(failures).toContain('derived:INNER_MARKERS_INSIDE_OUTER_RANGE_ARE_COUNTED');
    expect(failures).toContain('audit:inner-markers-are-counted-as-content:not-observed');
  });

  test('detects a snapshot whose duplicate-marker resolution picked the FIRST occurrence', () => {
    const tampered: MarkerRangeSnapshot = {
      ...liveSnapshot,
      syntheticDuplicateMarkers: { startMarkerIndex: 0, endMarkerIndex: 2, count: 1 },
    };
    const failures = crossCheckMarkerRangeSemantics(tampered);
    expect(failures).toContain('derived:LAST_MARKER_WINS_ON_DUPLICATE_NAMES');
    expect(failures).toContain('audit:last-marker-wins-on-duplicate-names:not-observed');
  });

  test('detects a snapshot whose mixed-case resolution disagreed with the canonical resolution', () => {
    const tampered: MarkerRangeSnapshot = {
      ...liveSnapshot,
      syntheticCaseInsensitive: { startMarkerIndex: -1, endMarkerIndex: -1, count: -1 },
    };
    const failures = crossCheckMarkerRangeSemantics(tampered);
    expect(failures).toContain('derived:CASE_INSENSITIVE_MARKER_LOOKUP');
    expect(failures).toContain('audit:case-insensitive-marker-name-lookup:not-observed');
  });

  test('detects a snapshot whose end-before-start did not throw', () => {
    const tampered: MarkerRangeSnapshot = { ...liveSnapshot, endBeforeStartThrows: false };
    const failures = crossCheckMarkerRangeSemantics(tampered);
    expect(failures).toContain('derived:END_BEFORE_START_IS_REJECTED');
    expect(failures).toContain('audit:end-must-strictly-follow-start:not-observed');
  });

  test('detects a snapshot whose missing-marker calls did not throw', () => {
    const tamperedStart: MarkerRangeSnapshot = { ...liveSnapshot, missingStartMarkerThrows: false };
    const tamperedEnd: MarkerRangeSnapshot = { ...liveSnapshot, missingEndMarkerThrows: false };
    expect(crossCheckMarkerRangeSemantics(tamperedStart)).toContain('derived:MISSING_MARKER_IS_REJECTED');
    expect(crossCheckMarkerRangeSemantics(tamperedStart)).toContain('audit:missing-marker-throws-w-get-num-for-name:not-observed');
    expect(crossCheckMarkerRangeSemantics(tamperedEnd)).toContain('derived:MISSING_MARKER_IS_REJECTED');
    expect(crossCheckMarkerRangeSemantics(tamperedEnd)).toContain('audit:missing-marker-throws-w-get-num-for-name:not-observed');
  });
});

describe('shareware DOOM1.WAD marker layout oracle', () => {
  test('the oracle filename matches PRIMARY_TARGET.wadFilename', () => {
    expect<string>(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.filename).toBe(PRIMARY_TARGET.wadFilename);
  });

  test('every oracle index falls within the live directory bounds', () => {
    const indices = [
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteEndIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatEndIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatEndIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchEndIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchEndIndex,
    ];
    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(liveDirectory.length);
    }
  });

  test('every oracle marker entry has size 0 (markers carry no data)', () => {
    const markerIndices = [
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteEndIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatEndIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatEndIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchEndIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchStartIndex,
      SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchEndIndex,
    ];
    for (const index of markerIndices) {
      expect(liveDirectory[index]!.size).toBe(0);
    }
  });

  test('the oracle marker entries name the expected markers in the live IWAD', () => {
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteStartIndex]!.name).toBe('S_START');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteEndIndex]!.name).toBe('S_END');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatStartIndex]!.name).toBe('F_START');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatEndIndex]!.name).toBe('F_END');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatStartIndex]!.name).toBe('F1_START');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatEndIndex]!.name).toBe('F1_END');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchStartIndex]!.name).toBe('P_START');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchEndIndex]!.name).toBe('P_END');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchStartIndex]!.name).toBe('P1_START');
    expect(liveDirectory[SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchEndIndex]!.name).toBe('P1_END');
  });

  test('every oracle range respects the inclusive count formula `count = end - start - 1`', () => {
    expect<number>(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteCount).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteEndIndex - SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteStartIndex - 1);
    expect<number>(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatCount).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatEndIndex - SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatStartIndex - 1);
    expect<number>(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatCount).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatEndIndex - SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatStartIndex - 1);
    expect<number>(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchCount).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchEndIndex - SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchStartIndex - 1);
    expect<number>(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchCount).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchEndIndex - SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchStartIndex - 1);
  });

  test('the oracle outer-flat count exceeds the inner-flat count by exactly two (F1_START + F1_END)', () => {
    expect(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatCount - SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatCount).toBe(2);
  });

  test('the oracle outer-patch count exceeds the inner-patch count by exactly two (P1_START + P1_END)', () => {
    expect(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchCount - SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchCount).toBe(2);
  });

  test('the live S_START..S_END range count exactly matches the oracle sprite count', () => {
    expect(liveSpriteRange.count).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.spriteCount);
  });

  test('the live F_START..F_END range count exactly matches the oracle outer-flat count', () => {
    expect(liveOuterFlatRange.count).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerFlatCount);
  });

  test('the live F1_START..F1_END range count exactly matches the oracle inner-flat count', () => {
    expect(liveInnerFlatRange.count).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatCount);
  });

  test('the live P_START..P_END range count exactly matches the oracle outer-patch count', () => {
    expect(liveOuterPatchRange.count).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.outerPatchCount);
  });

  test('the live P1_START..P1_END range count exactly matches the oracle inner-patch count', () => {
    expect(liveInnerPatchRange.count).toBe(SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchCount);
  });

  test('crossCheckShareWareDoom1WadMarkerSample reports zero failures for the live ranges', () => {
    const sample: ShareWareDoom1WadMarkerSample = {
      spriteStartIndex: liveSpriteRange.startMarkerIndex,
      spriteEndIndex: liveSpriteRange.endMarkerIndex,
      spriteCount: liveSpriteRange.count,
      outerFlatStartIndex: liveOuterFlatRange.startMarkerIndex,
      outerFlatEndIndex: liveOuterFlatRange.endMarkerIndex,
      outerFlatCount: liveOuterFlatRange.count,
      innerFlatStartIndex: liveInnerFlatRange.startMarkerIndex,
      innerFlatEndIndex: liveInnerFlatRange.endMarkerIndex,
      innerFlatCount: liveInnerFlatRange.count,
      outerPatchStartIndex: liveOuterPatchRange.startMarkerIndex,
      outerPatchEndIndex: liveOuterPatchRange.endMarkerIndex,
      outerPatchCount: liveOuterPatchRange.count,
      innerPatchStartIndex: liveInnerPatchRange.startMarkerIndex,
      innerPatchEndIndex: liveInnerPatchRange.endMarkerIndex,
      innerPatchCount: liveInnerPatchRange.count,
    };
    expect(crossCheckShareWareDoom1WadMarkerSample(sample)).toEqual([]);
  });
});

describe('crossCheckShareWareDoom1WadMarkerSample failure modes', () => {
  function liveSample(): ShareWareDoom1WadMarkerSample {
    return {
      spriteStartIndex: liveSpriteRange.startMarkerIndex,
      spriteEndIndex: liveSpriteRange.endMarkerIndex,
      spriteCount: liveSpriteRange.count,
      outerFlatStartIndex: liveOuterFlatRange.startMarkerIndex,
      outerFlatEndIndex: liveOuterFlatRange.endMarkerIndex,
      outerFlatCount: liveOuterFlatRange.count,
      innerFlatStartIndex: liveInnerFlatRange.startMarkerIndex,
      innerFlatEndIndex: liveInnerFlatRange.endMarkerIndex,
      innerFlatCount: liveInnerFlatRange.count,
      outerPatchStartIndex: liveOuterPatchRange.startMarkerIndex,
      outerPatchEndIndex: liveOuterPatchRange.endMarkerIndex,
      outerPatchCount: liveOuterPatchRange.count,
      innerPatchStartIndex: liveInnerPatchRange.startMarkerIndex,
      innerPatchEndIndex: liveInnerPatchRange.endMarkerIndex,
      innerPatchCount: liveInnerPatchRange.count,
    };
  }

  test('detects a wrong sprite count', () => {
    const tampered: ShareWareDoom1WadMarkerSample = { ...liveSample(), spriteCount: 1 };
    expect(crossCheckShareWareDoom1WadMarkerSample(tampered)).toContain('oracle:spriteCount:value-mismatch');
  });

  test('detects a wrong outer flat start index', () => {
    const tampered: ShareWareDoom1WadMarkerSample = { ...liveSample(), outerFlatStartIndex: 0 };
    expect(crossCheckShareWareDoom1WadMarkerSample(tampered)).toContain('oracle:outerFlatStartIndex:value-mismatch');
  });

  test('detects a wrong inner flat count', () => {
    const tampered: ShareWareDoom1WadMarkerSample = { ...liveSample(), innerFlatCount: 0 };
    expect(crossCheckShareWareDoom1WadMarkerSample(tampered)).toContain('oracle:innerFlatCount:value-mismatch');
  });

  test('detects a wrong outer patch end index', () => {
    const tampered: ShareWareDoom1WadMarkerSample = { ...liveSample(), outerPatchEndIndex: 9999 };
    expect(crossCheckShareWareDoom1WadMarkerSample(tampered)).toContain('oracle:outerPatchEndIndex:value-mismatch');
  });

  test('detects a wrong inner patch count', () => {
    const tampered: ShareWareDoom1WadMarkerSample = { ...liveSample(), innerPatchCount: 0 };
    expect(crossCheckShareWareDoom1WadMarkerSample(tampered)).toContain('oracle:innerPatchCount:value-mismatch');
  });
});

describe('resolveMarkerRange runtime parity with R_InitFlats / R_InitSpriteLumps formula', () => {
  test('every live range satisfies firstContentIndex === startMarkerIndex + 1', () => {
    for (const range of [liveSpriteRange, liveOuterFlatRange, liveInnerFlatRange, liveOuterPatchRange, liveInnerPatchRange]) {
      expect(range.firstContentIndex).toBe(range.startMarkerIndex + 1);
    }
  });

  test('every live range satisfies lastContentIndex === endMarkerIndex - 1', () => {
    for (const range of [liveSpriteRange, liveOuterFlatRange, liveInnerFlatRange, liveOuterPatchRange, liveInnerPatchRange]) {
      expect(range.lastContentIndex).toBe(range.endMarkerIndex - 1);
    }
  });

  test('every live range satisfies count === endMarkerIndex - startMarkerIndex - 1', () => {
    for (const range of [liveSpriteRange, liveOuterFlatRange, liveInnerFlatRange, liveOuterPatchRange, liveInnerPatchRange]) {
      expect(range.count).toBe(range.endMarkerIndex - range.startMarkerIndex - 1);
    }
  });

  test('every live range satisfies the inclusive contiguous span identity', () => {
    for (const range of [liveSpriteRange, liveOuterFlatRange, liveInnerFlatRange, liveOuterPatchRange, liveInnerPatchRange]) {
      expect(range.lastContentIndex - range.firstContentIndex + 1).toBe(range.count);
    }
  });

  test('the live outer flat range encloses the inner flat range markers as content slots', () => {
    const innerStartIndex = SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatStartIndex;
    const innerEndIndex = SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerFlatEndIndex;
    expect(innerStartIndex).toBeGreaterThanOrEqual(liveOuterFlatRange.firstContentIndex);
    expect(innerStartIndex).toBeLessThanOrEqual(liveOuterFlatRange.lastContentIndex);
    expect(innerEndIndex).toBeGreaterThanOrEqual(liveOuterFlatRange.firstContentIndex);
    expect(innerEndIndex).toBeLessThanOrEqual(liveOuterFlatRange.lastContentIndex);
  });

  test('the live outer patch range encloses the inner patch range markers as content slots', () => {
    const innerStartIndex = SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchStartIndex;
    const innerEndIndex = SHAREWARE_DOOM1_WAD_MARKER_ORACLE.innerPatchEndIndex;
    expect(innerStartIndex).toBeGreaterThanOrEqual(liveOuterPatchRange.firstContentIndex);
    expect(innerStartIndex).toBeLessThanOrEqual(liveOuterPatchRange.lastContentIndex);
    expect(innerEndIndex).toBeGreaterThanOrEqual(liveOuterPatchRange.firstContentIndex);
    expect(innerEndIndex).toBeLessThanOrEqual(liveOuterPatchRange.lastContentIndex);
  });

  test('synthetic duplicate-marker resolution picks indices 3 and 6 (the LAST occurrences)', () => {
    expect(syntheticDuplicateRange.startMarkerIndex).toBe(3);
    expect(syntheticDuplicateRange.endMarkerIndex).toBe(6);
    expect(syntheticDuplicateRange.count).toBe(2);
  });

  test('synthetic adjacent-marker resolution yields a frozen empty range', () => {
    expect(syntheticAdjacentRange.count).toBe(0);
    expect(syntheticAdjacentRange.firstContentIndex).toBe(1);
    expect(syntheticAdjacentRange.lastContentIndex).toBe(0);
    expect(Object.isFrozen(syntheticAdjacentRange)).toBe(true);
  });

  test('synthetic case-insensitive resolution matches the canonical S_START..S_END resolution', () => {
    expect(syntheticCaseInsensitiveRange).toEqual(liveSpriteRange);
  });

  test('every live range object is frozen', () => {
    for (const range of [liveSpriteRange, liveOuterFlatRange, liveInnerFlatRange, liveOuterPatchRange, liveInnerPatchRange]) {
      expect(Object.isFrozen(range)).toBe(true);
    }
  });
});

describe('verify-marker-range-semantics step file', () => {
  test('declares the wad lane and the verify write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-004-verify-marker-range-semantics.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/verify-marker-range-semantics.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/verify-marker-range-semantics.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-004-verify-marker-range-semantics.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });

  test('declares 00-018 as its prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-004-verify-marker-range-semantics.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
