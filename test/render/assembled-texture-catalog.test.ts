import { describe, expect, test } from 'bun:test';

import { COLORMAP_COUNT } from '../../src/assets/colormap.ts';
import { buildAssembledTextureCatalog } from '../../src/render/assembledTextureCatalog.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';

// The shareware IWAD is present locally (doom/ and iwad/ are gitignored
// asset dirs). This is a real end-to-end parse of the actual WAD.
const WAD_PATH = 'doom/DOOM1.WAD';

async function loadCatalog() {
  const wadBuffer = Buffer.from(await Bun.file(WAD_PATH).arrayBuffer());
  const directory = parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer));
  return buildAssembledTextureCatalog(directory, wadBuffer);
}

describe('assembledTextureCatalog: bit-exact catalog from the real DOOM1.WAD', () => {
  test('parses PNAMES + TEXTURE1 and resolves texture numbers bidirectionally', async () => {
    const cat = await loadCatalog();
    expect(cat.pnames.length).toBeGreaterThan(0);
    expect(cat.orderedDefinitions.length).toBeGreaterThan(0);

    // STARTAN3 is a stock DOOM1 wall texture; the resolver round-trips.
    const num = cat.textureNumber('STARTAN3');
    expect(num).toBeGreaterThanOrEqual(0);
    expect(cat.orderedDefinitions[num]!.name.toUpperCase()).toBe('STARTAN3');
    // R_CheckTextureNumForName: the "-" NoTexture marker → 0.
    expect(cat.textureNumber('-')).toBe(0);
  });

  test('patchByName decodes real patch lumps (case-insensitive) and misses are null', async () => {
    const cat = await loadCatalog();
    const firstPatch = cat.patchByName(cat.pnames[0]!);
    expect(firstPatch).not.toBeNull();
    expect(firstPatch!.header.width).toBeGreaterThan(0);
    // Case-insensitive (W_CheckNumForName).
    expect(cat.patchByName(cat.pnames[0]!.toLowerCase())).toBe(firstPatch!);
    expect(cat.patchByName('ZЗ_NOPE_NOPE')).toBeNull();
  });

  test('textureOf composites a real texture bit-exactly (columns = width, height matches def)', async () => {
    const cat = await loadCatalog();
    const num = cat.textureNumber('STARTAN3');
    const def = cat.orderedDefinitions[num]!;
    const prepared = cat.textureOf(num)!;
    expect(prepared.name.toUpperCase()).toBe('STARTAN3');
    expect(prepared.width).toBe(def.width);
    expect(prepared.height).toBe(def.height);
    expect(prepared.columns.length).toBe(def.width);
    // Memoized: same number → same frozen instance.
    expect(cat.textureOf(num)).toBe(prepared);
  });

  test('COLORMAP parses to the full ramp set and SKY1 is composited', async () => {
    const cat = await loadCatalog();
    expect(cat.colormaps.length).toBe(COLORMAP_COUNT);
    expect(cat.colormaps[0]!.length).toBe(256);
    // DOOM1.WAD SKY1 is 256×128.
    expect(cat.skyTexture.name.toUpperCase()).toBe('SKY1');
    expect(cat.skyTexture.width).toBe(256);
    expect(cat.skyTexture.height).toBe(128);
    expect(cat.skyTexture.columns.length).toBe(256);
  });

  test('is deterministic — two builds yield identical resolver results', async () => {
    const a = await loadCatalog();
    const b = await loadCatalog();
    expect(a.orderedDefinitions.length).toBe(b.orderedDefinitions.length);
    expect(a.textureNumber('STARTAN3')).toBe(b.textureNumber('STARTAN3'));
    expect(a.skyTexture.width).toBe(b.skyTexture.width);
  });
});
