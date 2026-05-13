import { describe, expect, test } from 'bun:test';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import { VANILLA_SHAREWARE_DOOM1_LUMP_COUNT, VANILLA_SHAREWARE_WAD_TYPE, compareLocalDoom1WadManifest } from '../../../src/assets/compare-local-doom1-wad-manifest.ts';

function makeDirectory(entries: readonly { readonly name: string; readonly offset: number; readonly size: number }[]): DirectoryEntry[] {
  return entries.map((entry) => ({ name: entry.name, offset: entry.offset, size: entry.size }));
}

describe('vanilla shareware DOOM1.WAD manifest constants', () => {
  test('shareware DOOM1.WAD total lump count is 1264', () => {
    expect(VANILLA_SHAREWARE_DOOM1_LUMP_COUNT).toBe(1264);
  });

  test('shareware wad type is IWAD', () => {
    expect(VANILLA_SHAREWARE_WAD_TYPE).toBe('IWAD');
  });
});

describe('compareLocalDoom1WadManifest', () => {
  test('accepts a directory whose count matches and maps line up', () => {
    const directory: DirectoryEntry[] = makeDirectory([
      { name: 'A', offset: 0, size: 0 },
      { name: 'E1M1', offset: 67500, size: 0 },
      { name: 'THINGS', offset: 67500, size: 1380 },
    ]);
    const decision = compareLocalDoom1WadManifest({
      directory,
      expected: {
        totalLumps: 3,
        wadType: 'IWAD',
        maps: [
          {
            name: 'E1M1',
            directoryIndex: 1,
            lumps: [{ name: 'THINGS', offset: 67500, size: 1380 }],
          },
        ],
      },
    });
    expect(decision.accepted).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags wrong_total_lump_count when directory size differs', () => {
    const decision = compareLocalDoom1WadManifest({
      directory: makeDirectory([{ name: 'A', offset: 0, size: 0 }]),
      expected: { totalLumps: 2, wadType: 'IWAD', maps: [] },
    });
    expect(decision.violations).toContain('wrong_total_lump_count');
  });

  test('flags missing_map when the map name does not match the directory index', () => {
    const decision = compareLocalDoom1WadManifest({
      directory: makeDirectory([
        { name: 'A', offset: 0, size: 0 },
        { name: 'WRONG', offset: 100, size: 0 },
      ]),
      expected: {
        totalLumps: 2,
        wadType: 'IWAD',
        maps: [{ name: 'E1M1', directoryIndex: 1, lumps: [] }],
      },
    });
    expect(decision.violations).toContain('missing_map');
  });

  test('flags lump_offset_mismatch and lump_size_mismatch independently', () => {
    const directory: DirectoryEntry[] = makeDirectory([
      { name: 'E1M1', offset: 0, size: 0 },
      { name: 'THINGS', offset: 999, size: 1 },
    ]);
    const decision = compareLocalDoom1WadManifest({
      directory,
      expected: {
        totalLumps: 2,
        wadType: 'IWAD',
        maps: [
          {
            name: 'E1M1',
            directoryIndex: 0,
            lumps: [{ name: 'THINGS', offset: 67500, size: 1380 }],
          },
        ],
      },
    });
    expect(decision.violations).toContain('lump_offset_mismatch');
    expect(decision.violations).toContain('lump_size_mismatch');
  });
});
