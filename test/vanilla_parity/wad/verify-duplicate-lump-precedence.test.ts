import { describe, expect, test } from 'bun:test';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { LumpLookup } from '../../../src/wad/lumpLookup.ts';
import {
  DUPLICATE_LUMP_PRECEDENCE_AUDIT,
  DUPLICATE_LUMP_PRECEDENCE_DERIVED_INVARIANTS,
  SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE,
  buildSyntheticPwadOverrideDirectory,
  crossCheckDuplicateLumpPrecedence,
  crossCheckShareWareDoom1WadDuplicateSample,
} from '../../../src/assets/verify-duplicate-lump-precedence.ts';
import type { DuplicateLumpPrecedenceAuditEntry, DuplicateLumpPrecedenceSnapshot, ShareWareDoom1WadDuplicateSample } from '../../../src/assets/verify-duplicate-lump-precedence.ts';

const ALLOWED_AXIS_IDS = new Set<DuplicateLumpPrecedenceAuditEntry['id']>(['append-only-load-order', 'intra-wad-duplicates-preserved', 'directory-order-within-wad-preserved', 'pwad-overrides-iwad', 'enumerate-all-duplicates']);
const ALLOWED_SOURCES = new Set<DuplicateLumpPrecedenceAuditEntry['source']>(['W_AddFile', 'W_CheckNumForName', 'LumpLookup.getAllIndicesForName']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);
const liveLookup = new LumpLookup(liveDirectory);

const syntheticDirectory = buildSyntheticPwadOverrideDirectory();
const syntheticLookup = new LumpLookup(syntheticDirectory);

function buildLiveSnapshot(): DuplicateLumpPrecedenceSnapshot {
  return {
    pwadOverrideCheck: syntheticLookup.checkNumForName('PLAYPAL'),
    pwadOverrideAllIndices: syntheticLookup.getAllIndicesForName('PLAYPAL'),
    liveThingsCheck: liveLookup.checkNumForName('THINGS'),
    liveThingsAllIndices: liveLookup.getAllIndicesForName('THINGS'),
    liveMissAllIndices: liveLookup.getAllIndicesForName('NOTEXIST'),
    livePlaypalAllIndices: liveLookup.getAllIndicesForName('PLAYPAL'),
  };
}

const liveSnapshot = Object.freeze(buildLiveSnapshot());

