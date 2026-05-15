import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { COLORMAP_COUNT, COLORMAP_LUMP_SIZE, COLORMAP_SIZE, ENTRIES_PER_COLORMAP } from '../../../src/assets/colormap.ts';
import { NUMBONUSPALS, NUMREDPALS, PALETTE_COUNT, PALETTE_SIZE, PLAYPAL_SIZE, RADIATIONPAL, STARTBONUSPALS, STARTREDPALS } from '../../../src/assets/playpal.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import type { IwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { PaletteAndColormapError, VANILLA_COLORMAP_LUMP_NAME, VANILLA_GAMMA_INDEX_RANGE, VANILLA_PLAYPAL_LUMP_NAME, buildPaletteAndColormap } from '../../../src/vanilla/paletteAndColormap.ts';
import type { LumpReader, PaletteAndColormapResources, VanillaPaletteEffect } from '../../../src/vanilla/paletteAndColormap.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const PALETTE_AND_COLORMAP_RELATIVE_PATH = 'src/vanilla/paletteAndColormap.ts';
const PALETTE_AND_COLORMAP_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, PALETTE_AND_COLORMAP_RELATIVE_PATH);

function buildSyntheticPlaypalBytes(): Uint8Array {
  const bytes = new Uint8Array(PLAYPAL_SIZE);
  for (let paletteIndex = 0; paletteIndex < PALETTE_COUNT; paletteIndex += 1) {
    const paletteOffset = paletteIndex * PALETTE_SIZE;
    for (let entryIndex = 0; entryIndex < 256; entryIndex += 1) {
      const entryOffset = paletteOffset + entryIndex * 3;
      bytes[entryOffset] = (paletteIndex + entryIndex) & 0xff;
      bytes[entryOffset + 1] = (paletteIndex * 2 + entryIndex) & 0xff;
      bytes[entryOffset + 2] = (paletteIndex * 3 + entryIndex) & 0xff;
    }
  }
  return bytes;
}

function buildSyntheticColormapBytes(): Uint8Array {
  const bytes = new Uint8Array(COLORMAP_LUMP_SIZE);
  for (let colormapIndex = 0; colormapIndex < COLORMAP_COUNT; colormapIndex += 1) {
    const colormapOffset = colormapIndex * COLORMAP_SIZE;
    for (let paletteIndex = 0; paletteIndex < ENTRIES_PER_COLORMAP; paletteIndex += 1) {
      bytes[colormapOffset + paletteIndex] = (colormapIndex + paletteIndex) & 0xff;
    }
  }
  return bytes;
}

function buildStubResourceCache(options: { readonly colormapEntry: DirectoryEntry | null; readonly playpalEntry: DirectoryEntry | null }): IwadResourceCache {
  return {
    directory: Object.freeze([]),
    findLump: (lumpName: string): DirectoryEntry | null => {
      if (lumpName === VANILLA_PLAYPAL_LUMP_NAME) {
        return options.playpalEntry;
      }
      if (lumpName === VANILLA_COLORMAP_LUMP_NAME) {
        return options.colormapEntry;
      }
      return null;
    },
    gameIdentification: Object.freeze({ episodeCount: 1, gameDescription: 'DOOM Shareware', gameMission: 'doom', gameMode: 'shareware' }),
    getAllIndicesForName: (): readonly number[] => Object.freeze([]),
    hasLump: (lumpName: string): boolean => lumpName === VANILLA_PLAYPAL_LUMP_NAME || lumpName === VANILLA_COLORMAP_LUMP_NAME,
    lumpCount: 2,
    resolvedPath: 'synthetic://stub.wad',
    wadHeader: Object.freeze({ directoryOffset: 0, lumpCount: 2, type: 'IWAD' }),
  };
}

function buildLumpReaderFromBytes(playpal: Uint8Array | null, colormap: Uint8Array | null): LumpReader {
  return Object.freeze({
    readLumpBytes: (entry: DirectoryEntry): Uint8Array => {
      if (entry.name === 'PLAYPAL' && playpal !== null) {
        return playpal;
      }
      if (entry.name === 'COLORMAP' && colormap !== null) {
        return colormap;
      }
      throw new Error(`unexpected entry ${entry.name}`);
    },
  });
}

function syntheticEntry(name: 'COLORMAP' | 'PLAYPAL', size: number): DirectoryEntry {
  return Object.freeze({ name, offset: 0, size });
}

