import { describe, expect, test } from 'bun:test';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';

import { buildFlatCache, getFlatCacheEntry } from '../../../src/assets/build-flat-cache.ts';
import { FLAT_LUMP_BYTES, parseFlatNamespace } from '../../../src/assets/parse-flat-namespace.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';

describe('buildFlatCache', () => {
  test('builds a static cache with firstflat-relative entries and copied pixels', () => {
    const firstFlatPixels = createFlatPixels(11);
    const secondFlatPixels = createFlatPixels(22);
    const wadBuffer = Buffer.concat([firstFlatPixels, secondFlatPixels]);
    const directory = buildSyntheticDirectory([
      { name: 'PLAYPAL' },
      { name: 'F_START' },
      { name: 'F1_START' },
      { name: 'FLAT_A', offset: 0, size: FLAT_LUMP_BYTES },
      { name: 'FLAT_B', offset: FLAT_LUMP_BYTES, size: FLAT_LUMP_BYTES },
      { name: 'F1_END' },
      { name: 'F_END' },
    ]);

    const cache = buildFlatCache({ directory, wadBuffer });
    const firstFlat = getFlatCacheEntry(cache, 'flat_a');
    const secondFlat = getFlatCacheEntry(cache, 'FLAT_B');

    if (firstFlat === null || secondFlat === null || firstFlat.pixels === null || secondFlat.pixels === null) {
      throw new Error('expected cached flat pixel entries');
    }

    expect(Object.isFrozen(cache)).toBe(true);
    expect(Object.isFrozen(cache.entries)).toBe(true);
    expect(Object.isFrozen(cache.entries[0])).toBe(true);
    expect(cache.category).toBe('static');
    expect(cache.entries).toHaveLength(4);
    expect(cache.entries[0]!.isInnerMarker).toBe(true);
    expect(cache.entries[0]!.pixels).toBeNull();
    expect(cache.entries[3]!.isInnerMarker).toBe(true);
    expect(cache.entries[3]!.pixels).toBeNull();
    expect(cache.flatNameToNumber.get('FLAT_A')).toBe(1);
    expect(cache.namespace.flatTranslationSlotCount).toBe(5);
    expect(cache.tag).toBe('PU_STATIC');
    expect(firstFlat.flatNumber).toBe(1);
    expect(secondFlat.flatNumber).toBe(2);
    expect(Array.from(firstFlat.pixels.subarray(0, 4))).toEqual([11, 11, 11, 11]);
    expect(Array.from(secondFlat.pixels.subarray(0, 4))).toEqual([22, 22, 22, 22]);

    firstFlatPixels.fill(99);
    expect(Array.from(firstFlat.pixels.subarray(0, 4))).toEqual([11, 11, 11, 11]);
  });

  test('rejects a non-marker flat lump whose byte size is not 4096', () => {
    const directory = buildSyntheticDirectory([{ name: 'F_START' }, { name: 'BADFLAT', offset: 0, size: FLAT_LUMP_BYTES - 1 }, { name: 'F_END' }]);

    expect(() => buildFlatCache({ directory, wadBuffer: Buffer.alloc(FLAT_LUMP_BYTES - 1) })).toThrow('buildFlatCache: flat BADFLAT must be 4096 bytes, got 4095');
  });

  test('accepts a pre-parsed namespace and resolves duplicate flat names with the last entry winning', () => {
    const firstFlatPixels = createFlatPixels(1);
    const secondFlatPixels = createFlatPixels(2);
    const wadBuffer = Buffer.concat([firstFlatPixels, secondFlatPixels]);
    const directory = buildSyntheticDirectory([{ name: 'F_START' }, { name: 'DUPFLAT', offset: 0, size: FLAT_LUMP_BYTES }, { name: 'DUPFLAT', offset: FLAT_LUMP_BYTES, size: FLAT_LUMP_BYTES }, { name: 'F_END' }]);
    const namespace = parseFlatNamespace(directory);

    const cache = buildFlatCache({ directory, namespace, wadBuffer });
    const duplicateFlat = getFlatCacheEntry(cache, 'dupflat');

    if (duplicateFlat === null || duplicateFlat.pixels === null) {
      throw new Error('expected duplicate flat lookup to resolve to cached pixels');
    }

    expect(cache.namespace).toBe(namespace);
    expect(cache.flatNameToNumber.get('DUPFLAT')).toBe(1);
    expect(duplicateFlat.flatNumber).toBe(1);
    expect(Array.from(duplicateFlat.pixels.subarray(0, 4))).toEqual([2, 2, 2, 2]);
  });

  test('builds the shareware DOOM1 flat cache from the local IWAD', async () => {
    const wadBuffer = Buffer.from(await Bun.file('iwad/DOOM1.WAD').arrayBuffer());
    const header = parseWadHeader(wadBuffer);
    const directory = parseWadDirectory(wadBuffer, header);
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { flat: number } };

    const cache = buildFlatCache({ directory, wadBuffer });
    const floor = getFlatCacheEntry(cache, 'floor0_1');
    const sky = getFlatCacheEntry(cache, 'F_SKY1');

    if (floor === null || sky === null || floor.pixels === null || sky.pixels === null) {
      throw new Error('expected shareware flat pixel entries');
    }

    const floorDirectoryEntry = directory[floor.directoryIndex]!;
    const skyDirectoryEntry = directory[sky.directoryIndex]!;

    expect(cache.category).toBe('static');
    expect(cache.entries).toHaveLength(56);
    expect(cache.entries.filter((entry) => !entry.isInnerMarker)).toHaveLength(54);
    expect(cache.entries[0]!.name).toBe('F1_START');
    expect(cache.entries[0]!.pixels).toBeNull();
    expect(cache.entries[55]!.name).toBe('F1_END');
    expect(cache.entries[55]!.pixels).toBeNull();
    expect(cache.tag).toBe('PU_STATIC');
    expect(floor.flatNumber).toBe(1);
    expect(floor.pixels.length).toBe(FLAT_LUMP_BYTES);
    expect(sky.flatNumber).toBe(54);
    expect(sky.pixels.length).toBe(FLAT_LUMP_BYTES);
    expect(Array.from(floor.pixels.subarray(0, 16))).toEqual(Array.from(wadBuffer.subarray(floorDirectoryEntry.offset, floorDirectoryEntry.offset + 16)));
    expect(Array.from(sky.pixels.subarray(0, 16))).toEqual(Array.from(wadBuffer.subarray(skyDirectoryEntry.offset, skyDirectoryEntry.offset + 16)));
    expect(manifest.lumpCategories.flat).toBe(cache.entries.length);
  });
});

function buildSyntheticDirectory(entries: ReadonlyArray<{ readonly name: string; readonly offset?: number; readonly size?: number }>): readonly DirectoryEntry[] {
  return Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        name: entry.name,
        offset: entry.offset ?? 0,
        size: entry.size ?? 0,
      }),
    ),
  );
}

function createFlatPixels(value: number): Buffer {
  return Buffer.alloc(FLAT_LUMP_BYTES, value);
}