describe('duplicate lump precedence audit ledger shape', () => {
  test('audits exactly five behavioral axes', () => {
    expect(DUPLICATE_LUMP_PRECEDENCE_AUDIT.length).toBe(5);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of DUPLICATE_LUMP_PRECEDENCE_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = DUPLICATE_LUMP_PRECEDENCE_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of W_AddFile, W_CheckNumForName, or LumpLookup.getAllIndicesForName', () => {
    for (const entry of DUPLICATE_LUMP_PRECEDENCE_AUDIT) {
      expect(ALLOWED_SOURCES.has(entry.source)).toBe(true);
    }
  });

  test('every audit entry references either src/w_wad.c or src/wad/lumpLookup.ts', () => {
    for (const entry of DUPLICATE_LUMP_PRECEDENCE_AUDIT) {
      expect(['src/w_wad.c', 'src/wad/lumpLookup.ts']).toContain(entry.referenceSourceFile);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of DUPLICATE_LUMP_PRECEDENCE_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant note', () => {
    for (const entry of DUPLICATE_LUMP_PRECEDENCE_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the enumerate-all-duplicates axis is the only one pinned to LumpLookup.getAllIndicesForName', () => {
    const enumerateEntries = DUPLICATE_LUMP_PRECEDENCE_AUDIT.filter((entry) => entry.source === 'LumpLookup.getAllIndicesForName');
    expect(enumerateEntries.length).toBe(1);
    expect(enumerateEntries[0]?.id).toBe('enumerate-all-duplicates');
  });

  test('exactly three audit axes are pinned to W_AddFile', () => {
    const wAddFileEntries = DUPLICATE_LUMP_PRECEDENCE_AUDIT.filter((entry) => entry.source === 'W_AddFile');
    const ids = new Set(wAddFileEntries.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['append-only-load-order', 'intra-wad-duplicates-preserved', 'directory-order-within-wad-preserved']));
  });

  test('the pwad-overrides-iwad axis is the only one pinned to W_CheckNumForName', () => {
    const wCheckEntries = DUPLICATE_LUMP_PRECEDENCE_AUDIT.filter((entry) => entry.source === 'W_CheckNumForName');
    expect(wCheckEntries.length).toBe(1);
    expect(wCheckEntries[0]?.id).toBe('pwad-overrides-iwad');
  });

  test('the append-only-load-order axis cites the realloc/numlumps_total assignment verbatim', () => {
    const entry = DUPLICATE_LUMP_PRECEDENCE_AUDIT.find((candidate) => candidate.id === 'append-only-load-order');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('startlump = numlumps_total;');
    expect(entry?.cSourceLines).toContain('numlumps_total += numlumps;');
  });

  test('the intra-wad-duplicates-preserved axis cites the strncpy of fileinfo->name verbatim', () => {
    const entry = DUPLICATE_LUMP_PRECEDENCE_AUDIT.find((candidate) => candidate.id === 'intra-wad-duplicates-preserved');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('strncpy(lump_p->name, filerover->name, 8);');
  });

  test('the pwad-overrides-iwad axis cites the backwards-scan comment verbatim', () => {
    const entry = DUPLICATE_LUMP_PRECEDENCE_AUDIT.find((candidate) => candidate.id === 'pwad-overrides-iwad');
    expect(entry).toBeDefined();
    expect(entry?.cSourceLines).toContain('// scan backwards so patch lump files take precedence');
  });
});

describe('duplicate lump precedence derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = DUPLICATE_LUMP_PRECEDENCE_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the six derived invariants the cross-check enforces', () => {
    const ids = new Set(DUPLICATE_LUMP_PRECEDENCE_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'LAST_INDEX_AGREES_WITH_GET_ALL_INDICES_TAIL',
        'GET_ALL_INDICES_RETURNS_ASCENDING_ORDER',
        'GET_ALL_INDICES_EMPTY_FOR_MISS',
        'PWAD_OVERRIDE_SHADOWS_IWAD_LUMP',
        'MAP_DATA_LUMP_DUPLICATE_COUNT_EQUALS_MAP_COUNT',
        'GLOBAL_LUMP_HAS_NO_DUPLICATES_IN_IWAD',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of DUPLICATE_LUMP_PRECEDENCE_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('crossCheckDuplicateLumpPrecedence on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckDuplicateLumpPrecedence(liveSnapshot)).toEqual([]);
  });

  test('PWAD override snapshot resolves to the appended PLAYPAL index 3', () => {
    expect(liveSnapshot.pwadOverrideCheck).toBe(3);
    expect(liveSnapshot.pwadOverrideAllIndices).toEqual([0, 3]);
  });

  test('THINGS in the live shareware IWAD has nine occurrences (one per map)', () => {
    expect(liveSnapshot.liveThingsAllIndices.length).toBe(9);
  });

  test('checkNumForName(THINGS) equals the last element of getAllIndicesForName(THINGS)', () => {
    const tail = liveSnapshot.liveThingsAllIndices.at(-1);
    expect(tail).toBeDefined();
    expect(liveSnapshot.liveThingsCheck).toBe(tail!);
  });

  test('a missing lump yields an empty getAllIndicesForName array', () => {
    expect(liveSnapshot.liveMissAllIndices).toEqual([]);
  });

  test('PLAYPAL in the live shareware IWAD has exactly one occurrence', () => {
    expect(liveSnapshot.livePlaypalAllIndices.length).toBe(1);
    expect(liveSnapshot.livePlaypalAllIndices[0]).toBe(0);
  });
});

describe('crossCheckDuplicateLumpPrecedence failure modes', () => {
  test('detects a snapshot whose PWAD override did not pick the appended index', () => {
    const tampered: DuplicateLumpPrecedenceSnapshot = { ...liveSnapshot, pwadOverrideCheck: 0 };
    const failures = crossCheckDuplicateLumpPrecedence(tampered);
    expect(failures).toContain('derived:PWAD_OVERRIDE_SHADOWS_IWAD_LUMP');
    expect(failures).toContain('audit:pwad-overrides-iwad:not-observed');
  });

  test('detects a snapshot whose checkNumForName disagrees with the tail of getAllIndicesForName', () => {
    const tampered: DuplicateLumpPrecedenceSnapshot = { ...liveSnapshot, liveThingsCheck: liveSnapshot.liveThingsAllIndices[0]! };
    const failures = crossCheckDuplicateLumpPrecedence(tampered);
    expect(failures).toContain('derived:LAST_INDEX_AGREES_WITH_GET_ALL_INDICES_TAIL');
    expect(failures).toContain('audit:enumerate-all-duplicates:not-observed');
  });

  test('detects a snapshot whose getAllIndicesForName is not strictly ascending', () => {
    const tampered: DuplicateLumpPrecedenceSnapshot = { ...liveSnapshot, liveThingsAllIndices: [...liveSnapshot.liveThingsAllIndices].reverse() };
    const failures = crossCheckDuplicateLumpPrecedence(tampered);
    expect(failures).toContain('derived:GET_ALL_INDICES_RETURNS_ASCENDING_ORDER');
    expect(failures).toContain('audit:directory-order-within-wad-preserved:not-observed');
  });

  test('detects a snapshot whose miss returned a non-empty array', () => {
    const tampered: DuplicateLumpPrecedenceSnapshot = { ...liveSnapshot, liveMissAllIndices: [0] };
    const failures = crossCheckDuplicateLumpPrecedence(tampered);
    expect(failures).toContain('derived:GET_ALL_INDICES_EMPTY_FOR_MISS');
  });

  test('detects a snapshot whose map-data duplicate count is wrong', () => {
    const tampered: DuplicateLumpPrecedenceSnapshot = { ...liveSnapshot, liveThingsAllIndices: [7] };
    const failures = crossCheckDuplicateLumpPrecedence(tampered);
    expect(failures).toContain('derived:MAP_DATA_LUMP_DUPLICATE_COUNT_EQUALS_MAP_COUNT');
    expect(failures).toContain('audit:intra-wad-duplicates-preserved:not-observed');
  });

  test('detects a snapshot whose global lump duplicate count is wrong', () => {
    const tampered: DuplicateLumpPrecedenceSnapshot = { ...liveSnapshot, livePlaypalAllIndices: [0, 99] };
    const failures = crossCheckDuplicateLumpPrecedence(tampered);
    expect(failures).toContain('derived:GLOBAL_LUMP_HAS_NO_DUPLICATES_IN_IWAD');
    expect(failures).toContain('audit:append-only-load-order:not-observed');
  });
});

describe('shareware DOOM1.WAD duplicate lump oracle', () => {
  test('the live LumpLookup totalCount matches PRIMARY_TARGET.wadLumpCount', () => {
    expect(liveLookup.totalCount).toBe(PRIMARY_TARGET.wadLumpCount);
  });

  test('the oracle declares exactly nine maps in the shareware IWAD', () => {
    expect(SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapCount).toBe(9);
    expect(SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapMarkerNames.length).toBe(9);
  });

  test('the oracle declares exactly ten map-data lump names', () => {
    expect(SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapDataLumpNames.length).toBe(10);
  });

  test('every map-data lump in the live IWAD appears exactly nine times', () => {
    for (const name of SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapDataLumpNames) {
      expect(liveLookup.getAllIndicesForName(name).length).toBe(SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapDataDuplicateCount);
    }
  });

  test('every global lump in the live IWAD appears exactly once', () => {
    for (const name of SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.globalLumpNames) {
      expect(liveLookup.getAllIndicesForName(name).length).toBe(1);
    }
  });

  test('every map marker in the live IWAD appears exactly once', () => {
    for (const name of SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapMarkerNames) {
      expect(liveLookup.getAllIndicesForName(name).length).toBe(1);
    }
  });

  test('the first THINGS lump sits immediately after the E1M1 marker', () => {
    const thingsIndices = liveLookup.getAllIndicesForName('THINGS');
    expect(thingsIndices[0]).toBe(SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.firstThingsIndex);
  });

  test('the last THINGS lump sits immediately after the E1M9 marker', () => {
    const thingsIndices = liveLookup.getAllIndicesForName('THINGS');
    expect(thingsIndices.at(-1)).toBe(SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.lastThingsIndex);
  });

  test('the pinned filename matches PRIMARY_TARGET.wadFilename', () => {
    expect<string>(SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.filename).toBe(PRIMARY_TARGET.wadFilename);
  });

  test('crossCheckShareWareDoom1WadDuplicateSample reports zero failures for the live lookup', () => {
    const sample: ShareWareDoom1WadDuplicateSample = {
      mapDataDuplicateCounts: SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapDataLumpNames.map((name) => ({ name, count: liveLookup.getAllIndicesForName(name).length })),
      globalLumpDuplicateCounts: SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.globalLumpNames.map((name) => ({ name, count: liveLookup.getAllIndicesForName(name).length })),
      mapMarkerDuplicateCounts: SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapMarkerNames.map((name) => ({ name, count: liveLookup.getAllIndicesForName(name).length })),
      firstThingsIndex: liveLookup.getAllIndicesForName('THINGS')[0]!,
      lastThingsIndex: liveLookup.getAllIndicesForName('THINGS').at(-1)!,
    };
    expect(crossCheckShareWareDoom1WadDuplicateSample(sample)).toEqual([]);
  });
});

describe('crossCheckShareWareDoom1WadDuplicateSample failure modes', () => {
  function liveSample(): ShareWareDoom1WadDuplicateSample {
    return {
      mapDataDuplicateCounts: SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapDataLumpNames.map((name) => ({ name, count: liveLookup.getAllIndicesForName(name).length })),
      globalLumpDuplicateCounts: SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.globalLumpNames.map((name) => ({ name, count: liveLookup.getAllIndicesForName(name).length })),
      mapMarkerDuplicateCounts: SHAREWARE_DOOM1_WAD_DUPLICATE_ORACLE.mapMarkerNames.map((name) => ({ name, count: liveLookup.getAllIndicesForName(name).length })),
      firstThingsIndex: liveLookup.getAllIndicesForName('THINGS')[0]!,
      lastThingsIndex: liveLookup.getAllIndicesForName('THINGS').at(-1)!,
    };
  }

  test('detects a wrong THINGS duplicate count', () => {
    const live = liveSample();
    const tampered: ShareWareDoom1WadDuplicateSample = {
      ...live,
      mapDataDuplicateCounts: live.mapDataDuplicateCounts.map((entry) => (entry.name === 'THINGS' ? { name: 'THINGS', count: 1 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadDuplicateSample(tampered)).toContain('oracle:mapDataDuplicateCount:THINGS:value-mismatch');
  });

  test('detects an unexpected PLAYPAL duplicate', () => {
    const live = liveSample();
    const tampered: ShareWareDoom1WadDuplicateSample = {
      ...live,
      globalLumpDuplicateCounts: live.globalLumpDuplicateCounts.map((entry) => (entry.name === 'PLAYPAL' ? { name: 'PLAYPAL', count: 2 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadDuplicateSample(tampered)).toContain('oracle:globalLumpDuplicateCount:PLAYPAL:value-mismatch');
  });

  test('detects a duplicate map marker', () => {
    const live = liveSample();
    const tampered: ShareWareDoom1WadDuplicateSample = {
      ...live,
      mapMarkerDuplicateCounts: live.mapMarkerDuplicateCounts.map((entry) => (entry.name === 'E1M1' ? { name: 'E1M1', count: 2 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadDuplicateSample(tampered)).toContain('oracle:mapMarkerDuplicateCount:E1M1:value-mismatch');
  });

  test('detects a wrong first THINGS index', () => {
    const tampered: ShareWareDoom1WadDuplicateSample = { ...liveSample(), firstThingsIndex: 0 };
    expect(crossCheckShareWareDoom1WadDuplicateSample(tampered)).toContain('oracle:firstThingsIndex:value-mismatch');
  });

  test('detects a wrong last THINGS index', () => {
    const tampered: ShareWareDoom1WadDuplicateSample = { ...liveSample(), lastThingsIndex: 7 };
    expect(crossCheckShareWareDoom1WadDuplicateSample(tampered)).toContain('oracle:lastThingsIndex:value-mismatch');
  });
});

describe('LumpLookup runtime parity with append-only load order', () => {
  test('synthetic IWAD+PWAD directory exposes both PLAYPAL occurrences via getAllIndicesForName', () => {
    expect(syntheticLookup.getAllIndicesForName('PLAYPAL')).toEqual([0, 3]);
  });

  test('synthetic directory checkNumForName returns the appended PWAD index 3', () => {
    expect(syntheticLookup.checkNumForName('PLAYPAL')).toBe(3);
  });

  test('synthetic directory totalCount equals four entries (no de-duplication)', () => {
    expect(syntheticLookup.totalCount).toBe(4);
  });

  test('synthetic directory uniqueCount equals three (PLAYPAL collapses, COLORMAP/TEXTURE1 stand alone)', () => {
    expect(syntheticLookup.uniqueCount).toBe(3);
  });

  test('every duplicate name in the live directory satisfies checkNumForName === getAllIndicesForName.tail', () => {
    const seenNames = new Set<string>();
    for (let i = 0; i < liveDirectory.length; i++) {
      const name = liveDirectory[i]!.name.toUpperCase();
      if (seenNames.has(name)) {
        const allIndices = liveLookup.getAllIndicesForName(name);
        expect(liveLookup.checkNumForName(name)).toBe(allIndices.at(-1)!);
        expect(allIndices.length).toBeGreaterThan(1);
      }
      seenNames.add(name);
    }
  });

  test('the live directory contains at least one duplicate-name lump', () => {
    const counts = new Map<string, number>();
    for (const entry of liveDirectory) {
      const upper = entry.name.toUpperCase();
      counts.set(upper, (counts.get(upper) ?? 0) + 1);
    }
    let duplicateCount = 0;
    for (const count of counts.values()) {
      if (count > 1) duplicateCount += 1;
    }
    expect(duplicateCount).toBeGreaterThan(0);
  });

  test('uniqueCount + (totalCount - uniqueCount duplicate-occurrences) equals totalCount', () => {
    expect(liveLookup.uniqueCount).toBeLessThan(liveLookup.totalCount);
  });
});

describe('verify-duplicate-lump-precedence step file', () => {
  test('declares the wad lane and the verify write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-003-verify-duplicate-lump-precedence.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/verify-duplicate-lump-precedence.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/verify-duplicate-lump-precedence.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-003-verify-duplicate-lump-precedence.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });

  test('declares 00-018 as its prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-003-verify-duplicate-lump-precedence.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
