import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lookup = new LumpLookup(directory);

describe('LumpLookup', () => {
  describe('construction', () => {
    it('totalCount matches the directory length', () => {
      expect(lookup.totalCount).toBe(PRIMARY_TARGET.wadLumpCount);
    });

    it('uniqueCount is less than or equal to totalCount', () => {
      expect(lookup.uniqueCount).toBeLessThanOrEqual(lookup.totalCount);
      expect(lookup.uniqueCount).toBeGreaterThan(0);
    });
  });

  describe('checkNumForName', () => {
    it('finds PLAYPAL at index 0', () => {
      expect(lookup.checkNumForName('PLAYPAL')).toBe(0);
    });

    it('finds COLORMAP at index 1', () => {
      expect(lookup.checkNumForName('COLORMAP')).toBe(1);
    });

    it('returns -1 for a non-existent lump', () => {
      expect(lookup.checkNumForName('NOTEXIST')).toBe(-1);
    });

    it('is case-insensitive', () => {
      expect(lookup.checkNumForName('playpal')).toBe(0);
      expect(lookup.checkNumForName('Playpal')).toBe(0);
      expect(lookup.checkNumForName('PlayPal')).toBe(0);
    });

    it('finds E1M1 map marker', () => {
      const idx = lookup.checkNumForName('E1M1');
      expect(idx).toBeGreaterThan(-1);
      expect(directory[idx]!.name).toBe('E1M1');
    });

    it('finds TEXTURE1', () => {
      const idx = lookup.checkNumForName('TEXTURE1');
      expect(idx).toBeGreaterThan(-1);
    });

    it('returns -1 for TEXTURE2 (not present in shareware)', () => {
      expect(lookup.checkNumForName('TEXTURE2')).toBe(-1);
    });

    it('returns -1 for an empty string', () => {
      expect(lookup.checkNumForName('')).toBe(-1);
    });
  });

  describe('getNumForName', () => {
    it('returns the same index as checkNumForName for existing lumps', () => {
      expect(lookup.getNumForName('PLAYPAL')).toBe(lookup.checkNumForName('PLAYPAL'));
    });

    it('throws on a non-existent lump', () => {
      expect(() => lookup.getNumForName('NOTEXIST')).toThrow(/W_GetNumForName: NOTEXIST not found/);
    });

    it('throws with uppercased name in message even for lowercase input', () => {
      expect(() => lookup.getNumForName('notexist')).toThrow(/W_GetNumForName: NOTEXIST not found/);
    });
  });

  describe('last-match-wins semantics (PWAD override behavior)', () => {
    it('returns the last index when duplicate names exist', () => {
      // Build a synthetic directory with duplicate names
      const synthetic = [
        { offset: 0, size: 100, name: 'FOO' },
        { offset: 200, size: 50, name: 'BAR' },
        { offset: 400, size: 75, name: 'FOO' },
      ] as const;
      const synLookup = new LumpLookup(synthetic);
      // Last FOO is at index 2
      expect(synLookup.checkNumForName('FOO')).toBe(2);
      expect(synLookup.checkNumForName('BAR')).toBe(1);
    });

    it('uniqueCount reflects deduplicated names', () => {
      const synthetic = [
        { offset: 0, size: 100, name: 'FOO' },
        { offset: 200, size: 50, name: 'BAR' },
        { offset: 400, size: 75, name: 'FOO' },
      ] as const;
      const synLookup = new LumpLookup(synthetic);
      expect(synLookup.uniqueCount).toBe(2);
      expect(synLookup.totalCount).toBe(3);
    });
  });

  describe('getEntry', () => {
    it('returns the correct entry by index', () => {
      const entry = lookup.getEntry(0);
      expect(entry.name).toBe('PLAYPAL');
    });

    it('throws RangeError for negative index', () => {
      expect(() => lookup.getEntry(-1)).toThrow(RangeError);
    });

    it('throws RangeError for index beyond directory', () => {
      expect(() => lookup.getEntry(PRIMARY_TARGET.wadLumpCount)).toThrow(RangeError);
    });
  });

  describe('getLumpData', () => {
    it('returns the correct data for PLAYPAL', () => {
      const data = lookup.getLumpData('PLAYPAL', wadBuffer);
      // PLAYPAL is 14 palettes * 768 bytes = 10752 bytes
      expect(data.length).toBe(10752);
    });

    it('returns a buffer slice at the correct offset', () => {
      const entry = lookup.getEntry(lookup.getNumForName('PLAYPAL'));
      const data = lookup.getLumpData('PLAYPAL', wadBuffer);
      // First byte should match what's at the entry offset in the WAD
      expect(data[0]).toBe(wadBuffer[entry.offset]);
    });

    it('throws for a non-existent lump', () => {
      expect(() => lookup.getLumpData('NOTEXIST', wadBuffer)).toThrow(/W_GetNumForName/);
    });
  });

  describe('hasLump', () => {
    it('returns true for existing lumps', () => {
      expect(lookup.hasLump('PLAYPAL')).toBe(true);
      expect(lookup.hasLump('E1M1')).toBe(true);
      expect(lookup.hasLump('DEMO1')).toBe(true);
    });

    it('returns false for non-existent lumps', () => {
      expect(lookup.hasLump('NOTEXIST')).toBe(false);
      expect(lookup.hasLump('TEXTURE2')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(lookup.hasLump('playpal')).toBe(true);
      expect(lookup.hasLump('Playpal')).toBe(true);
    });
  });

  describe('getAllIndicesForName', () => {
    it('returns all indices for duplicate names in synthetic directory', () => {
      const synthetic = [
        { offset: 0, size: 100, name: 'FOO' },
        { offset: 200, size: 50, name: 'BAR' },
        { offset: 400, size: 75, name: 'FOO' },
        { offset: 600, size: 25, name: 'FOO' },
      ] as const;
      const synLookup = new LumpLookup(synthetic);
      const indices = synLookup.getAllIndicesForName('FOO');
      expect(indices).toEqual([0, 2, 3]);
    });

    it('returns an empty array for non-existent names', () => {
      expect(lookup.getAllIndicesForName('NOTEXIST')).toEqual([]);
    });

    it('returns a single-element array for unique names', () => {
      const indices = lookup.getAllIndicesForName('PLAYPAL');
      expect(indices.length).toBe(1);
      expect(indices[0]).toBe(0);
    });
  });
});
