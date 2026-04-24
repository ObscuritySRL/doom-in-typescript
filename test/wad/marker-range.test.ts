import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../src/wad/directory.ts';
import { resolveMarkerRange } from '../../src/wad/markerRange.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

describe('resolveMarkerRange', () => {
  describe('sprite range (S_START / S_END)', () => {
    const range = resolveMarkerRange(directory, 'S_START', 'S_END');

    it('finds 483 sprite lumps between markers', () => {
      expect(range.count).toBe(483);
    });

    it('firstContentIndex is startMarkerIndex + 1', () => {
      expect(range.firstContentIndex).toBe(range.startMarkerIndex + 1);
    });

    it('lastContentIndex is endMarkerIndex - 1', () => {
      expect(range.lastContentIndex).toBe(range.endMarkerIndex - 1);
    });

    it('start marker entry is named S_START with size 0', () => {
      const entry = directory[range.startMarkerIndex]!;
      expect(entry.name).toBe('S_START');
      expect(entry.size).toBe(0);
    });

    it('end marker entry is named S_END with size 0', () => {
      const entry = directory[range.endMarkerIndex]!;
      expect(entry.name).toBe('S_END');
      expect(entry.size).toBe(0);
    });
  });

  describe('flat range (F_START / F_END)', () => {
    const range = resolveMarkerRange(directory, 'F_START', 'F_END');

    it('finds 56 flat lumps between markers', () => {
      expect(range.count).toBe(56);
    });

    it('includes F1_START and F1_END inner markers in the count', () => {
      let innerMarkerCount = 0;
      for (let i = range.firstContentIndex; i <= range.lastContentIndex; i++) {
        const name = directory[i]!.name;
        if (name === 'F1_START' || name === 'F1_END') innerMarkerCount++;
      }
      expect(innerMarkerCount).toBe(2);
    });
  });

  describe('patch range (P_START / P_END)', () => {
    const range = resolveMarkerRange(directory, 'P_START', 'P_END');

    it('finds 167 entries between markers (includes inner markers)', () => {
      expect(range.count).toBe(167);
    });

    it('inner markers P1_START and P1_END exist within the range', () => {
      let foundP1Start = false;
      let foundP1End = false;
      for (let i = range.firstContentIndex; i <= range.lastContentIndex; i++) {
        const name = directory[i]!.name;
        if (name === 'P1_START') foundP1Start = true;
        if (name === 'P1_END') foundP1End = true;
      }
      expect(foundP1Start).toBe(true);
      expect(foundP1End).toBe(true);
    });
  });

  describe('inner flat range (F1_START / F1_END)', () => {
    const range = resolveMarkerRange(directory, 'F1_START', 'F1_END');

    it('finds 54 data flats between inner markers', () => {
      expect(range.count).toBe(54);
    });

    it('every content lump is exactly 4096 bytes (64x64 raw pixels)', () => {
      for (let i = range.firstContentIndex; i <= range.lastContentIndex; i++) {
        expect(directory[i]!.size).toBe(4096);
      }
    });
  });

  describe('inner patch range (P1_START / P1_END)', () => {
    const range = resolveMarkerRange(directory, 'P1_START', 'P1_END');

    it('finds 165 data patches between inner markers', () => {
      expect(range.count).toBe(165);
    });

    it('every content lump has size > 0 (no markers inside P1)', () => {
      for (let i = range.firstContentIndex; i <= range.lastContentIndex; i++) {
        expect(directory[i]!.size).toBeGreaterThan(0);
      }
    });
  });

  describe('case insensitivity', () => {
    it('resolves markers case-insensitively', () => {
      const range = resolveMarkerRange(directory, 's_start', 's_end');
      expect(range.count).toBe(483);
    });

    it('mixed case works', () => {
      const range = resolveMarkerRange(directory, 'F_Start', 'F_End');
      expect(range.count).toBe(56);
    });
  });

  describe('error cases', () => {
    it('throws when start marker is not found', () => {
      expect(() => resolveMarkerRange(directory, 'NOTEXIST', 'S_END')).toThrow(/W_GetNumForName: NOTEXIST not found/);
    });

    it('throws when end marker is not found', () => {
      expect(() => resolveMarkerRange(directory, 'S_START', 'NOTEXIST')).toThrow(/W_GetNumForName: NOTEXIST not found/);
    });

    it('throws when end marker precedes start marker', () => {
      expect(() => resolveMarkerRange(directory, 'S_END', 'S_START')).toThrow(/must come after/);
    });
  });

  describe('synthetic edge cases', () => {
    it('adjacent markers produce count 0', () => {
      const synthetic: DirectoryEntry[] = [
        { offset: 0, size: 0, name: 'X_START' },
        { offset: 0, size: 0, name: 'X_END' },
      ];
      const range = resolveMarkerRange(synthetic, 'X_START', 'X_END');
      expect(range.count).toBe(0);
      expect(range.startMarkerIndex).toBe(0);
      expect(range.endMarkerIndex).toBe(1);
      expect(range.firstContentIndex).toBe(1);
      expect(range.lastContentIndex).toBe(0);
    });

    it('last-match-wins when duplicate markers exist', () => {
      const synthetic: DirectoryEntry[] = [
        { offset: 0, size: 0, name: 'M_START' },
        { offset: 0, size: 100, name: 'A' },
        { offset: 0, size: 0, name: 'M_END' },
        { offset: 0, size: 0, name: 'M_START' },
        { offset: 0, size: 200, name: 'B' },
        { offset: 0, size: 300, name: 'C' },
        { offset: 0, size: 0, name: 'M_END' },
      ];
      const range = resolveMarkerRange(synthetic, 'M_START', 'M_END');
      // Last M_START is at index 3, last M_END is at index 6
      expect(range.startMarkerIndex).toBe(3);
      expect(range.endMarkerIndex).toBe(6);
      expect(range.count).toBe(2);
    });

    it('returned object is frozen', () => {
      const range = resolveMarkerRange(directory, 'S_START', 'S_END');
      expect(Object.isFrozen(range)).toBe(true);
    });
  });
});
