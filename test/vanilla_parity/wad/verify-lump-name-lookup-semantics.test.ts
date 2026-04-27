import { describe, expect, test } from 'bun:test';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { LumpLookup } from '../../../src/wad/lumpLookup.ts';
import {
  LUMP_LOOKUP_DERIVED_INVARIANTS,
  LUMP_LOOKUP_SEMANTIC_AUDIT,
  SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE,
  crossCheckLumpLookupSemantics,
  crossCheckShareWareDoom1WadLookupSample,
} from '../../../src/assets/verify-lump-name-lookup-semantics.ts';
import type { LumpLookupSemanticAuditEntry, LumpLookupSnapshot, ShareWareDoom1WadLookupSample } from '../../../src/assets/verify-lump-name-lookup-semantics.ts';

const ALLOWED_AXIS_IDS = new Set<LumpLookupSemanticAuditEntry['id']>(['case-insensitivity', 'last-match-wins', 'eight-byte-name-field', 'check-miss-returns-negative-one', 'get-throws-on-miss']);
const ALLOWED_C_FUNCTIONS = new Set<LumpLookupSemanticAuditEntry['cFunction']>(['W_CheckNumForName', 'W_GetNumForName']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);
const liveLookup = new LumpLookup(liveDirectory);

const SYNTHETIC_DUPLICATE_DIRECTORY = [
  { offset: 0, size: 100, name: 'FOO' },
  { offset: 200, size: 50, name: 'BAR' },
  { offset: 400, size: 75, name: 'FOO' },
] as const;
const syntheticLookup = new LumpLookup(SYNTHETIC_DUPLICATE_DIRECTORY);

function buildLiveSnapshot(): LumpLookupSnapshot {
  let getMissThrows = false;
  try {
    liveLookup.getNumForName('NOTEXIST');
  } catch (error) {
    if (error instanceof Error && error.message.includes('W_GetNumForName:') && error.message.includes('not found')) {
      getMissThrows = true;
    }
  }

  return {
    checkPlaypalUpper: liveLookup.checkNumForName('PLAYPAL'),
    checkPlaypalLower: liveLookup.checkNumForName('playpal'),
    checkPlaypalMixed: liveLookup.checkNumForName('PlAyPaL'),
    checkMiss: liveLookup.checkNumForName('NOTEXIST'),
    getPlaypal: liveLookup.getNumForName('PLAYPAL'),
    getMissThrows,
    lastMatchWinsResult: syntheticLookup.checkNumForName('FOO'),
    totalCount: liveLookup.totalCount,
    uniqueCount: liveLookup.uniqueCount,
  };
}

const liveSnapshot = Object.freeze(buildLiveSnapshot());

describe('lump lookup semantic audit ledger shape', () => {
  test('audits exactly five behavioral axes', () => {
    expect(LUMP_LOOKUP_SEMANTIC_AUDIT.length).toBe(5);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of LUMP_LOOKUP_SEMANTIC_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = LUMP_LOOKUP_SEMANTIC_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of W_CheckNumForName or W_GetNumForName', () => {
    for (const entry of LUMP_LOOKUP_SEMANTIC_AUDIT) {
      expect(ALLOWED_C_FUNCTIONS.has(entry.cFunction)).toBe(true);
    }
  });

  test('every audit entry references src/w_wad.c', () => {
    for (const entry of LUMP_LOOKUP_SEMANTIC_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/w_wad.c');
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of LUMP_LOOKUP_SEMANTIC_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant note', () => {
    for (const entry of LUMP_LOOKUP_SEMANTIC_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the get-throws-on-miss axis is the only one pinned to W_GetNumForName', () => {
    const wGetEntries = LUMP_LOOKUP_SEMANTIC_AUDIT.filter((entry) => entry.cFunction === 'W_GetNumForName');
    expect(wGetEntries.length).toBe(1);
    expect(wGetEntries[0]?.id).toBe('get-throws-on-miss');
  });

  test('the case-insensitivity axis cites strncpy and strupr verbatim', () => {
    const entry = LUMP_LOOKUP_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'case-insensitivity');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('strncpy (name8,name,8);');
    expect(entry?.cSourceLines).toContain('strupr (name8);');
  });

  test('the last-match-wins axis cites the backwards-scan comment verbatim', () => {
    const entry = LUMP_LOOKUP_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'last-match-wins');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('// scan backwards so patch lump files take precedence');
  });

  test('the check-miss-returns-negative-one axis cites the return -1 line verbatim', () => {
    const entry = LUMP_LOOKUP_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'check-miss-returns-negative-one');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('return -1;');
  });

  test('the get-throws-on-miss axis cites I_Error with the W_GetNumForName message verbatim', () => {
    const entry = LUMP_LOOKUP_SEMANTIC_AUDIT.find((candidate) => candidate.id === 'get-throws-on-miss');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('I_Error ("W_GetNumForName: %s not found!", name);');
  });
});

