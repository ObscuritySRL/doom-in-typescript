import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../src/wad/directory.ts';
import { buildPatchCatalog, buildSpriteCatalog } from '../../src/assets/patchCatalog.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const patchCatalog = buildPatchCatalog(directory);
const spriteCatalog = buildSpriteCatalog(directory);

describe('buildPatchCatalog with DOOM1.WAD', () => {
  it('finds 167 total entries between P_START and P_END', () => {
    expect(patchCatalog.count).toBe(167);
  });

  it('finds 165 data patches (excludes P1_START and P1_END inner markers)', () => {
    expect(patchCatalog.dataCount).toBe(165);
  });

  it('entries array length matches count', () => {
    expect(patchCatalog.entries.length).toBe(patchCatalog.count);
  });

  it('firstPatchIndex and lastPatchIndex span the correct range', () => {
    expect(patchCatalog.lastPatchIndex - patchCatalog.firstPatchIndex + 1).toBe(patchCatalog.count);
  });

  it('first entry is P1_START inner marker', () => {
    const first = patchCatalog.entries[0]!;
    expect(first.name).toBe('P1_START');
    expect(first.isMarker).toBe(true);
    expect(first.patchNumber).toBe(0);
  });

  it('last entry is P1_END inner marker', () => {
    const last = patchCatalog.entries[patchCatalog.entries.length - 1]!;
    expect(last.name).toBe('P1_END');
    expect(last.isMarker).toBe(true);
    expect(last.patchNumber).toBe(patchCatalog.count - 1);
  });

  it('patch numbers are sequential starting at 0', () => {
    for (let i = 0; i < patchCatalog.entries.length; i++) {
      expect(patchCatalog.entries[i]!.patchNumber).toBe(i);
    }
  });

  it('directory indices are sequential', () => {
    for (let i = 0; i < patchCatalog.entries.length; i++) {
      expect(patchCatalog.entries[i]!.directoryIndex).toBe(patchCatalog.firstPatchIndex + i);
    }
  });

  it('exactly two entries are inner markers', () => {
    const markers = patchCatalog.entries.filter((entry) => entry.isMarker);
    expect(markers.length).toBe(2);
    expect(markers[0]!.name).toBe('P1_START');
    expect(markers[1]!.name).toBe('P1_END');
  });

  it('all data patch names are non-empty uppercase ASCII', () => {
    for (const entry of patchCatalog.entries) {
      if (!entry.isMarker) {
        expect(entry.name.length).toBeGreaterThan(0);
        expect(entry.name).toBe(entry.name.toUpperCase());
        expect(entry.name).toMatch(/^[A-Z0-9_]+$/);
      }
    }
  });

  it('all data patches have non-zero size in the WAD', () => {
    for (const entry of patchCatalog.entries) {
      if (!entry.isMarker) {
        const dirEntry = directory[entry.directoryIndex]!;
        expect(dirEntry.size).toBeGreaterThan(0);
      }
    }
  });

  it('inner markers have zero size in the WAD', () => {
    for (const entry of patchCatalog.entries) {
      if (entry.isMarker) {
        const dirEntry = directory[entry.directoryIndex]!;
        expect(dirEntry.size).toBe(0);
      }
    }
  });

  it('all entry names match their WAD directory entry names', () => {
    for (const entry of patchCatalog.entries) {
      const dirEntry = directory[entry.directoryIndex]!;
      expect(entry.name).toBe(dirEntry.name);
    }
  });

  it('returned catalog is frozen', () => {
    expect(Object.isFrozen(patchCatalog)).toBe(true);
  });

  it('entries array is frozen', () => {
    expect(Object.isFrozen(patchCatalog.entries)).toBe(true);
  });
});

