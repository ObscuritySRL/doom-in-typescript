import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import {
  BYTES_PER_COLOR,
  COLORMAP_COUNT,
  COLORMAP_LUMP_SIZE,
  COLORMAP_SIZE,
  COLORS_PER_PALETTE,
  ENTRIES_PER_COLORMAP,
  INVULNERABILITY_COLORMAP,
  LIGHTLEVEL_COUNT,
  NUMBONUSPALS,
  NUMREDPALS,
  PALETTE_COUNT,
  PALETTE_SIZE,
  PLAYPAL_COLORMAP_AUDIT,
  PLAYPAL_COLORMAP_DERIVED_INVARIANTS,
  PLAYPAL_SIZE,
  RADIATIONPAL,
  SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE,
  STARTBONUSPALS,
  STARTREDPALS,
  crossCheckPlaypalColormapRuntime,
  crossCheckShareWareDoom1WadPlaypalColormapSample,
  parseColormap,
  parsePlaypal,
} from '../../../src/assets/parse-playpal-and-colormap-lumps.ts';
import type { PlaypalColormapAuditEntry, PlaypalColormapRuntimeSnapshot, ShareWareDoom1WadPlaypalColormapSample } from '../../../src/assets/parse-playpal-and-colormap-lumps.ts';

const ALLOWED_AXIS_IDS = new Set<PlaypalColormapAuditEntry['id']>([
  'playpal-palette-count-fourteen',
  'playpal-colors-per-palette-256',
  'playpal-bytes-per-color-three',
  'playpal-palette-stride-768',
  'playpal-total-size-10752',
  'playpal-startredpals-one',
  'playpal-numredpals-eight',
  'playpal-startbonuspals-nine',
  'playpal-numbonuspals-four',
  'playpal-radiationpal-thirteen',
  'playpal-cache-by-name',
  'colormap-numcolormaps-thirty-two',
  'colormap-entries-per-colormap-256',
  'colormap-stride-256',
  'colormap-total-size-shareware-8704',
  'colormap-invulnerability-index-thirty-two',
  'colormap-cache-by-name',
]);
const ALLOWED_SUBJECTS = new Set<PlaypalColormapAuditEntry['subject']>(['PLAYPAL', 'COLORMAP', 'parsePlaypal', 'parseColormap']);
const ALLOWED_REFERENCE_FILES = new Set<PlaypalColormapAuditEntry['referenceSourceFile']>(['src/st_stuff.c', 'src/doomdef.h', 'src/r_data.c', 'src/r_main.c', 'src/v_video.c', 'src/w_wad.c']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const playpalIndex = liveDirectory.findIndex((entry) => entry.name === 'PLAYPAL');
const colormapIndex = liveDirectory.findIndex((entry) => entry.name === 'COLORMAP');
const playpalEntry = liveDirectory[playpalIndex]!;
const colormapEntry = liveDirectory[colormapIndex]!;
const playpalLumpData = wadBuffer.subarray(playpalEntry.offset, playpalEntry.offset + playpalEntry.size);
const colormapLumpData = wadBuffer.subarray(colormapEntry.offset, colormapEntry.offset + colormapEntry.size);

const livePalettes = parsePlaypal(playpalLumpData);
const liveColormaps = parseColormap(colormapLumpData);

function tryThrowsWith(thunk: () => unknown, pattern: RegExp): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof RangeError && pattern.test(err.message);
  }
}

const playpalShortRejects = tryThrowsWith(() => parsePlaypal(new Uint8Array(PLAYPAL_SIZE - 1)), /PLAYPAL.*10751/);
const playpalLongRejects = tryThrowsWith(() => parsePlaypal(new Uint8Array(PLAYPAL_SIZE + 1)), /PLAYPAL.*10753/);
const colormapShortRejects = tryThrowsWith(() => parseColormap(new Uint8Array(COLORMAP_LUMP_SIZE - 1)), /COLORMAP.*8703/);
const colormapLongRejects = tryThrowsWith(() => parseColormap(new Uint8Array(COLORMAP_LUMP_SIZE + 1)), /COLORMAP.*8705/);

