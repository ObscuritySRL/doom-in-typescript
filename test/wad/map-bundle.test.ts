import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../src/wad/directory.ts';
import { MAP_LUMP_COUNT, MAP_LUMP_ORDER, findMapNames, isMapMarker, parseMapBundle } from '../../src/map/mapBundle.ts';
import type { MapLumpBundle, MapLumpName } from '../../src/map/mapBundle.ts';

import wadMapSummary from '../../reference/manifests/wad-map-summary.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

describe('MAP_LUMP_ORDER constant', () => {
  it('contains exactly 10 entries', () => {
    expect(MAP_LUMP_ORDER.length).toBe(10);
  });

  it('matches the canonical order from wad-map-summary.json', () => {
    const expected: string[] = wadMapSummary.mapLumpOrder;
    expect([...MAP_LUMP_ORDER] as string[]).toEqual(expected);
  });

  it('MAP_LUMP_COUNT equals MAP_LUMP_ORDER.length', () => {
    expect(MAP_LUMP_COUNT).toBe(MAP_LUMP_ORDER.length);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(MAP_LUMP_ORDER)).toBe(true);
  });

  it('entries are all uppercase ASCII', () => {
    for (const name of MAP_LUMP_ORDER) {
      expect(name).toMatch(/^[A-Z]+$/);
    }
  });
});

describe('isMapMarker', () => {
  it('recognises Doom 1 ExMy names', () => {
    expect(isMapMarker('E1M1')).toBe(true);
    expect(isMapMarker('E4M9')).toBe(true);
    expect(isMapMarker('E1M5')).toBe(true);
  });

  it('recognises Doom 2 MAPxx names', () => {
    expect(isMapMarker('MAP01')).toBe(true);
    expect(isMapMarker('MAP32')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isMapMarker('e1m1')).toBe(true);
    expect(isMapMarker('map01')).toBe(true);
  });

  it('rejects non-map lump names', () => {
    expect(isMapMarker('THINGS')).toBe(false);
    expect(isMapMarker('PLAYPAL')).toBe(false);
    expect(isMapMarker('E1')).toBe(false);
    expect(isMapMarker('MAP1')).toBe(false);
    expect(isMapMarker('E10M1')).toBe(false);
    expect(isMapMarker('MAP100')).toBe(false);
  });
});

describe('findMapNames with DOOM1.WAD', () => {
  const mapNames = findMapNames(directory);

  it('finds exactly 9 maps', () => {
    expect(mapNames.length).toBe(9);
  });

  it('returns E1M1 through E1M9 in order', () => {
    const expected = Array.from({ length: 9 }, (_, i) => `E1M${i + 1}`);
    expect([...mapNames]).toEqual(expected);
  });

  it('result is frozen', () => {
    expect(Object.isFrozen(mapNames)).toBe(true);
  });

  it('cross-references with wad-map-summary.json map names', () => {
    const summaryNames = wadMapSummary.maps.map((mapEntry: { name: string }) => mapEntry.name);
    expect([...mapNames]).toEqual(summaryNames);
  });
});

