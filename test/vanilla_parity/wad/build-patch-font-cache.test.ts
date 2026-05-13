import { describe, expect, test } from 'bun:test';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import { VANILLA_HUD_FONT_FIRST_CHAR_CODE, VANILLA_HUD_FONT_GLYPH_COUNT, VANILLA_HUD_FONT_LAST_CHAR_CODE, VANILLA_HUD_FONT_LUMP_PREFIX, buildPatchFontCache } from '../../../src/assets/build-patch-font-cache.ts';

function makeDirectoryEntry(name: string, offset = 1, size = 100): DirectoryEntry {
  return { name, offset, size };
}

describe('vanilla patch font cache constants', () => {
  test('first char code 33, last char code 95, prefix STCFN, 63 glyphs', () => {
    expect(VANILLA_HUD_FONT_FIRST_CHAR_CODE).toBe(33);
    expect(VANILLA_HUD_FONT_LAST_CHAR_CODE).toBe(95);
    expect(VANILLA_HUD_FONT_GLYPH_COUNT).toBe(63);
    expect(VANILLA_HUD_FONT_LUMP_PREFIX).toBe('STCFN');
  });
});

describe('buildPatchFontCache', () => {
  test('indexes STCFN033 to STCFN095 by character code', () => {
    const directory = [makeDirectoryEntry('STCFN033'), makeDirectoryEntry('STCFN065'), makeDirectoryEntry('STCFN095')];
    const cache = buildPatchFontCache({ directory });
    expect(cache.entries).toHaveLength(3);
    expect(cache.entryByCharCode.get(33)?.lumpName).toBe('STCFN033');
    expect(cache.entryByCharCode.get(65)?.lumpName).toBe('STCFN065');
    expect(cache.entryByCharCode.get(95)?.lumpName).toBe('STCFN095');
  });

  test('skips non-STCFN lumps', () => {
    const directory = [makeDirectoryEntry('PLAYPAL'), makeDirectoryEntry('STCFN065')];
    const cache = buildPatchFontCache({ directory });
    expect(cache.entries).toHaveLength(1);
    expect(cache.entryByCharCode.get(65)?.lumpName).toBe('STCFN065');
  });

  test('skips STCFN entries outside the 33-95 range', () => {
    const directory = [makeDirectoryEntry('STCFN032'), makeDirectoryEntry('STCFN096'), makeDirectoryEntry('STCFN050')];
    const cache = buildPatchFontCache({ directory });
    expect(cache.entries).toHaveLength(1);
    expect(cache.entryByCharCode.get(50)?.lumpName).toBe('STCFN050');
  });

  test('skips STCFN lumps with non-digit trailing characters', () => {
    const directory = [makeDirectoryEntry('STCFNABC'), makeDirectoryEntry('STCFN050')];
    const cache = buildPatchFontCache({ directory });
    expect(cache.entries).toHaveLength(1);
  });
});