function buildLiveRuntimeSnapshot(): PlaypalColormapRuntimeSnapshot {
  return {
    paletteCount: PALETTE_COUNT,
    colorsPerPalette: COLORS_PER_PALETTE,
    bytesPerColor: BYTES_PER_COLOR,
    paletteSize: PALETTE_SIZE,
    playpalSize: PLAYPAL_SIZE,
    startRedPals: STARTREDPALS,
    numRedPals: NUMREDPALS,
    startBonusPals: STARTBONUSPALS,
    numBonusPals: NUMBONUSPALS,
    radiationPal: RADIATIONPAL,
    parsePlaypalLength: livePalettes.length,
    everyPaletteIs768Bytes: livePalettes.every((palette) => palette.length === PALETTE_SIZE),
    playpalArrayIsFrozen: Object.isFrozen(livePalettes),
    parsePlaypalRejectsShort: playpalShortRejects,
    parsePlaypalRejectsLong: playpalLongRejects,
    colormapCount: COLORMAP_COUNT,
    entriesPerColormap: ENTRIES_PER_COLORMAP,
    colormapSize: COLORMAP_SIZE,
    colormapLumpSize: COLORMAP_LUMP_SIZE,
    lightLevelCount: LIGHTLEVEL_COUNT,
    invulnerabilityColormap: INVULNERABILITY_COLORMAP,
    parseColormapLength: liveColormaps.length,
    everyColormapIs256Bytes: liveColormaps.every((colormap) => colormap.length === COLORMAP_SIZE),
    colormapArrayIsFrozen: Object.isFrozen(liveColormaps),
    parseColormapRejectsShort: colormapShortRejects,
    parseColormapRejectsLong: colormapLongRejects,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadPlaypalColormapSample {
  return {
    playpalDirectoryIndex: playpalIndex,
    colormapDirectoryIndex: colormapIndex,
    playpalFileOffset: playpalEntry.offset,
    playpalSize: playpalEntry.size,
    colormapFileOffset: colormapEntry.offset,
    colormapSize: colormapEntry.size,
    playpalSha256: createHash('sha256').update(playpalLumpData).digest('hex'),
    colormapSha256: createHash('sha256').update(colormapLumpData).digest('hex'),
    paletteZeroFirstColor: [livePalettes[0]![0]!, livePalettes[0]![1]!, livePalettes[0]![2]!] as readonly [number, number, number],
    paletteOneFirstColor: [livePalettes[1]![0]!, livePalettes[1]![1]!, livePalettes[1]![2]!] as readonly [number, number, number],
    paletteThirteenFirstColor: [livePalettes[13]![0]!, livePalettes[13]![1]!, livePalettes[13]![2]!] as readonly [number, number, number],
    colormapIndexThirtyThreeIsAllZero: liveColormaps[33]!.every((entry) => entry === 0),
  };
}

const liveOracleSample = Object.freeze(buildLiveOracleSample());

describe('PLAYPAL / COLORMAP audit ledger shape', () => {
  test('audits exactly seventeen behavioral axes', () => {
    expect(PLAYPAL_COLORMAP_AUDIT.length).toBe(17);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of PLAYPAL_COLORMAP_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = PLAYPAL_COLORMAP_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of PLAYPAL_COLORMAP_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of PLAYPAL_COLORMAP_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of PLAYPAL_COLORMAP_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of PLAYPAL_COLORMAP_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('PLAYPAL / COLORMAP derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = PLAYPAL_COLORMAP_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(PLAYPAL_COLORMAP_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'PLAYPAL_TOTAL_EQUALS_PALETTE_COUNT_TIMES_PALETTE_SIZE',
        'PLAYPAL_PALETTE_SIZE_EQUALS_COLORS_TIMES_BYTES_PER_COLOR',
        'PLAYPAL_REGIONS_FILL_FOURTEEN_PALETTES',
        'PLAYPAL_RED_REGION_AT_ONE_THROUGH_EIGHT',
        'PLAYPAL_BONUS_REGION_AT_NINE_THROUGH_TWELVE',
        'PLAYPAL_RADIATION_REGION_IS_LAST_PALETTE',
        'PARSEPLAYPAL_RETURNS_FOURTEEN_VIEWS_OF_768_BYTES',
        'PARSEPLAYPAL_REJECTS_WRONG_SIZE_WITH_RANGEERROR',
        'COLORMAP_TOTAL_EQUALS_COUNT_TIMES_SIZE',
        'COLORMAP_LIGHT_LEVELS_AT_INDICES_ZERO_THROUGH_THIRTYONE',
        'COLORMAP_INVULNERABILITY_AT_INDEX_THIRTYTWO',
        'PARSECOLORMAP_RETURNS_THIRTYFOUR_VIEWS_OF_256_BYTES',
        'PARSECOLORMAP_REJECTS_WRONG_SIZE_WITH_RANGEERROR',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of PLAYPAL_COLORMAP_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('PALETTE_COUNT is 14 and equals 1 + NUMREDPALS + NUMBONUSPALS + 1', () => {
    expect(PALETTE_COUNT).toBe(14);
    expect(1 + NUMREDPALS + NUMBONUSPALS + 1).toBe(PALETTE_COUNT);
  });

  test('COLORS_PER_PALETTE is 256 and BYTES_PER_COLOR is 3', () => {
    expect(COLORS_PER_PALETTE).toBe(256);
    expect(BYTES_PER_COLOR).toBe(3);
  });

  test('PALETTE_SIZE === COLORS_PER_PALETTE * BYTES_PER_COLOR === 768', () => {
    expect(PALETTE_SIZE).toBe(COLORS_PER_PALETTE * BYTES_PER_COLOR);
    expect(PALETTE_SIZE).toBe(768);
  });

  test('PLAYPAL_SIZE === PALETTE_COUNT * PALETTE_SIZE === 10752', () => {
    expect(PLAYPAL_SIZE).toBe(PALETTE_COUNT * PALETTE_SIZE);
    expect(PLAYPAL_SIZE).toBe(10752);
  });

  test('STARTREDPALS / NUMREDPALS / STARTBONUSPALS / NUMBONUSPALS / RADIATIONPAL match st_stuff.c', () => {
    expect(STARTREDPALS).toBe(1);
    expect(NUMREDPALS).toBe(8);
    expect(STARTBONUSPALS).toBe(9);
    expect(NUMBONUSPALS).toBe(4);
    expect(RADIATIONPAL).toBe(13);
  });

  test('the four palette regions partition the 14-palette lump exactly', () => {
    expect(STARTBONUSPALS).toBe(STARTREDPALS + NUMREDPALS);
    expect(RADIATIONPAL).toBe(STARTBONUSPALS + NUMBONUSPALS);
    expect(RADIATIONPAL).toBe(PALETTE_COUNT - 1);
  });

  test('COLORMAP_COUNT is 34 and ENTRIES_PER_COLORMAP / COLORMAP_SIZE are 256', () => {
    expect(COLORMAP_COUNT).toBe(34);
    expect(ENTRIES_PER_COLORMAP).toBe(256);
    expect(COLORMAP_SIZE).toBe(256);
  });

  test('COLORMAP_LUMP_SIZE === COLORMAP_COUNT * COLORMAP_SIZE === 8704', () => {
    expect(COLORMAP_LUMP_SIZE).toBe(COLORMAP_COUNT * COLORMAP_SIZE);
    expect(COLORMAP_LUMP_SIZE).toBe(8704);
  });

  test('LIGHTLEVEL_COUNT is 32 and INVULNERABILITY_COLORMAP is 32', () => {
    expect(LIGHTLEVEL_COUNT).toBe(32);
    expect(INVULNERABILITY_COLORMAP).toBe(32);
    expect(INVULNERABILITY_COLORMAP).toBe(LIGHTLEVEL_COUNT);
  });
});

describe('parsePlaypal runtime contract', () => {
  test('returns 14 palettes of 768 bytes each from the live PLAYPAL lump', () => {
    expect(livePalettes.length).toBe(PALETTE_COUNT);
    for (const palette of livePalettes) {
      expect(palette.length).toBe(PALETTE_SIZE);
      expect(palette).toBeInstanceOf(Uint8Array);
    }
  });

  test('returns a frozen outer array', () => {
    expect(Object.isFrozen(livePalettes)).toBe(true);
  });

  test('each palette is a live view into the same underlying ArrayBuffer (no copy)', () => {
    expect(livePalettes[0]!.buffer).toBe(playpalLumpData.buffer);
    expect(livePalettes[13]!.buffer).toBe(playpalLumpData.buffer);
  });

  test('rejects an under-sized lump with a RangeError naming PLAYPAL', () => {
    expect(() => parsePlaypal(new Uint8Array(PLAYPAL_SIZE - 1))).toThrow(/PLAYPAL.*10751/);
  });

  test('rejects an over-sized lump with a RangeError naming PLAYPAL', () => {
    expect(() => parsePlaypal(new Uint8Array(PLAYPAL_SIZE + 1))).toThrow(/PLAYPAL.*10753/);
  });
});

describe('parseColormap runtime contract', () => {
  test('returns 34 colormaps of 256 bytes each from the live COLORMAP lump', () => {
    expect(liveColormaps.length).toBe(COLORMAP_COUNT);
    for (const colormap of liveColormaps) {
      expect(colormap.length).toBe(COLORMAP_SIZE);
      expect(colormap).toBeInstanceOf(Uint8Array);
    }
  });

  test('returns a frozen outer array', () => {
    expect(Object.isFrozen(liveColormaps)).toBe(true);
  });

  test('every colormap entry is a valid 8-bit palette index (0..255)', () => {
    for (const colormap of liveColormaps) {
      for (const entry of colormap) {
        expect(entry).toBeGreaterThanOrEqual(0);
        expect(entry).toBeLessThanOrEqual(255);
      }
    }
  });

  test('rejects an under-sized lump with a RangeError naming COLORMAP', () => {
    expect(() => parseColormap(new Uint8Array(COLORMAP_LUMP_SIZE - 1))).toThrow(/COLORMAP.*8703/);
  });

  test('rejects an over-sized lump with a RangeError naming COLORMAP', () => {
    expect(() => parseColormap(new Uint8Array(COLORMAP_LUMP_SIZE + 1))).toThrow(/COLORMAP.*8705/);
  });
});

describe('crossCheckPlaypalColormapRuntime on the live runtime snapshot', () => {
  test('reports zero failures', () => {
    expect(crossCheckPlaypalColormapRuntime(liveRuntimeSnapshot)).toEqual([]);
  });
});

describe('crossCheckPlaypalColormapRuntime failure modes', () => {
  test('detects a tampered PALETTE_COUNT that no longer agrees with the region partition', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, paletteCount: 15 };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:PLAYPAL_TOTAL_EQUALS_PALETTE_COUNT_TIMES_PALETTE_SIZE');
    expect(failures).toContain('derived:PLAYPAL_REGIONS_FILL_FOURTEEN_PALETTES');
  });

  test('detects a tampered PALETTE_SIZE that no longer decomposes into 256 * 3', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, paletteSize: 770 };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:PLAYPAL_TOTAL_EQUALS_PALETTE_COUNT_TIMES_PALETTE_SIZE');
    expect(failures).toContain('derived:PLAYPAL_PALETTE_SIZE_EQUALS_COLORS_TIMES_BYTES_PER_COLOR');
  });

  test('detects a tampered STARTREDPALS that displaces the red region', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, startRedPals: 0 };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:PLAYPAL_RED_REGION_AT_ONE_THROUGH_EIGHT');
    expect(failures).toContain('audit:playpal-startredpals-one:not-observed');
  });

  test('detects a tampered RADIATIONPAL that no longer points at the last palette', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, radiationPal: 12 };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:PLAYPAL_RADIATION_REGION_IS_LAST_PALETTE');
    expect(failures).toContain('audit:playpal-radiationpal-thirteen:not-observed');
  });

  test('detects a parsePlaypal that fails to freeze the outer array', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, playpalArrayIsFrozen: false };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:PARSEPLAYPAL_RETURNS_FOURTEEN_VIEWS_OF_768_BYTES');
    expect(failures).toContain('audit:playpal-cache-by-name:not-observed');
  });

  test('detects a parsePlaypal that silently accepts an under-sized lump', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, parsePlaypalRejectsShort: false };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:PARSEPLAYPAL_REJECTS_WRONG_SIZE_WITH_RANGEERROR');
  });

  test('detects a tampered COLORMAP_LUMP_SIZE that no longer equals 34 * 256', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, colormapLumpSize: 8192 };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:COLORMAP_TOTAL_EQUALS_COUNT_TIMES_SIZE');
    expect(failures).toContain('audit:colormap-total-size-shareware-8704:not-observed');
  });

  test('detects a tampered LIGHTLEVEL_COUNT that no longer equals NUMCOLORMAPS', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, lightLevelCount: 16 };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:COLORMAP_LIGHT_LEVELS_AT_INDICES_ZERO_THROUGH_THIRTYONE');
    expect(failures).toContain('derived:COLORMAP_INVULNERABILITY_AT_INDEX_THIRTYTWO');
    expect(failures).toContain('audit:colormap-numcolormaps-thirty-two:not-observed');
  });

  test('detects a tampered INVULNERABILITY_COLORMAP that no longer matches the light-level boundary', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, invulnerabilityColormap: 33 };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:COLORMAP_INVULNERABILITY_AT_INDEX_THIRTYTWO');
    expect(failures).toContain('audit:colormap-invulnerability-index-thirty-two:not-observed');
  });

  test('detects a parseColormap that silently accepts an over-sized lump', () => {
    const tampered: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot, parseColormapRejectsLong: false };
    const failures = crossCheckPlaypalColormapRuntime(tampered);
    expect(failures).toContain('derived:PARSECOLORMAP_REJECTS_WRONG_SIZE_WITH_RANGEERROR');
  });

  test('reports an empty failure list for a freshly built equivalent snapshot', () => {
    const cloned: PlaypalColormapRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckPlaypalColormapRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD PLAYPAL / COLORMAP oracle', () => {
  test('PLAYPAL is at directory index 0 and COLORMAP is at directory index 1', () => {
    expect(playpalIndex).toBe(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.playpalDirectoryIndex);
    expect(colormapIndex).toBe(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.colormapDirectoryIndex);
  });

  test('PLAYPAL sits immediately after the 12-byte WAD header at offset 12 with size 10752', () => {
    expect(playpalEntry.offset).toBe(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.playpalFileOffset);
    expect(playpalEntry.size).toBe(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.playpalSize);
    expect(playpalEntry.size).toBe(PLAYPAL_SIZE);
  });

  test('COLORMAP sits immediately after PLAYPAL at offset 10764 with size 8704', () => {
    expect(colormapEntry.offset).toBe(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.colormapFileOffset);
    expect(colormapEntry.size).toBe(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.colormapSize);
    expect(colormapEntry.size).toBe(COLORMAP_LUMP_SIZE);
    expect(colormapEntry.offset).toBe(playpalEntry.offset + playpalEntry.size);
  });

  test('PLAYPAL sha256 matches the pinned oracle digest', () => {
    const liveDigest = createHash('sha256').update(playpalLumpData).digest('hex');
    expect(liveDigest).toBe(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.playpalSha256);
  });

  test('COLORMAP sha256 matches the pinned oracle digest', () => {
    const liveDigest = createHash('sha256').update(colormapLumpData).digest('hex');
    expect(liveDigest).toBe(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.colormapSha256);
  });

  test('palette 0 first color is (0,0,0) — the normal/no-tint baseline opaque black', () => {
    expect(livePalettes[0]![0]).toBe(0);
    expect(livePalettes[0]![1]).toBe(0);
    expect(livePalettes[0]![2]).toBe(0);
  });

  test('palette 1 first color is (28,0,0) — the brightest red damage tint', () => {
    expect(livePalettes[STARTREDPALS]![0]).toBe(28);
    expect(livePalettes[STARTREDPALS]![1]).toBe(0);
    expect(livePalettes[STARTREDPALS]![2]).toBe(0);
  });

  test('palette 13 (RADIATIONPAL) first color is (0,32,0) — the radiation-suit green tint', () => {
    expect(livePalettes[RADIATIONPAL]![0]).toBe(0);
    expect(livePalettes[RADIATIONPAL]![1]).toBe(32);
    expect(livePalettes[RADIATIONPAL]![2]).toBe(0);
  });

  test('the 34th colormap (index 33) is observed all-zero in shareware DOOM1.WAD', () => {
    const trailing = liveColormaps[33]!;
    for (const entry of trailing) {
      expect(entry).toBe(0);
    }
  });

  test('crossCheckShareWareDoom1WadPlaypalColormapSample reports zero failures for the live on-disk parse', () => {
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(liveOracleSample)).toEqual([]);
  });

  test('the pinned filename matches PRIMARY_TARGET.wadFilename', () => {
    expect<string>(SHAREWARE_DOOM1_WAD_PLAYPAL_COLORMAP_ORACLE.filename).toBe(PRIMARY_TARGET.wadFilename);
  });

  test('matches the wad-map-summary.json reference manifest on palette / colormap counts', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { palette: number; colormap: number } };
    expect(manifest.lumpCategories.palette).toBe(1);
    expect(manifest.lumpCategories.colormap).toBe(1);
  });
});