describe('lump lookup derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = LUMP_LOOKUP_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the seven derived invariants the cross-check enforces', () => {
    const ids = new Set(LUMP_LOOKUP_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'CHECK_NUM_FOR_NAME_IS_CASE_INSENSITIVE',
        'CHECK_NUM_FOR_NAME_LAST_MATCH_WINS',
        'CHECK_NUM_FOR_NAME_RETURNS_NEGATIVE_ONE_ON_MISS',
        'GET_NUM_FOR_NAME_THROWS_ON_MISS',
        'CHECK_AND_GET_AGREE_ON_HITS',
        'UNIQUE_COUNT_NEVER_EXCEEDS_TOTAL_COUNT',
        'EIGHT_BYTE_NAME_FIELD',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of LUMP_LOOKUP_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('crossCheckLumpLookupSemantics on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckLumpLookupSemantics(liveSnapshot)).toEqual([]);
  });

  test('PLAYPAL upper/lower/mixed case all resolve to the same index', () => {
    expect(liveSnapshot.checkPlaypalUpper).toBe(liveSnapshot.checkPlaypalLower);
    expect(liveSnapshot.checkPlaypalUpper).toBe(liveSnapshot.checkPlaypalMixed);
    expect(liveSnapshot.checkPlaypalUpper).toBe(0);
  });

  test('a missing lump returns -1 from checkNumForName', () => {
    expect(liveSnapshot.checkMiss).toBe(-1);
  });

  test('checkNumForName and getNumForName agree on hits for PLAYPAL', () => {
    expect(liveSnapshot.checkPlaypalUpper).toBe(liveSnapshot.getPlaypal);
  });

  test('getNumForName throws an Error matching the W_GetNumForName message contract', () => {
    expect(liveSnapshot.getMissThrows).toBe(true);
  });

  test('the synthetic two-FOO directory resolves to index 2 (last-match-wins)', () => {
    expect(liveSnapshot.lastMatchWinsResult).toBe(2);
  });

  test('uniqueCount never exceeds totalCount', () => {
    expect(liveSnapshot.uniqueCount).toBeLessThanOrEqual(liveSnapshot.totalCount);
  });
});

describe('crossCheckLumpLookupSemantics failure modes', () => {
  test('detects a snapshot whose case-folded lookups disagree', () => {
    const tampered: LumpLookupSnapshot = { ...liveSnapshot, checkPlaypalLower: -1 };
    const failures = crossCheckLumpLookupSemantics(tampered);
    expect(failures).toContain('derived:CHECK_NUM_FOR_NAME_IS_CASE_INSENSITIVE');
    expect(failures).toContain('audit:case-insensitivity:not-observed');
  });

  test('detects a snapshot whose duplicate-name lookup did not pick the last index', () => {
    const tampered: LumpLookupSnapshot = { ...liveSnapshot, lastMatchWinsResult: 0 };
    const failures = crossCheckLumpLookupSemantics(tampered);
    expect(failures).toContain('derived:CHECK_NUM_FOR_NAME_LAST_MATCH_WINS');
    expect(failures).toContain('audit:last-match-wins:not-observed');
  });

  test('detects a snapshot whose miss did not return -1', () => {
    const tampered: LumpLookupSnapshot = { ...liveSnapshot, checkMiss: 99 };
    const failures = crossCheckLumpLookupSemantics(tampered);
    expect(failures).toContain('derived:CHECK_NUM_FOR_NAME_RETURNS_NEGATIVE_ONE_ON_MISS');
    expect(failures).toContain('audit:check-miss-returns-negative-one:not-observed');
  });

  test('detects a snapshot whose getNumForName did not throw on miss', () => {
    const tampered: LumpLookupSnapshot = { ...liveSnapshot, getMissThrows: false };
    const failures = crossCheckLumpLookupSemantics(tampered);
    expect(failures).toContain('derived:GET_NUM_FOR_NAME_THROWS_ON_MISS');
    expect(failures).toContain('audit:get-throws-on-miss:not-observed');
  });

  test('detects a snapshot where check and get disagree on a hit', () => {
    const tampered: LumpLookupSnapshot = { ...liveSnapshot, getPlaypal: liveSnapshot.checkPlaypalUpper + 1 };
    const failures = crossCheckLumpLookupSemantics(tampered);
    expect(failures).toContain('derived:CHECK_AND_GET_AGREE_ON_HITS');
  });

  test('detects a snapshot whose uniqueCount exceeds totalCount', () => {
    const tampered: LumpLookupSnapshot = { ...liveSnapshot, uniqueCount: liveSnapshot.totalCount + 1 };
    const failures = crossCheckLumpLookupSemantics(tampered);
    expect(failures).toContain('derived:UNIQUE_COUNT_NEVER_EXCEEDS_TOTAL_COUNT');
  });
});