describe('buildSpriteCatalog with DOOM1.WAD', () => {
  it('finds 483 total entries between S_START and S_END', () => {
    expect(spriteCatalog.count).toBe(483);
  });

  it('entries array length matches count', () => {
    expect(spriteCatalog.entries.length).toBe(spriteCatalog.count);
  });

  it('firstSpriteIndex and lastSpriteIndex span the correct range', () => {
    expect(spriteCatalog.lastSpriteIndex - spriteCatalog.firstSpriteIndex + 1).toBe(spriteCatalog.count);
  });

  it('sprite numbers are sequential starting at 0', () => {
    for (let i = 0; i < spriteCatalog.entries.length; i++) {
      expect(spriteCatalog.entries[i]!.spriteNumber).toBe(i);
    }
  });

  it('directory indices are sequential', () => {
    for (let i = 0; i < spriteCatalog.entries.length; i++) {
      expect(spriteCatalog.entries[i]!.directoryIndex).toBe(spriteCatalog.firstSpriteIndex + i);
    }
  });

  it('all sprite names are non-empty uppercase ASCII', () => {
    for (const entry of spriteCatalog.entries) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.name).toBe(entry.name.toUpperCase());
      expect(entry.name).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it('all sprites have non-zero size in the WAD', () => {
    for (const entry of spriteCatalog.entries) {
      const dirEntry = directory[entry.directoryIndex]!;
      expect(dirEntry.size).toBeGreaterThan(0);
    }
  });

  it('all entry names match their WAD directory entry names', () => {
    for (const entry of spriteCatalog.entries) {
      const dirEntry = directory[entry.directoryIndex]!;
      expect(entry.name).toBe(dirEntry.name);
    }
  });

  it('TROO sprite prefix is present (imp)', () => {
    const troo = spriteCatalog.entries.find((entry) => entry.name.startsWith('TROO'));
    expect(troo).toBeDefined();
  });

  it('PLAY sprite prefix is present (player)', () => {
    const play = spriteCatalog.entries.find((entry) => entry.name.startsWith('PLAY'));
    expect(play).toBeDefined();
  });

  it('returned catalog is frozen', () => {
    expect(Object.isFrozen(spriteCatalog)).toBe(true);
  });

  it('entries array is frozen', () => {
    expect(Object.isFrozen(spriteCatalog.entries)).toBe(true);
  });
});

describe('parity-sensitive edge cases', () => {
  it('inner markers P1_START/P1_END get patch numbers (vanilla counts all entries)', () => {
    const p1Start = patchCatalog.entries.find((entry) => entry.name === 'P1_START')!;
    const p1End = patchCatalog.entries.find((entry) => entry.name === 'P1_END')!;
    expect(p1Start.patchNumber).toBeGreaterThanOrEqual(0);
    expect(p1End.patchNumber).toBeGreaterThanOrEqual(0);
    expect(p1Start.patchNumber).toBeLessThan(p1End.patchNumber);
  });

  it('patch count matches wad-directory-summary markerCounts.patches', () => {
    expect(patchCatalog.count).toBe(167);
  });

  it('sprite count matches wad-directory-summary markerCounts.sprites', () => {
    expect(spriteCatalog.count).toBe(483);
  });

  it('data patch count + inner marker count = total count', () => {
    const markerCount = patchCatalog.entries.filter((entry) => entry.isMarker).length;
    expect(patchCatalog.dataCount + markerCount).toBe(patchCatalog.count);
  });

  it('patch number is index into the range, not the WAD directory index', () => {
    for (const entry of patchCatalog.entries) {
      expect(entry.patchNumber).toBe(entry.directoryIndex - patchCatalog.firstPatchIndex);
    }
  });

  it('sprite number is index into the range, not the WAD directory index', () => {
    for (const entry of spriteCatalog.entries) {
      expect(entry.spriteNumber).toBe(entry.directoryIndex - spriteCatalog.firstSpriteIndex);
    }
  });

  it('sprite range has no inner markers (all entries are data)', () => {
    for (const entry of spriteCatalog.entries) {
      const dirEntry = directory[entry.directoryIndex]!;
      expect(dirEntry.size).toBeGreaterThan(0);
    }
  });

  it('sprite names follow 4-char-prefix + frame/rotation pattern', () => {
    for (const entry of spriteCatalog.entries) {
      expect(entry.name.length).toBeGreaterThanOrEqual(6);
      expect(entry.name.length).toBeLessThanOrEqual(8);
    }
  });

  it('recognizes inner patch markers case-insensitively', () => {
    const mixedCase: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'p_start' },
      { offset: 0, size: 0, name: 'p1_start' },
      { offset: 0, size: 100, name: 'wall00_3' },
      { offset: 0, size: 0, name: 'P1_End' },
      { offset: 0, size: 0, name: 'P_END' },
    ];
    const result = buildPatchCatalog(mixedCase);
    expect(result.count).toBe(3);
    expect(result.dataCount).toBe(1);
    expect(result.entries[0]!.isMarker).toBe(true);
    expect(result.entries[2]!.isMarker).toBe(true);
  });

  it('uses the last matching patch marker pair when duplicates exist', () => {
    const duplicateMarkers: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'P_START' },
      { offset: 0, size: 100, name: 'OLDPATCH' },
      { offset: 0, size: 0, name: 'P_END' },
      { offset: 0, size: 0, name: 'P_START' },
      { offset: 0, size: 100, name: 'NEWPATCH' },
      { offset: 0, size: 0, name: 'P_END' },
    ];
    const result = buildPatchCatalog(duplicateMarkers);
    expect(result.count).toBe(1);
    expect(result.entries[0]!.name).toBe('NEWPATCH');
    expect(result.firstPatchIndex).toBe(4);
  });

  it('uses the last matching sprite marker pair when duplicates exist', () => {
    const duplicateMarkers: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'S_START' },
      { offset: 0, size: 100, name: 'OLDSPRIT' },
      { offset: 0, size: 0, name: 'S_END' },
      { offset: 0, size: 0, name: 'S_START' },
      { offset: 0, size: 100, name: 'NEWSPRIT' },
      { offset: 0, size: 0, name: 'S_END' },
    ];
    const result = buildSpriteCatalog(duplicateMarkers);
    expect(result.count).toBe(1);
    expect(result.entries[0]!.name).toBe('NEWSPRIT');
    expect(result.firstSpriteIndex).toBe(4);
  });
});

