import { describe, expect, test } from 'bun:test';

import { buildAssembledFlatCatalog } from '../../src/render/assembledFlatCatalog.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';

const WAD_PATH = 'doom/DOOM1.WAD';

async function loadCatalog() {
  const wadBuffer = Buffer.from(await Bun.file(WAD_PATH).arrayBuffer());
  const directory = parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer));
  return buildAssembledFlatCatalog(directory, wadBuffer);
}

describe('assembledFlatCatalog: R_FlatNumForName + flatSource from the real DOOM1.WAD', () => {
  test('resolves a stock flat name to its firstflat-relative number', async () => {
    const cat = await loadCatalog();
    // FLOOR4_8 is a stock DOOM1 floor flat.
    const num = cat.flatNumber('FLOOR4_8');
    expect(num).toBeGreaterThanOrEqual(0);
    // Case-insensitive (W_CheckNumForName).
    expect(cat.flatNumber('floor4_8')).toBe(num);
  });

  test('flatSource returns the 4096-byte 64x64 flat for a resolved number', async () => {
    const cat = await loadCatalog();
    const num = cat.flatNumber('FLOOR4_8');
    const src = cat.flatSource(num);
    expect(src).toBeInstanceOf(Uint8Array);
    expect(src.length).toBe(4096);
  });

  test('a missing flat name is an I_Error (no silent wrong flat)', async () => {
    const cat = await loadCatalog();
    expect(() => cat.flatNumber('NOSUCHFLAT')).toThrow('R_FlatNumForName: NOSUCHFLAT not found');
  });

  test('an out-of-range flat number is a hard error', async () => {
    const cat = await loadCatalog();
    expect(() => cat.flatSource(999_999)).toThrow(RangeError);
  });

  test('is deterministic — two builds resolve identically', async () => {
    const a = await loadCatalog();
    const b = await loadCatalog();
    expect(a.flatNumber('FLOOR4_8')).toBe(b.flatNumber('FLOOR4_8'));
    expect(a.flatSource(a.flatNumber('FLOOR4_8')).length).toBe(b.flatSource(b.flatNumber('FLOOR4_8')).length);
  });
});