describe('shareware DOOM1.WAD lookup oracle', () => {
  test('the live LumpLookup totalCount matches PRIMARY_TARGET.wadLumpCount and the oracle', () => {
    expect(liveLookup.totalCount).toBe(PRIMARY_TARGET.wadLumpCount);
    expect(liveLookup.totalCount).toBe(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.totalCount);
  });

  test('PLAYPAL resolves to index 0', () => {
    expect(liveLookup.checkNumForName('PLAYPAL')).toBe(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.playpalIndex);
  });

  test('COLORMAP resolves to index 1', () => {
    expect(liveLookup.checkNumForName('COLORMAP')).toBe(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.colormapIndex);
  });

  test('E1M1 is present in the shareware IWAD', () => {
    expect(liveLookup.hasLump('E1M1')).toBe(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasE1M1);
  });

  test('TEXTURE1 is present in the shareware IWAD', () => {
    expect(liveLookup.hasLump('TEXTURE1')).toBe(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasTexture1);
  });

  test('TEXTURE2 is absent from the shareware IWAD (registered/Ultimate-only)', () => {
    expect(liveLookup.hasLump('TEXTURE2')).toBe(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasTexture2);
    expect(liveLookup.checkNumForName('TEXTURE2')).toBe(-1);
  });

  test('DEMO1 is present in the shareware IWAD', () => {
    expect(liveLookup.hasLump('DEMO1')).toBe(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasDemo1);
  });

  test('F_END is present in the shareware IWAD', () => {
    expect(liveLookup.hasLump('F_END')).toBe(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.hasFEnd);
  });

  test('the pinned filename matches PRIMARY_TARGET.wadFilename', () => {
    expect<string>(SHAREWARE_DOOM1_WAD_LOOKUP_ORACLE.filename).toBe(PRIMARY_TARGET.wadFilename);
  });

  test('crossCheckShareWareDoom1WadLookupSample reports zero failures for the live lookup', () => {
    const sample: ShareWareDoom1WadLookupSample = {
      totalCount: liveLookup.totalCount,
      playpalIndex: liveLookup.checkNumForName('PLAYPAL'),
      colormapIndex: liveLookup.checkNumForName('COLORMAP'),
      hasE1M1: liveLookup.hasLump('E1M1'),
      hasTexture1: liveLookup.hasLump('TEXTURE1'),
      hasTexture2: liveLookup.hasLump('TEXTURE2'),
      hasDemo1: liveLookup.hasLump('DEMO1'),
      hasFEnd: liveLookup.hasLump('F_END'),
    };
    expect(crossCheckShareWareDoom1WadLookupSample(sample)).toEqual([]);
  });
});

