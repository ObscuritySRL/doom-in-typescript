import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../src/wad/directory.ts';
import { FLAT_HEIGHT, FLAT_SIZE, FLAT_WIDTH, buildFlatCatalog } from '../../src/assets/flats.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const catalog = buildFlatCatalog(directory);

describe('flat constants', () => {
  it('FLAT_WIDTH is 64', () => {
    expect(FLAT_WIDTH).toBe(64);
  });

  it('FLAT_HEIGHT is 64', () => {
    expect(FLAT_HEIGHT).toBe(64);
  });

  it('FLAT_SIZE is 4096 (64 * 64)', () => {
    expect(FLAT_SIZE).toBe(4096);
    expect(FLAT_SIZE).toBe(FLAT_WIDTH * FLAT_HEIGHT);
  });
});

describe('buildFlatCatalog with DOOM1.WAD', () => {
  it('finds 56 total entries between F_START and F_END', () => {
    expect(catalog.count).toBe(56);
  });

  it('finds 54 data flats (excludes F1_START and F1_END inner markers)', () => {
    expect(catalog.dataCount).toBe(54);
  });

  it('entries array length matches count', () => {
    expect(catalog.entries.length).toBe(catalog.count);
  });

  it('firstFlatIndex and lastFlatIndex span the correct range', () => {
    expect(catalog.lastFlatIndex - catalog.firstFlatIndex + 1).toBe(catalog.count);
  });

  it('first entry is F1_START inner marker', () => {
    const first = catalog.entries[0]!;
    expect(first.name).toBe('F1_START');
    expect(first.isMarker).toBe(true);
    expect(first.flatNumber).toBe(0);
  });

  it('last entry is F1_END inner marker', () => {
    const last = catalog.entries[catalog.entries.length - 1]!;
    expect(last.name).toBe('F1_END');
    expect(last.isMarker).toBe(true);
    expect(last.flatNumber).toBe(catalog.count - 1);
  });

  it('flat numbers are sequential starting at 0', () => {
    for (let i = 0; i < catalog.entries.length; i++) {
      expect(catalog.entries[i]!.flatNumber).toBe(i);
    }
  });

  it('directory indices are sequential', () => {
    for (let i = 0; i < catalog.entries.length; i++) {
      expect(catalog.entries[i]!.directoryIndex).toBe(catalog.firstFlatIndex + i);
    }
  });

  it('exactly two entries are inner markers', () => {
    const markers = catalog.entries.filter((entry) => entry.isMarker);
    expect(markers.length).toBe(2);
    expect(markers[0]!.name).toBe('F1_START');
    expect(markers[1]!.name).toBe('F1_END');
  });

  it('all data flat names are non-empty uppercase ASCII', () => {
    for (const entry of catalog.entries) {
      if (!entry.isMarker) {
        expect(entry.name.length).toBeGreaterThan(0);
        expect(entry.name).toBe(entry.name.toUpperCase());
        expect(entry.name).toMatch(/^[A-Z0-9_]+$/);
      }
    }
  });

  it('all data flats are exactly FLAT_SIZE (4096) bytes in the WAD', () => {
    for (const entry of catalog.entries) {
      if (!entry.isMarker) {
        const dirEntry = directory[entry.directoryIndex]!;
        expect(dirEntry.size).toBe(FLAT_SIZE);
      }
    }
  });

  it('inner markers have zero size in the WAD', () => {
    for (const entry of catalog.entries) {
      if (entry.isMarker) {
        const dirEntry = directory[entry.directoryIndex]!;
        expect(dirEntry.size).toBe(0);
      }
    }
  });

  it('NUKAGE1 is present as a data flat', () => {
    const nukage = catalog.entries.find((entry) => entry.name === 'NUKAGE1' && !entry.isMarker);
    expect(nukage).toBeDefined();
  });

  it('FLOOR0_1 is present as a data flat', () => {
    const floor = catalog.entries.find((entry) => entry.name === 'FLOOR0_1' && !entry.isMarker);
    expect(floor).toBeDefined();
  });

  it('returned catalog is frozen', () => {
    expect(Object.isFrozen(catalog)).toBe(true);
  });

  it('entries array is frozen', () => {
    expect(Object.isFrozen(catalog.entries)).toBe(true);
  });

  it('all entry names match their WAD directory entry names', () => {
    for (const entry of catalog.entries) {
      const dirEntry = directory[entry.directoryIndex]!;
      expect(entry.name).toBe(dirEntry.name);
    }
  });

  it('no duplicate flat names among data entries', () => {
    const dataNames = catalog.entries.filter((entry) => !entry.isMarker).map((entry) => entry.name);
    const unique = new Set(dataNames);
    expect(unique.size).toBe(dataNames.length);
  });
});

describe('parity-sensitive edge cases', () => {
  it('inner markers get flat numbers (vanilla R_InitFlats counts all entries)', () => {
    const f1Start = catalog.entries.find((entry) => entry.name === 'F1_START')!;
    const f1End = catalog.entries.find((entry) => entry.name === 'F1_END')!;
    expect(f1Start.flatNumber).toBeGreaterThanOrEqual(0);
    expect(f1End.flatNumber).toBeGreaterThanOrEqual(0);
    expect(f1Start.flatNumber).toBeLessThan(f1End.flatNumber);
  });

  it('flat count matches wad-directory-summary markerCounts.flats', () => {
    expect(catalog.count).toBe(56);
  });

  it('data flat count + inner marker count = total count', () => {
    const markerCount = catalog.entries.filter((entry) => entry.isMarker).length;
    expect(catalog.dataCount + markerCount).toBe(catalog.count);
  });

  it('flat number is the index into the flat range, not the WAD directory index', () => {
    for (const entry of catalog.entries) {
      expect(entry.flatNumber).toBe(entry.directoryIndex - catalog.firstFlatIndex);
    }
  });
});

describe('error cases', () => {
  it('throws when F_START marker is missing', () => {
    const noStart: DirectoryEntry[] = [
      { offset: 0, size: 4096, name: 'FLAT1' },
      { offset: 0, size: 0, name: 'F_END' },
    ];
    expect(() => buildFlatCatalog(noStart)).toThrow(/F_START not found/);
  });

  it('throws when F_END marker is missing', () => {
    const noEnd: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'F_START' },
      { offset: 0, size: 4096, name: 'FLAT1' },
    ];
    expect(() => buildFlatCatalog(noEnd)).toThrow(/F_END not found/);
  });

  it('handles empty flat range (adjacent markers)', () => {
    const empty: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'F_START' },
      { offset: 0, size: 0, name: 'F_END' },
    ];
    const result = buildFlatCatalog(empty);
    expect(result.count).toBe(0);
    expect(result.dataCount).toBe(0);
    expect(result.entries.length).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('handles flat range with no inner markers', () => {
    const noInner: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'F_START' },
      { offset: 0, size: 4096, name: 'FLAT1' },
      { offset: 0, size: 4096, name: 'FLAT2' },
      { offset: 0, size: 0, name: 'F_END' },
    ];
    const result = buildFlatCatalog(noInner);
    expect(result.count).toBe(2);
    expect(result.dataCount).toBe(2);
    expect(result.entries[0]!.isMarker).toBe(false);
    expect(result.entries[1]!.isMarker).toBe(false);
  });
});
