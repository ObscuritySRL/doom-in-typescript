import { describe, expect, test } from 'bun:test';

import { buildFlatCatalog } from '../../src/assets/flats.ts';
import type { DirectoryEntry } from '../../src/wad/directory.ts';
import { SKY_FLAT_NAME, makeFlatNumberResolver, skyFlatNumber } from '../../src/render/flatNumberResolver.ts';

function entry(name: string): DirectoryEntry {
  return { offset: 0, size: name.startsWith('F_') || name === 'F1_START' || name === 'F1_END' ? 0 : 4096, name };
}

// F_START at index 0; content flats 1..6; F_END at index 7.
const DIRECTORY: readonly DirectoryEntry[] = [entry('F_START'), entry('FLOOR4_8'), entry('NUKAGE1'), entry('F_SKY1'), entry('F1_START'), entry('F1_END'), entry('FLAT5_5'), entry('F_END')];

describe('flatNumberResolver: R_FlatNumForName parity', () => {
  test('resolves each catalog entry to its firstflat-relative flat number', () => {
    const catalog = buildFlatCatalog(DIRECTORY);
    const flatNumber = makeFlatNumberResolver(catalog);
    for (const catalogEntry of catalog.entries) {
      expect(flatNumber(catalogEntry.name)).toBe(catalogEntry.flatNumber);
      // flatNumber == directoryIndex - firstFlatIndex (R_FlatNumForName i - firstflat).
      expect(catalogEntry.flatNumber).toBe(catalogEntry.directoryIndex - catalog.firstFlatIndex);
    }
    // F_START+1 is the first content flat → number 0.
    expect(flatNumber('FLOOR4_8')).toBe(0);
    expect(flatNumber('NUKAGE1')).toBe(1);
    expect(flatNumber('F_SKY1')).toBe(2);
  });

  test('lookup is case-insensitive and deterministic', () => {
    const flatNumber = makeFlatNumberResolver(buildFlatCatalog(DIRECTORY));
    expect(flatNumber('floor4_8')).toBe(flatNumber('FLOOR4_8'));
    expect(flatNumber('Nukage1')).toBe(flatNumber('NUKAGE1'));
    expect(makeFlatNumberResolver(buildFlatCatalog(DIRECTORY))('FLAT5_5')).toBe(flatNumber('FLAT5_5'));
  });

  test('skyFlatNumber resolves SKYFLATNAME (F_SKY1) to its flat number', () => {
    const catalog = buildFlatCatalog(DIRECTORY);
    expect(SKY_FLAT_NAME).toBe('F_SKY1');
    expect(skyFlatNumber(catalog)).toBe(makeFlatNumberResolver(catalog)('F_SKY1'));
    const skyEntry = catalog.entries.find((catalogEntry) => catalogEntry.name === 'F_SKY1');
    expect(skyFlatNumber(catalog)).toBe(skyEntry!.flatNumber);
  });

  test('a missing flat throws R_FlatNumForName I_Error parity', () => {
    const flatNumber = makeFlatNumberResolver(buildFlatCatalog(DIRECTORY));
    expect(() => flatNumber('BOGUSXYZ')).toThrow('R_FlatNumForName: BOGUSXYZ not found');
  });

  test('a duplicate flat name resolves to its last (highest directory index) occurrence', () => {
    const dup: readonly DirectoryEntry[] = [entry('F_START'), entry('FLOOR4_8'), entry('NUKAGE1'), entry('FLOOR4_8'), entry('F_END')];
    const catalog = buildFlatCatalog(dup);
    const flatNumber = makeFlatNumberResolver(catalog);
    const occurrences = catalog.entries.filter((catalogEntry) => catalogEntry.name === 'FLOOR4_8');
    expect(occurrences.length).toBe(2);
    const last = occurrences[occurrences.length - 1]!;
    expect(flatNumber('FLOOR4_8')).toBe(last.flatNumber);
    expect(last.flatNumber).toBeGreaterThan(occurrences[0]!.flatNumber);
  });
});