describe('error cases', () => {
  it('buildPatchCatalog throws when P_START marker is missing', () => {
    const noStart: DirectoryEntry[] = [
      { offset: 0, size: 100, name: 'WALL00_3' },
      { offset: 0, size: 0, name: 'P_END' },
    ];
    expect(() => buildPatchCatalog(noStart)).toThrow(/P_START not found/);
  });

  it('buildPatchCatalog throws when P_END marker is missing', () => {
    const noEnd: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'P_START' },
      { offset: 0, size: 100, name: 'WALL00_3' },
    ];
    expect(() => buildPatchCatalog(noEnd)).toThrow(/P_END not found/);
  });

  it('buildSpriteCatalog throws when S_START marker is missing', () => {
    const noStart: DirectoryEntry[] = [
      { offset: 0, size: 100, name: 'TROOA1' },
      { offset: 0, size: 0, name: 'S_END' },
    ];
    expect(() => buildSpriteCatalog(noStart)).toThrow(/S_START not found/);
  });

  it('buildSpriteCatalog throws when S_END marker is missing', () => {
    const noEnd: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'S_START' },
      { offset: 0, size: 100, name: 'TROOA1' },
    ];
    expect(() => buildSpriteCatalog(noEnd)).toThrow(/S_END not found/);
  });

  it('handles empty patch range (adjacent markers)', () => {
    const empty: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'P_START' },
      { offset: 0, size: 0, name: 'P_END' },
    ];
    const result = buildPatchCatalog(empty);
    expect(result.count).toBe(0);
    expect(result.dataCount).toBe(0);
    expect(result.entries.length).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('handles empty sprite range (adjacent markers)', () => {
    const empty: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'S_START' },
      { offset: 0, size: 0, name: 'S_END' },
    ];
    const result = buildSpriteCatalog(empty);
    expect(result.count).toBe(0);
    expect(result.entries.length).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('handles patch range with no inner markers', () => {
    const noInner: DirectoryEntry[] = [
      { offset: 0, size: 0, name: 'P_START' },
      { offset: 0, size: 100, name: 'WALL00_3' },
      { offset: 0, size: 100, name: 'WALL00_4' },
      { offset: 0, size: 0, name: 'P_END' },
    ];
    const result = buildPatchCatalog(noInner);
    expect(result.count).toBe(2);
    expect(result.dataCount).toBe(2);
    expect(result.entries[0]!.isMarker).toBe(false);
    expect(result.entries[1]!.isMarker).toBe(false);
  });
});
