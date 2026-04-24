import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';

import summary from '../../reference/manifests/wad-map-summary.json';

describe('wad-map-summary.json manifest', () => {
  it('identifies the WAD as an IWAD', () => {
    expect(summary.wadType).toBe('IWAD');
  });

  it('records the pinned total lump count', () => {
    expect(summary.totalLumps).toBe(PRIMARY_TARGET.wadLumpCount);
  });

  it('contains exactly 9 maps for the shareware episode', () => {
    expect(summary.maps).toHaveLength(9);
  });

  it('lists maps E1M1 through E1M9 in order', () => {
    const names = summary.maps.map((map) => map.name);
    const expected = Array.from({ length: 9 }, (_, index) => `E1M${index + 1}`);
    expect(names).toEqual(expected);
  });

  it('assigns each map exactly 10 sub-lumps', () => {
    for (const map of summary.maps) {
      expect(map.lumps).toHaveLength(10);
    }
  });

  it('orders sub-lumps per the canonical map lump sequence', () => {
    for (const map of summary.maps) {
      const lumpNames = map.lumps.map((lump) => lump.name);
      expect(lumpNames).toEqual(summary.mapLumpOrder);
    }
  });

  it('records positive offsets and sizes for all map sub-lumps', () => {
    for (const map of summary.maps) {
      for (const lump of map.lumps) {
        expect(lump.offset).toBeGreaterThan(0);
        expect(lump.size).toBeGreaterThan(0);
      }
    }
  });

  it('assigns increasing directory indices across maps', () => {
    for (let index = 1; index < summary.maps.length; index++) {
      expect(summary.maps[index]!.directoryIndex).toBeGreaterThan(summary.maps[index - 1]!.directoryIndex);
    }
  });

  it('has lump category counts that sum to the total lump count', () => {
    const categorySum = Object.values(summary.lumpCategories).reduce((accumulator, count) => accumulator + count, 0);
    expect(categorySum).toBe(summary.totalLumps);
  });

  it('records 18 distinct lump categories', () => {
    expect(Object.keys(summary.lumpCategories)).toHaveLength(18);
  });

  it('sorts lump category keys in ASCIIbetical order', () => {
    const keys = Object.keys(summary.lumpCategories);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it('lists sprites as the largest lump category', () => {
    const maxCategory = Object.entries(summary.lumpCategories).reduce((best, [key, count]) => (count > best[1] ? [key, count] : best), ['', 0]);
    expect(maxCategory[0]).toBe('sprite');
    expect(maxCategory[1]).toBe(483);
  });

  it('records matching counts for DP and DS sound lumps', () => {
    expect(summary.lumpCategories['pc-speaker-sound']).toBe(55);
    expect(summary.lumpCategories['sound-effect']).toBe(55);
  });

  it('records the mapLumpOrder as the 10 canonical map sub-lump names', () => {
    expect(summary.mapLumpOrder).toEqual(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']);
  });

  it('has E1M8 as the smallest map by THINGS lump size', () => {
    const smallestThings = summary.maps.reduce(
      (best, map) => {
        const thingsSize = map.lumps.find((lump) => lump.name === 'THINGS')!.size;
        return thingsSize < best.size ? { name: map.name, size: thingsSize } : best;
      },
      { name: '', size: Infinity },
    );
    expect(smallestThings.name).toBe('E1M8');
  });

  it('records map-data count as exactly 9 maps times 10 sub-lumps', () => {
    expect(summary.lumpCategories['map-data']).toBe(summary.maps.length * summary.mapLumpOrder.length);
  });

  it('records exactly 13 music lumps for episode 1 plus title and intermission', () => {
    expect(summary.lumpCategories.music).toBe(13);
  });

  it('has unique map names', () => {
    const names = summary.maps.map((map) => map.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
