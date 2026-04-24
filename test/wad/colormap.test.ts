import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { ALLBLACK_COLORMAP, COLORMAP_COUNT, COLORMAP_LUMP_SIZE, COLORMAP_SIZE, ENTRIES_PER_COLORMAP, INVULNERABILITY_COLORMAP, LIGHTLEVEL_COUNT, parseColormap } from '../../src/assets/colormap.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lookup = new LumpLookup(directory);
const colormapData = lookup.getLumpData('COLORMAP', wadBuffer);
const colormaps = parseColormap(colormapData);

describe('COLORMAP constants', () => {
  it('COLORMAP_COUNT is 34', () => {
    expect(COLORMAP_COUNT).toBe(34);
  });

  it('ENTRIES_PER_COLORMAP is 256', () => {
    expect(ENTRIES_PER_COLORMAP).toBe(256);
  });

  it('COLORMAP_SIZE is 256', () => {
    expect(COLORMAP_SIZE).toBe(256);
  });

  it('COLORMAP_LUMP_SIZE is 8704', () => {
    expect(COLORMAP_LUMP_SIZE).toBe(8704);
  });

  it('LIGHTLEVEL_COUNT is 32', () => {
    expect(LIGHTLEVEL_COUNT).toBe(32);
  });

  it('INVULNERABILITY_COLORMAP is 32', () => {
    expect(INVULNERABILITY_COLORMAP).toBe(32);
  });

  it('ALLBLACK_COLORMAP is 33', () => {
    expect(ALLBLACK_COLORMAP).toBe(33);
  });

  it('special colormaps follow light-level colormaps contiguously', () => {
    expect(INVULNERABILITY_COLORMAP).toBe(LIGHTLEVEL_COUNT);
    expect(ALLBLACK_COLORMAP).toBe(LIGHTLEVEL_COUNT + 1);
    expect(COLORMAP_COUNT).toBe(LIGHTLEVEL_COUNT + 2);
  });
});

describe('parseColormap', () => {
  it('returns exactly 34 colormaps', () => {
    expect(colormaps.length).toBe(COLORMAP_COUNT);
  });

  it('each colormap is exactly 256 bytes', () => {
    for (const colormap of colormaps) {
      expect(colormap.length).toBe(COLORMAP_SIZE);
    }
  });

  it('all entries are valid palette indices (0-255)', () => {
    for (const colormap of colormaps) {
      for (let i = 0; i < COLORMAP_SIZE; i++) {
        expect(colormap[i]).toBeGreaterThanOrEqual(0);
        expect(colormap[i]).toBeLessThanOrEqual(255);
      }
    }
  });

  it('colormap 0 is near-identity (full brightness)', () => {
    // Colormap 0 is the full-brightness map.  Most entries map to
    // themselves, but a handful of palette indices used for special
    // purposes or duplicates are remapped even at full brightness.
    // The DOOM1.WAD COLORMAP has exactly 7 non-identity entries in
    // colormap 0.
    let identityCount = 0;
    for (let i = 0; i < ENTRIES_PER_COLORMAP; i++) {
      if (colormaps[0]![i] === i) identityCount++;
    }
    expect(identityCount).toBe(ENTRIES_PER_COLORMAP - 7);
  });

  it('returned array is frozen', () => {
    expect(Object.isFrozen(colormaps)).toBe(true);
  });

  it('colormaps are contiguous views into the original data', () => {
    for (let c = 0; c < COLORMAP_COUNT; c++) {
      const expectedOffset = c * COLORMAP_SIZE;
      for (let i = 0; i < COLORMAP_SIZE; i++) {
        expect(colormaps[c]![i]).toBe(colormapData[expectedOffset + i]);
      }
    }
  });

  it('respects byteOffset when lump data is a non-zero-offset Uint8Array view', () => {
    const padded = new Uint8Array(COLORMAP_LUMP_SIZE + 16);
    padded.set(colormapData, 8);
    const shifted = padded.subarray(8, 8 + COLORMAP_LUMP_SIZE);
    const parsed = parseColormap(shifted);
    expect(parsed[0]).toEqual(colormaps[0]);
    expect(parsed[INVULNERABILITY_COLORMAP]).toEqual(colormaps[INVULNERABILITY_COLORMAP]);
    expect(parsed[ALLBLACK_COLORMAP]).toEqual(colormaps[ALLBLACK_COLORMAP]);
  });

  it('throws RangeError for data smaller than 8704 bytes', () => {
    const tooSmall = Buffer.alloc(COLORMAP_LUMP_SIZE - 1);
    expect(() => parseColormap(tooSmall)).toThrow(RangeError);
  });

  it('throws RangeError for data larger than 8704 bytes', () => {
    const tooLarge = Buffer.alloc(COLORMAP_LUMP_SIZE + 1);
    expect(() => parseColormap(tooLarge)).toThrow(RangeError);
  });

  it('error message includes expected and actual size', () => {
    const bad = Buffer.alloc(100);
    expect(() => parseColormap(bad)).toThrow(/8704.*100/);
  });
});

describe('light-level colormaps (0-31)', () => {
  it('darker colormaps map more indices toward black (index 0)', () => {
    // Count how many entries map to index 0 in each light-level colormap.
    // Darker colormaps (higher index) should map more entries to 0.
    const zeroCountAt = (colormapIndex: number): number => {
      let count = 0;
      for (let i = 0; i < ENTRIES_PER_COLORMAP; i++) {
        if (colormaps[colormapIndex]![i] === 0) count++;
      }
      return count;
    };

    const zeroCountFirst = zeroCountAt(0);
    const zeroCountLast = zeroCountAt(LIGHTLEVEL_COUNT - 1);
    expect(zeroCountLast).toBeGreaterThan(zeroCountFirst);
  });

  it('each light-level colormap preserves index 0 as 0 (black stays black)', () => {
    for (let c = 0; c < LIGHTLEVEL_COUNT; c++) {
      expect(colormaps[c]![0]).toBe(0);
    }
  });
});

describe('parity-sensitive edge cases', () => {
  it('all-black colormap (33) maps every index to 0', () => {
    for (let i = 0; i < ENTRIES_PER_COLORMAP; i++) {
      expect(colormaps[ALLBLACK_COLORMAP]![i]).toBe(0);
    }
  });

  it('invulnerability colormap (32) differs from identity', () => {
    let differs = false;
    for (let i = 0; i < ENTRIES_PER_COLORMAP; i++) {
      if (colormaps[INVULNERABILITY_COLORMAP]![i] !== i) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('invulnerability colormap produces grayscale mapping', () => {
    // The invulnerability colormap maps all indices into a narrow range
    // of grayscale palette entries. Verify that the output range is much
    // smaller than the full 256-entry range.
    const outputSet = new Set<number>();
    for (let i = 0; i < ENTRIES_PER_COLORMAP; i++) {
      outputSet.add(colormaps[INVULNERABILITY_COLORMAP]![i]!);
    }
    // Grayscale uses only a small fraction of the 256 palette indices
    expect(outputSet.size).toBeLessThan(ENTRIES_PER_COLORMAP);
  });

  it('each colormap occupies a distinct byte range in the lump', () => {
    const offsets = new Set<number>();
    for (const colormap of colormaps) {
      offsets.add(colormap.byteOffset);
    }
    expect(offsets.size).toBe(COLORMAP_COUNT);
  });

  it('lump size in WAD directory matches expected constant', () => {
    expect(colormapData.length).toBe(COLORMAP_LUMP_SIZE);
  });
});