describe('crossCheckShareWareDoom1WadPlaypalColormapSample failure modes', () => {
  test('detects a wrong PLAYPAL directory index', () => {
    const tampered: ShareWareDoom1WadPlaypalColormapSample = { ...liveOracleSample, playpalDirectoryIndex: 99 };
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(tampered)).toContain('oracle:playpalDirectoryIndex:value-mismatch');
  });

  test('detects a wrong COLORMAP file offset', () => {
    const tampered: ShareWareDoom1WadPlaypalColormapSample = { ...liveOracleSample, colormapFileOffset: 0 };
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(tampered)).toContain('oracle:colormapFileOffset:value-mismatch');
  });

  test('detects a wrong PLAYPAL sha256', () => {
    const tampered: ShareWareDoom1WadPlaypalColormapSample = { ...liveOracleSample, playpalSha256: '0'.repeat(64) };
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(tampered)).toContain('oracle:playpalSha256:value-mismatch');
  });

  test('detects a wrong COLORMAP sha256', () => {
    const tampered: ShareWareDoom1WadPlaypalColormapSample = { ...liveOracleSample, colormapSha256: 'f'.repeat(64) };
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(tampered)).toContain('oracle:colormapSha256:value-mismatch');
  });

  test('detects a wrong palette 0 first color', () => {
    const tampered: ShareWareDoom1WadPlaypalColormapSample = { ...liveOracleSample, paletteZeroFirstColor: [255, 255, 255] as readonly [number, number, number] };
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(tampered)).toContain('oracle:paletteZeroFirstColor:value-mismatch');
  });

  test('detects a wrong palette 13 first color (radiation tint changed)', () => {
    const tampered: ShareWareDoom1WadPlaypalColormapSample = { ...liveOracleSample, paletteThirteenFirstColor: [0, 0, 0] as readonly [number, number, number] };
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(tampered)).toContain('oracle:paletteThirteenFirstColor:value-mismatch');
  });

  test('detects a colormap[33] that is no longer all-zero', () => {
    const tampered: ShareWareDoom1WadPlaypalColormapSample = { ...liveOracleSample, colormapIndexThirtyThreeIsAllZero: false };
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(tampered)).toContain('oracle:colormapIndexThirtyThreeIsAllZero:value-mismatch');
  });

  test('reports an empty failure list for a freshly built equivalent sample', () => {
    const cloned: ShareWareDoom1WadPlaypalColormapSample = { ...liveOracleSample };
    expect(crossCheckShareWareDoom1WadPlaypalColormapSample(cloned)).toEqual([]);
  });
});

describe('parse-playpal-and-colormap-lumps step file', () => {
  test('declares the wad lane and the parse-playpal-and-colormap write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-005-parse-playpal-and-colormap-lumps.md').text();
    expect(stepText).toContain('## lane\n\nwad');
    expect(stepText).toContain('- src/assets/parse-playpal-and-colormap-lumps.ts');
    expect(stepText).toContain('- test/vanilla_parity/wad/parse-playpal-and-colormap-lumps.test.ts');
  });

  test('lists r_data.c, w_wad.c, and p_setup.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/05-005-parse-playpal-and-colormap-lumps.md').text();
    expect(stepText).toContain('- r_data.c');
    expect(stepText).toContain('- w_wad.c');
    expect(stepText).toContain('- p_setup.c');
  });
});