describe('plan_final wad: wire-playpal-colormap', () => {
  test('src/vanilla/paletteAndColormap.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(PALETTE_AND_COLORMAP_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(PALETTE_AND_COLORMAP_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/paletteAndColormap.ts cites plan_final step 05-002 in a top-of-file comment', () => {
    const fileText = readFileSync(PALETTE_AND_COLORMAP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('05-002');
    expect(fileText).toContain('buildPaletteAndColormap');
  });

  test('src/vanilla/paletteAndColormap.ts imports the read-only parsePlaypal and parseColormap helpers without modifying them', () => {
    const fileText = readFileSync(PALETTE_AND_COLORMAP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../assets/playpal.ts'");
    expect(fileText).toContain("from '../assets/colormap.ts'");
    expect(fileText).toContain('parsePlaypal');
    expect(fileText).toContain('parseColormap');
  });

  test('VANILLA_PLAYPAL_LUMP_NAME and VANILLA_COLORMAP_LUMP_NAME pin the canonical PLAYPAL/COLORMAP basenames', () => {
    expect(VANILLA_PLAYPAL_LUMP_NAME).toBe('PLAYPAL');
    expect(VANILLA_COLORMAP_LUMP_NAME).toBe('COLORMAP');
  });

  test('VANILLA_GAMMA_INDEX_RANGE pins the 0..4 range of usegamma values with a frozen result', () => {
    expect(VANILLA_GAMMA_INDEX_RANGE.minimum).toBe(0);
    expect(VANILLA_GAMMA_INDEX_RANGE.maximum).toBe(4);
    expect(VANILLA_GAMMA_INDEX_RANGE.count).toBe(5);
    expect(Object.isFrozen(VANILLA_GAMMA_INDEX_RANGE)).toBe(true);
  });

  test('buildPaletteAndColormap returns 14 palettes and 34 colormaps from valid lump bytes', () => {
    const cache = buildStubResourceCache({
      colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
      playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
    });
    const reader = buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes());
    const resources: PaletteAndColormapResources = buildPaletteAndColormap(cache, reader);
    expect(resources.palettes.length).toBe(PALETTE_COUNT);
    expect(resources.colormaps.length).toBe(COLORMAP_COUNT);
    for (let paletteIndex = 0; paletteIndex < PALETTE_COUNT; paletteIndex += 1) {
      expect(resources.palettes[paletteIndex]!.length).toBe(PALETTE_SIZE);
    }
    for (let colormapIndex = 0; colormapIndex < COLORMAP_COUNT; colormapIndex += 1) {
      expect(resources.colormaps[colormapIndex]!.length).toBe(COLORMAP_SIZE);
    }
  });

  test('buildPaletteAndColormap returns a frozen result whose palette and colormap arrays are also frozen', () => {
    const cache = buildStubResourceCache({
      colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
      playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
    });
    const reader = buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes());
    const resources = buildPaletteAndColormap(cache, reader);
    expect(Object.isFrozen(resources)).toBe(true);
    expect(Object.isFrozen(resources.palettes)).toBe(true);
    expect(Object.isFrozen(resources.colormaps)).toBe(true);
  });

  test('selectEffectPalette returns 0 for normal effect', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    expect(resources.selectEffectPalette({ kind: 'normal' })).toBe(0);
  });

  test('selectEffectPalette returns the radiation index for radiation effect', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    expect(resources.selectEffectPalette({ kind: 'radiation' })).toBe(RADIATIONPAL);
  });

  test('selectEffectPalette maps damage intensities 1..8 onto the canonical red-tint sub-range', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    for (let intensity = 1; intensity <= NUMREDPALS; intensity += 1) {
      expect(resources.selectEffectPalette({ intensity, kind: 'damage' })).toBe(STARTREDPALS + intensity - 1);
    }
  });

  test('selectEffectPalette clamps damage intensity above 8 to the canonical maximum', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    expect(resources.selectEffectPalette({ intensity: 100, kind: 'damage' })).toBe(STARTREDPALS + NUMREDPALS - 1);
  });

  test('selectEffectPalette maps bonus intensities 1..4 onto the canonical gold-tint sub-range', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    for (let intensity = 1; intensity <= NUMBONUSPALS; intensity += 1) {
      expect(resources.selectEffectPalette({ intensity, kind: 'bonus' })).toBe(STARTBONUSPALS + intensity - 1);
    }
  });

  test('selectEffectPalette clamps bonus intensity above 4 to the canonical maximum', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    expect(resources.selectEffectPalette({ intensity: 100, kind: 'bonus' })).toBe(STARTBONUSPALS + NUMBONUSPALS - 1);
  });

  test('selectEffectPalette returns the normal index when damage or bonus intensity is zero, negative, or NaN', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    expect(resources.selectEffectPalette({ intensity: 0, kind: 'damage' })).toBe(0);
    expect(resources.selectEffectPalette({ intensity: -5, kind: 'damage' })).toBe(0);
    expect(resources.selectEffectPalette({ intensity: 0, kind: 'bonus' })).toBe(0);
    expect(resources.selectEffectPalette({ intensity: Number.NaN, kind: 'bonus' })).toBe(0);
  });

  test('selectEffectPalette truncates fractional damage intensities to the integer sub-range index', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    expect(resources.selectEffectPalette({ intensity: 1.7, kind: 'damage' })).toBe(STARTREDPALS);
    expect(resources.selectEffectPalette({ intensity: 3.99, kind: 'damage' })).toBe(STARTREDPALS + 2);
  });

  test('every VanillaPaletteEffect kind produces an index inside the canonical [0, 13] palette range', () => {
    const resources = buildPaletteAndColormap(
      buildStubResourceCache({
        colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
        playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
      }),
      buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), buildSyntheticColormapBytes()),
    );
    const cases: readonly VanillaPaletteEffect[] = [{ kind: 'normal' }, { kind: 'radiation' }, { intensity: 8, kind: 'damage' }, { intensity: 4, kind: 'bonus' }, { intensity: 1, kind: 'damage' }, { intensity: 1, kind: 'bonus' }];
    for (const effect of cases) {
      const index = resources.selectEffectPalette(effect);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(PALETTE_COUNT);
    }
  });

  test('buildPaletteAndColormap throws PaletteAndColormapError with reason playpal-lump-missing when PLAYPAL is absent', () => {
    const cache = buildStubResourceCache({ colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE), playpalEntry: null });
    const reader = buildLumpReaderFromBytes(null, buildSyntheticColormapBytes());
    let caughtError: unknown;
    try {
      buildPaletteAndColormap(cache, reader);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(PaletteAndColormapError);
    expect((caughtError as PaletteAndColormapError).reason).toBe('playpal-lump-missing');
    expect((caughtError as PaletteAndColormapError).lumpName).toBe('PLAYPAL');
  });

  test('buildPaletteAndColormap throws PaletteAndColormapError with reason colormap-lump-missing when COLORMAP is absent', () => {
    const cache = buildStubResourceCache({ colormapEntry: null, playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE) });
    const reader = buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), null);
    let caughtError: unknown;
    try {
      buildPaletteAndColormap(cache, reader);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(PaletteAndColormapError);
    expect((caughtError as PaletteAndColormapError).reason).toBe('colormap-lump-missing');
    expect((caughtError as PaletteAndColormapError).lumpName).toBe('COLORMAP');
  });

  test('buildPaletteAndColormap throws PaletteAndColormapError with reason playpal-lump-wrong-size when PLAYPAL bytes mismatch the expected length', () => {
    const cache = buildStubResourceCache({
      colormapEntry: syntheticEntry('COLORMAP', COLORMAP_LUMP_SIZE),
      playpalEntry: syntheticEntry('PLAYPAL', 100),
    });
    const reader = buildLumpReaderFromBytes(new Uint8Array(100), buildSyntheticColormapBytes());
    let caughtError: unknown;
    try {
      buildPaletteAndColormap(cache, reader);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(PaletteAndColormapError);
    expect((caughtError as PaletteAndColormapError).reason).toBe('playpal-lump-wrong-size');
  });

  test('buildPaletteAndColormap throws PaletteAndColormapError with reason colormap-lump-wrong-size when COLORMAP bytes mismatch the expected length', () => {
    const cache = buildStubResourceCache({
      colormapEntry: syntheticEntry('COLORMAP', 200),
      playpalEntry: syntheticEntry('PLAYPAL', PLAYPAL_SIZE),
    });
    const reader = buildLumpReaderFromBytes(buildSyntheticPlaypalBytes(), new Uint8Array(200));
    let caughtError: unknown;
    try {
      buildPaletteAndColormap(cache, reader);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(PaletteAndColormapError);
    expect((caughtError as PaletteAndColormapError).reason).toBe('colormap-lump-wrong-size');
  });
});