describe('parseMapBundle with DOOM1.WAD', () => {
  const e1m1 = parseMapBundle(directory, wadBuffer, 'E1M1');

  it('returns the uppercased map name', () => {
    expect(e1m1.name).toBe('E1M1');
  });

  it('markerIndex matches wad-map-summary.json', () => {
    expect(e1m1.markerIndex).toBe(wadMapSummary.maps[0]!.directoryIndex);
  });

  it('result is frozen', () => {
    expect(Object.isFrozen(e1m1)).toBe(true);
  });

  it('E1M1 THINGS size matches wad-map-summary.json', () => {
    const expected = wadMapSummary.maps[0]!.lumps[0]!;
    expect(expected.name).toBe('THINGS');
    expect(e1m1.things.length).toBe(expected.size);
  });

  it('E1M1 LINEDEFS size matches wad-map-summary.json', () => {
    const expected = wadMapSummary.maps[0]!.lumps[1]!;
    expect(expected.name).toBe('LINEDEFS');
    expect(e1m1.linedefs.length).toBe(expected.size);
  });

  it('E1M1 SIDEDEFS size matches wad-map-summary.json', () => {
    const expected = wadMapSummary.maps[0]!.lumps[2]!;
    expect(expected.name).toBe('SIDEDEFS');
    expect(e1m1.sidedefs.length).toBe(expected.size);
  });

  it('all 10 sub-lump sizes match wad-map-summary.json for E1M1', () => {
    const lumpKeys: (keyof MapLumpBundle)[] = ['things', 'linedefs', 'sidedefs', 'vertexes', 'segs', 'ssectors', 'nodes', 'sectors', 'reject', 'blockmap'];
    for (let index = 0; index < MAP_LUMP_COUNT; index++) {
      const expected = wadMapSummary.maps[0]!.lumps[index]!;
      const actual = e1m1[lumpKeys[index]!] as Buffer;
      expect(actual.length).toBe(expected.size);
    }
  });

  it('all 9 maps can be parsed without error', () => {
    for (const mapEntry of wadMapSummary.maps) {
      const bundle = parseMapBundle(directory, wadBuffer, mapEntry.name);
      expect(bundle.name).toBe(mapEntry.name);
      expect(bundle.markerIndex).toBe(mapEntry.directoryIndex);
    }
  });

  it('all 9 maps have sub-lump sizes matching wad-map-summary.json', () => {
    const lumpKeys: (keyof MapLumpBundle)[] = ['things', 'linedefs', 'sidedefs', 'vertexes', 'segs', 'ssectors', 'nodes', 'sectors', 'reject', 'blockmap'];
    for (const mapEntry of wadMapSummary.maps) {
      const bundle = parseMapBundle(directory, wadBuffer, mapEntry.name);
      for (let index = 0; index < MAP_LUMP_COUNT; index++) {
        const expected = mapEntry.lumps[index]!;
        const actual = bundle[lumpKeys[index]!] as Buffer;
        expect(actual.length).toBe(expected.size);
      }
    }
  });

  it('is case-insensitive for the map name', () => {
    const bundle = parseMapBundle(directory, wadBuffer, 'e1m1');
    expect(bundle.name).toBe('E1M1');
    expect(bundle.things.length).toBe(e1m1.things.length);
  });

  it('E1M8 has the smallest THINGS lump', () => {
    let smallest = Infinity;
    let smallestMap = '';
    for (const mapEntry of wadMapSummary.maps) {
      const bundle = parseMapBundle(directory, wadBuffer, mapEntry.name);
      if (bundle.things.length < smallest) {
        smallest = bundle.things.length;
        smallestMap = bundle.name;
      }
    }
    expect(smallestMap).toBe('E1M8');
  });

  it('sub-lump data buffers are non-empty for all E1M1 lumps', () => {
    expect(e1m1.things.length).toBeGreaterThan(0);
    expect(e1m1.linedefs.length).toBeGreaterThan(0);
    expect(e1m1.sidedefs.length).toBeGreaterThan(0);
    expect(e1m1.vertexes.length).toBeGreaterThan(0);
    expect(e1m1.segs.length).toBeGreaterThan(0);
    expect(e1m1.ssectors.length).toBeGreaterThan(0);
    expect(e1m1.nodes.length).toBeGreaterThan(0);
    expect(e1m1.sectors.length).toBeGreaterThan(0);
    expect(e1m1.reject.length).toBeGreaterThan(0);
    expect(e1m1.blockmap.length).toBeGreaterThan(0);
  });

  it('map marker lump itself has zero size', () => {
    const entry = directory[e1m1.markerIndex]!;
    expect(entry.size).toBe(0);
  });

  it('consecutive map markers are spaced 11 entries apart (1 marker + 10 sub-lumps)', () => {
    const mapNames = findMapNames(directory);
    for (let index = 1; index < mapNames.length; index++) {
      const previous = parseMapBundle(directory, wadBuffer, mapNames[index - 1]!);
      const current = parseMapBundle(directory, wadBuffer, mapNames[index]!);
      expect(current.markerIndex - previous.markerIndex).toBe(MAP_LUMP_COUNT + 1);
    }
  });
});

describe('parseMapBundle error handling', () => {
  it('throws Error for non-existent map name', () => {
    expect(() => parseMapBundle(directory, wadBuffer, 'E2M1')).toThrow('W_GetNumForName: E2M1 not found!');
  });

  it('throws RangeError when sub-lump name does not match canonical order', () => {
    const corrupted: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'E1M1' },
      { offset: 0, size: 10, name: 'LINEDEFS' },
      ...Array.from({ length: 9 }, (_, index) => ({
        offset: 0,
        size: 10,
        name: MAP_LUMP_ORDER[index + 1] ?? 'EXTRA',
      })),
    ];
    expect(() => parseMapBundle(corrupted, wadBuffer, 'E1M1')).toThrow(/expected THINGS, got LINEDEFS/);
  });

  it('throws RangeError when fewer than 10 lumps follow the marker', () => {
    const truncated: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'E1M1' },
      { offset: 0, size: 10, name: 'THINGS' },
    ];
    expect(() => parseMapBundle(truncated, wadBuffer, 'E1M1')).toThrow(/needs 10 sub-lumps/);
  });
});

describe('compile-time type satisfaction', () => {
  it('MapLumpBundle interface has all 10 sub-lump fields', () => {
    const bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
    const lumpKeys: MapLumpName[] = [...MAP_LUMP_ORDER];
    for (const key of lumpKeys) {
      const lowerKey = key.toLowerCase() as keyof MapLumpBundle;
      expect(bundle[lowerKey]).toBeInstanceOf(Buffer);
    }
  });
});