describe('crossCheckShareWareDoom1WadLookupSample failure modes', () => {
  function liveSample(): ShareWareDoom1WadLookupSample {
    return {
      totalCount: liveLookup.totalCount,
      playpalIndex: liveLookup.checkNumForName('PLAYPAL'),
      colormapIndex: liveLookup.checkNumForName('COLORMAP'),
      hasE1M1: liveLookup.hasLump('E1M1'),
      hasTexture1: liveLookup.hasLump('TEXTURE1'),
      hasTexture2: liveLookup.hasLump('TEXTURE2'),
      hasDemo1: liveLookup.hasLump('DEMO1'),
      hasFEnd: liveLookup.hasLump('F_END'),
    };
  }

  test('detects a wrong totalCount', () => {
    const tampered: ShareWareDoom1WadLookupSample = { ...liveSample(), totalCount: 0 };
    expect(crossCheckShareWareDoom1WadLookupSample(tampered)).toContain('oracle:totalCount:value-mismatch');
  });

  test('detects a wrong PLAYPAL index', () => {
    const tampered: ShareWareDoom1WadLookupSample = { ...liveSample(), playpalIndex: 5 };
    expect(crossCheckShareWareDoom1WadLookupSample(tampered)).toContain('oracle:playpalIndex:value-mismatch');
  });

  test('detects a wrong COLORMAP index', () => {
    const tampered: ShareWareDoom1WadLookupSample = { ...liveSample(), colormapIndex: 0 };
    expect(crossCheckShareWareDoom1WadLookupSample(tampered)).toContain('oracle:colormapIndex:value-mismatch');
  });

  test('detects a missing E1M1', () => {
    const tampered: ShareWareDoom1WadLookupSample = { ...liveSample(), hasE1M1: false };
    expect(crossCheckShareWareDoom1WadLookupSample(tampered)).toContain('oracle:hasE1M1:value-mismatch');
  });

  test('detects an unexpected TEXTURE2', () => {
    const tampered: ShareWareDoom1WadLookupSample = { ...liveSample(), hasTexture2: true };
    expect(crossCheckShareWareDoom1WadLookupSample(tampered)).toContain('oracle:hasTexture2:value-mismatch');
  });

  test('detects a missing DEMO1', () => {
    const tampered: ShareWareDoom1WadLookupSample = { ...liveSample(), hasDemo1: false };
    expect(crossCheckShareWareDoom1WadLookupSample(tampered)).toContain('oracle:hasDemo1:value-mismatch');
  });

  test('detects a missing F_END', () => {
    const tampered: ShareWareDoom1WadLookupSample = { ...liveSample(), hasFEnd: false };
    expect(crossCheckShareWareDoom1WadLookupSample(tampered)).toContain('oracle:hasFEnd:value-mismatch');
  });
});

describe('LumpLookup runtime parity with W_CheckNumForName', () => {
  test('PWAD-style override: a synthetic directory with two FOO entries returns the latter', () => {
    expect(syntheticLookup.checkNumForName('FOO')).toBe(2);
  });

  test('case-insensitive lookup of "foo" matches uppercased FOO', () => {
    expect(syntheticLookup.checkNumForName('foo')).toBe(2);
    expect(syntheticLookup.checkNumForName('Foo')).toBe(2);
  });

  test('uniqueCount on a three-entry directory with one duplicate equals 2', () => {
    expect(syntheticLookup.uniqueCount).toBe(2);
    expect(syntheticLookup.totalCount).toBe(3);
  });

  test('getNumForName on a name not present throws with the W_GetNumForName prefix', () => {
    expect(() => syntheticLookup.getNumForName('NOTEXIST')).toThrow(/W_GetNumForName: NOTEXIST not found/);
  });

  test('every uppercased name in the live directory resolves to the LAST occurrence index', () => {
    const lastIndexByName = new Map<string, number>();
    for (let i = 0; i < liveDirectory.length; i++) {
      lastIndexByName.set(liveDirectory[i]!.name.toUpperCase(), i);
    }
    for (const [name, expectedIndex] of lastIndexByName) {
      expect(liveLookup.checkNumForName(name)).toBe(expectedIndex);
    }
  });
});

describe('verify-lump-name-lookup-semantics step file', () => {
  test('declares the wad lane and the verify write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-002-verify-lump-name-lookup-semantics.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/verify-lump-name-lookup-semantics.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/verify-lump-name-lookup-semantics.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-002-verify-lump-name-lookup-semantics.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });

  test('declares 00-018 as its prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-002-verify-lump-name-lookup-semantics.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
