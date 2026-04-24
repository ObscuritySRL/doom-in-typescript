import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { PNAMES_HEADER_SIZE, PNAMES_NAME_SIZE, parsePnames } from '../../src/assets/pnames.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lookup = new LumpLookup(directory);
const pnamesData = lookup.getLumpData('PNAMES', wadBuffer);
const names = parsePnames(pnamesData);

describe('PNAMES constants', () => {
  it('PNAMES_HEADER_SIZE is 4', () => {
    expect(PNAMES_HEADER_SIZE).toBe(4);
  });

  it('PNAMES_NAME_SIZE is 8', () => {
    expect(PNAMES_NAME_SIZE).toBe(8);
  });
});

describe('parsePnames', () => {
  it('returns 350 patch names for DOOM1.WAD', () => {
    expect(names.length).toBe(350);
  });

  it('lump size matches header plus count times name size', () => {
    expect(pnamesData.length).toBe(PNAMES_HEADER_SIZE + names.length * PNAMES_NAME_SIZE);
  });

  it('all names are non-empty strings', () => {
    for (const name of names) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('all names are uppercase (no lowercase characters)', () => {
    for (const name of names) {
      expect(name).toBe(name.toUpperCase());
    }
  });

  it('all names are at most 8 characters', () => {
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(PNAMES_NAME_SIZE);
    }
  });

  it('first name is WALL00_3', () => {
    expect(names[0]).toBe('WALL00_3');
  });

  it('last name is SW2_4', () => {
    expect(names[names.length - 1]).toBe('SW2_4');
  });

  it('returned array is frozen', () => {
    expect(Object.isFrozen(names)).toBe(true);
  });

  it('contains names referenced by TEXTURE1 patches', () => {
    // These are well-known wall patch names that TEXTURE1 references
    expect(names).toContain('DOOR2_1');
    expect(names).toContain('DOOR9_1');
    expect(names).toContain('WALL00_3');
  });

  it('names contain only valid ASCII characters (A-Z, 0-9, underscore)', () => {
    for (const name of names) {
      expect(name).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it('count in lump header matches returned array length', () => {
    const headerCount = pnamesData.readInt32LE(0);
    expect(headerCount).toBe(names.length);
  });

  it('throws RangeError for data smaller than header size', () => {
    const tooSmall = Buffer.alloc(PNAMES_HEADER_SIZE - 1);
    expect(() => parsePnames(tooSmall)).toThrow(RangeError);
  });

  it('throws RangeError when declared count exceeds available data', () => {
    // Header says 10 names but only enough data for 5
    const buffer = Buffer.alloc(PNAMES_HEADER_SIZE + 5 * PNAMES_NAME_SIZE);
    buffer.writeInt32LE(10, 0);
    expect(() => parsePnames(buffer)).toThrow(RangeError);
  });

  it('error message includes expected and actual size for truncated data', () => {
    const buffer = Buffer.alloc(PNAMES_HEADER_SIZE + 2 * PNAMES_NAME_SIZE);
    buffer.writeInt32LE(5, 0);
    expect(() => parsePnames(buffer)).toThrow(/44.*20/);
  });

  it('handles zero-count PNAMES lump', () => {
    const buffer = Buffer.alloc(PNAMES_HEADER_SIZE);
    buffer.writeInt32LE(0, 0);
    const result = parsePnames(buffer);
    expect(result.length).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('throws RangeError for negative count', () => {
    const buffer = Buffer.alloc(PNAMES_HEADER_SIZE);
    buffer.writeInt32LE(-1, 0);
    expect(() => parsePnames(buffer)).toThrow(RangeError);
  });

  it('accepts Uint8Array input', () => {
    const uint8 = new Uint8Array(pnamesData);
    const result = parsePnames(uint8);
    expect(result.length).toBe(350);
    expect(result[0]).toBe('WALL00_3');
  });
});

describe('parity-sensitive edge cases', () => {
  it('patch count exceeds P_START/P_END marker range (350 > 165)', () => {
    // PNAMES references patches from multiple WAD sections, not just
    // the P_START/P_END marker range which contains only 165 data patches.
    // The 350 entries include wall patches and other graphics referenced
    // by TEXTURE1.
    expect(names.length).toBeGreaterThan(165);
  });

  it('names have no trailing null bytes or whitespace', () => {
    for (const name of names) {
      expect(name).not.toMatch(/[\0\s]$/);
    }
  });

  it('no duplicate adjacent names (consecutive entries are not all identical)', () => {
    // While duplicates across the full list are theoretically possible,
    // no two consecutive entries should be identical in practice.
    let allConsecutiveSame = true;
    for (let i = 1; i < names.length; i++) {
      if (names[i] !== names[i - 1]) {
        allConsecutiveSame = false;
        break;
      }
    }
    expect(allConsecutiveSame).toBe(false);
  });

  it('index order is load-bearing (TEXTURE1 references patches by index)', () => {
    // Verify that the array preserves insertion order from the lump.
    // Changing the order would break TEXTURE1 patch references.
    expect(names[0]).toBe('WALL00_3');
    expect(names[1]).toBe('W13_1');
    expect(names[2]).toBe('DOOR2_1');
    expect(names[3]).toBe('DOOR2_4');
    expect(names[4]).toBe('DOOR9_1');
  });

  it('PNAMES lump exists in the WAD directory', () => {
    expect(lookup.hasLump('PNAMES')).toBe(true);
  });
});
