/**
 * Vanilla DOOM 1.9 patch-font cache builder.
 *
 * The HUD font (STCFN033 through STCFN095, 63 patches) and small status-bar
 * font are loaded as patches from the WAD directory. This cache mirrors
 * vanilla M_LoadDefaults / HU_Init font setup: it walks the directory looking
 * for STCFN### entries and indexes them by ASCII character code 33-95.
 */

import type { DirectoryEntry } from '../wad/directory.ts';

export const VANILLA_HUD_FONT_FIRST_CHAR_CODE = 33;
export const VANILLA_HUD_FONT_LAST_CHAR_CODE = 95;
export const VANILLA_HUD_FONT_LUMP_PREFIX = 'STCFN';
export const VANILLA_HUD_FONT_LUMP_NAME_LENGTH = 8;
export const VANILLA_HUD_FONT_GLYPH_COUNT = VANILLA_HUD_FONT_LAST_CHAR_CODE - VANILLA_HUD_FONT_FIRST_CHAR_CODE + 1;

export interface PatchFontCacheEntry {
  readonly directoryIndex: number;
  readonly charCode: number;
  readonly lumpName: string;
  readonly offset: number;
  readonly size: number;
}

export interface PatchFontCache {
  readonly entries: readonly PatchFontCacheEntry[];
  readonly entryByCharCode: ReadonlyMap<number, PatchFontCacheEntry>;
}

export interface PatchFontCacheInput {
  readonly directory: readonly DirectoryEntry[];
}

export function buildPatchFontCache(input: PatchFontCacheInput): PatchFontCache {
  const entries: PatchFontCacheEntry[] = [];
  const entryByCharCode = new Map<number, PatchFontCacheEntry>();
  for (let directoryIndex = 0; directoryIndex < input.directory.length; directoryIndex += 1) {
    const directoryEntry = input.directory[directoryIndex]!;
    if (!directoryEntry.name.startsWith(VANILLA_HUD_FONT_LUMP_PREFIX)) {
      continue;
    }
    const trailing = directoryEntry.name.slice(VANILLA_HUD_FONT_LUMP_PREFIX.length).replace(/\0+$/u, '');
    if (!/^\d{3}$/u.test(trailing)) {
      continue;
    }
    const charCode = Number.parseInt(trailing, 10);
    if (charCode < VANILLA_HUD_FONT_FIRST_CHAR_CODE || charCode > VANILLA_HUD_FONT_LAST_CHAR_CODE) {
      continue;
    }
    const entry: PatchFontCacheEntry = Object.freeze({
      directoryIndex,
      charCode,
      lumpName: directoryEntry.name,
      offset: directoryEntry.offset,
      size: directoryEntry.size,
    });
    entries.push(entry);
    entryByCharCode.set(charCode, entry);
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    entryByCharCode,
  });
}
