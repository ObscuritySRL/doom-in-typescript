import { describe, expect, test } from 'bun:test';

import type { PnamesLump } from '../../../src/assets/parse-pnames-lump.ts';
import type { TextureOneLump } from '../../../src/assets/parse-texture-one-lump.ts';
import type { TextureTwoLump } from '../../../src/assets/parse-texture-two-when-present.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';

import { buildTextureCompositionCache, getTextureComposition } from '../../../src/assets/build-texture-composition-cache.ts';
import { parsePnamesLump } from '../../../src/assets/parse-pnames-lump.ts';
import { parseTextureOneLump } from '../../../src/assets/parse-texture-one-lump.ts';
import { parseTextureTwoWhenPresent } from '../../../src/assets/parse-texture-two-when-present.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { LumpLookup } from '../../../src/wad/lumpLookup.ts';

interface SyntheticPatchPost {
  readonly pixels: readonly number[];
  readonly topDelta: number;
}

type SyntheticPatchColumn = readonly SyntheticPatchPost[];

describe('buildTextureCompositionCache', () => {
  test('builds a static cache and overlays patch columns in source order', () => {
    const patchA = createPatchPicture(2, 4, [[{ pixels: [1, 2, 3, 4], topDelta: 0 }], [{ pixels: [5, 6], topDelta: 1 }]]);
    const patchB = createPatchPicture(2, 3, [[{ pixels: [9, 9, 9], topDelta: 0 }], [{ pixels: [8, 8, 8], topDelta: 0 }]]);

    const wadBuffer = Buffer.concat([patchA, patchB]);
    const directory: readonly DirectoryEntry[] = Object.freeze([Object.freeze({ name: 'PATCHA', offset: 0, size: patchA.length }), Object.freeze({ name: 'PATCHB', offset: patchA.length, size: patchB.length })]);
    const pnames = createPnames(['PATCHA', 'PATCHB']);
    const textureOne = createTextureOne([
      {
        height: 4,
        name: 'TESTTEX',
        patches: [
          { originX: 0, originY: 0, patchIndex: 0 },
          { originX: 1, originY: 1, patchIndex: 1 },
        ],
        width: 3,
      },
    ]);

    const cache = buildTextureCompositionCache({ directory, pnames, textureOne, textureTwo: null, wadBuffer });
    const texture = cache.textures[0];
    if (texture === undefined) {
      throw new Error('expected composed texture');
    }

    expect(cache.category).toBe('static');
    expect(cache.patchLookup).toEqual([0, 1]);
    expect(cache.tag).toBe('PU_STATIC');
    expect(getTextureComposition(cache, 'testtex')).toBe(texture);
    expect(cache.textureNameToIndex.get('TESTTEX')).toBe(0);
    expect(texture.height).toBe(4);
    expect(texture.patchCount).toBe(2);
    expect(texture.patches.map((patch) => patch.patchName)).toEqual(['PATCHA', 'PATCHB']);
    expect(texture.runtimeIndex).toBe(0);
    expect(texture.source).toBe('TEXTURE1');
    expect(texture.width).toBe(3);
    expect(readColumn(texture, 0)).toEqual([1, 2, 3, 4]);
    expect(readColumn(texture, 1)).toEqual([0, 9, 9, 9]);
    expect(readColumn(texture, 2)).toEqual([0, 8, 8, 8]);
  });

  test('rejects a referenced PNAMES patch that is absent from the WAD directory', () => {
    const pnames = createPnames(['MISSING']);
    const textureOne = createTextureOne([
      {
        height: 1,
        name: 'BADPATCH',
        patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
        width: 1,
      },
    ]);

    expect(() => buildTextureCompositionCache({ directory: Object.freeze([]), pnames, textureOne, textureTwo: null, wadBuffer: Buffer.alloc(0) })).toThrow('R_InitTextures: Missing patch in texture BADPATCH');
  });

  test('allows missing PNAMES entries when no texture references them', () => {
    const patchPicture = createPatchPicture(1, 1, [[{ pixels: [3], topDelta: 0 }]]);
    const directory: readonly DirectoryEntry[] = Object.freeze([Object.freeze({ name: 'PATCHA', offset: 0, size: patchPicture.length })]);
    const pnames = createPnames(['PATCHA', 'MISSING']);
    const textureOne = createTextureOne([
      {
        height: 1,
        name: 'UNUSEDMS',
        patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
        width: 1,
      },
    ]);

    const cache = buildTextureCompositionCache({ directory, pnames, textureOne, textureTwo: null, wadBuffer: patchPicture });
    const texture = cache.textures[0];
    if (texture === undefined) {
      throw new Error('expected texture with unreferenced missing PNAMES entry');
    }

    expect(cache.patchLookup).toEqual([0, -1]);
    expect(readColumn(texture, 0)).toEqual([3]);
  });

  test('resolves PNAMES patches through the last matching WAD directory entry', () => {
    const firstPatchPicture = createPatchPicture(1, 1, [[{ pixels: [1], topDelta: 0 }]]);
    const secondPatchPicture = createPatchPicture(1, 1, [[{ pixels: [7], topDelta: 0 }]]);

    const wadBuffer = Buffer.concat([firstPatchPicture, secondPatchPicture]);
    const directory: readonly DirectoryEntry[] = Object.freeze([
      Object.freeze({ name: 'PATCHA', offset: 0, size: firstPatchPicture.length }),
      Object.freeze({ name: 'PATCHA', offset: firstPatchPicture.length, size: secondPatchPicture.length }),
    ]);
    const pnames = createPnames(['PATCHA']);
    const textureOne = createTextureOne([
      {
        height: 1,
        name: 'OVERRIDE',
        patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
        width: 1,
      },
    ]);

    const cache = buildTextureCompositionCache({ directory, pnames, textureOne, textureTwo: null, wadBuffer });
    const texture = cache.textures[0];
    if (texture === undefined) {
      throw new Error('expected override texture composition');
    }
    const patch = texture?.patches[0];

    expect(cache.patchLookup).toEqual([1]);
    expect(patch?.directoryIndex).toBe(1);
    expect(readColumn(texture, 0)).toEqual([7]);
  });

  test('appends TEXTURE2 entries after TEXTURE1 and lets later duplicate names win', () => {
    const firstPatchPicture = createPatchPicture(1, 1, [[{ pixels: [11], topDelta: 0 }]]);
    const secondPatchPicture = createPatchPicture(1, 1, [[{ pixels: [22], topDelta: 0 }]]);

    const wadBuffer = Buffer.concat([firstPatchPicture, secondPatchPicture]);
    const directory: readonly DirectoryEntry[] = Object.freeze([
      Object.freeze({ name: 'PATCHA', offset: 0, size: firstPatchPicture.length }),
      Object.freeze({ name: 'PATCHB', offset: firstPatchPicture.length, size: secondPatchPicture.length }),
    ]);
    const pnames = createPnames(['PATCHA', 'PATCHB']);
    const textureOne = createTextureOne([
      {
        height: 1,
        name: 'DUPTEX',
        patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
        width: 1,
      },
    ]);
    const textureTwo = createTextureTwo([
      {
        height: 1,
        name: 'DUPTEX',
        patches: [{ originX: 0, originY: 0, patchIndex: 1 }],
        width: 1,
      },
    ]);

    const cache = buildTextureCompositionCache({ directory, pnames, textureOne, textureTwo, wadBuffer });
    const textureFromTextureOne = cache.textures[0];
    const textureFromTextureTwo = cache.textures[1];

    if (textureFromTextureOne === undefined || textureFromTextureTwo === undefined) {
      throw new Error('expected both TEXTURE1 and TEXTURE2 compositions');
    }

    expect(cache.textures).toHaveLength(2);
    expect(cache.textureNameToIndex.get('DUPTEX')).toBe(1);
    expect(getTextureComposition(cache, 'duptex')).toBe(textureFromTextureTwo);
    expect(textureFromTextureOne.runtimeIndex).toBe(0);
    expect(textureFromTextureOne.source).toBe('TEXTURE1');
    expect(textureFromTextureTwo.runtimeIndex).toBe(1);
    expect(textureFromTextureTwo.source).toBe('TEXTURE2');
    expect(readColumn(textureFromTextureOne, 0)).toEqual([11]);
    expect(readColumn(textureFromTextureTwo, 0)).toEqual([22]);
  });

  test('clips patch columns and posts to texture bounds', () => {
    const patchPicture = createPatchPicture(3, 3, [[{ pixels: [1, 2, 3], topDelta: 0 }], [{ pixels: [4, 5, 6], topDelta: 1 }], [{ pixels: [7, 8, 9], topDelta: 0 }]]);

    const directory: readonly DirectoryEntry[] = Object.freeze([Object.freeze({ name: 'PATCHA', offset: 0, size: patchPicture.length })]);
    const pnames = createPnames(['PATCHA']);
    const textureOne = createTextureOne([
      {
        height: 2,
        name: 'CLIPPED',
        patches: [{ originX: -1, originY: -1, patchIndex: 0 }],
        width: 2,
      },
    ]);

    const cache = buildTextureCompositionCache({ directory, pnames, textureOne, textureTwo: null, wadBuffer: patchPicture });
    const texture = cache.textures[0];
    if (texture === undefined) {
      throw new Error('expected clipped texture composition');
    }

    expect(readColumn(texture, 0)).toEqual([4, 5]);
    expect(readColumn(texture, 1)).toEqual([8, 9]);
  });

  test('rejects texture definitions whose patch count disagrees with patch entries', () => {
    const textureOne: TextureOneLump = Object.freeze({
      count: 1,
      textures: Object.freeze([
        Object.freeze({
          height: 1,
          masked: 0,
          name: 'BADCOUNT',
          patchCount: 1,
          patches: Object.freeze([]),
          width: 1,
        }),
      ]),
    });

    expect(() => buildTextureCompositionCache({ directory: Object.freeze([]), pnames: createPnames([]), textureOne, textureTwo: null, wadBuffer: Buffer.alloc(0) })).toThrow(
      'buildTextureCompositionCache: texture BADCOUNT declares patchCount 1 but has 0 patches',
    );
  });

  test('rejects texture definitions with negative dimensions', () => {
    const textureOne = createTextureOne([
      {
        height: 1,
        name: 'BADWIDTH',
        patches: [],
        width: -1,
      },
    ]);

    expect(() => buildTextureCompositionCache({ directory: Object.freeze([]), pnames: createPnames([]), textureOne, textureTwo: null, wadBuffer: Buffer.alloc(0) })).toThrow(
      'buildTextureCompositionCache: texture BADWIDTH width must be a non-negative integer, got -1',
    );
  });

  test('rejects a texture patch index outside the PNAMES table', () => {
    const textureOne = createTextureOne([
      {
        height: 1,
        name: 'BADINDEX',
        patches: [{ originX: 0, originY: 0, patchIndex: 0 }],
        width: 1,
      },
    ]);

    expect(() => buildTextureCompositionCache({ directory: Object.freeze([]), pnames: createPnames([]), textureOne, textureTwo: null, wadBuffer: Buffer.alloc(0) })).toThrow(RangeError);
  });

  test('builds the shareware DOOM1 texture cache from the local IWAD', async () => {
    const wadBuffer = Buffer.from(await Bun.file('iwad/DOOM1.WAD').arrayBuffer());
    const header = parseWadHeader(wadBuffer);
    const directory = parseWadDirectory(wadBuffer, header);
    const lookup = new LumpLookup(directory);
    const pnames = parsePnamesLump(lookup.getLumpData('PNAMES', wadBuffer));
    const textureOne = parseTextureOneLump(lookup.getLumpData('TEXTURE1', wadBuffer));
    const textureTwoDirectoryIndex = lookup.checkNumForName('TEXTURE2');
    const textureTwo = textureTwoDirectoryIndex === -1 ? null : parseTextureTwoWhenPresent(lookup.getLumpData('TEXTURE2', wadBuffer));

    const cache = buildTextureCompositionCache({ directory, pnames, textureOne, textureTwo, wadBuffer });
    const bigDoor = getTextureComposition(cache, 'bigdoor1');
    if (bigDoor === null) {
      throw new Error('expected BIGDOOR1 composition');
    }

    expect(cache.category).toBe('static');
    expect(cache.patchLookup).toHaveLength(350);
    expect(cache.tag).toBe('PU_STATIC');
    expect(cache.textures).toHaveLength(125);
    expect(bigDoor.height).toBe(96);
    expect(bigDoor.patchCount).toBe(5);
    expect(bigDoor.source).toBe('TEXTURE1');
    expect(bigDoor.width).toBe(128);
    expect(bigDoor.columns).toHaveLength(128);
    expect(readColumn(bigDoor, 0)).toHaveLength(96);
    expect(readColumn(bigDoor, 0).some((pixel) => pixel !== 0)).toBe(true);
  });
});

interface SyntheticTextureInput {
  readonly height: number;
  readonly name: string;
  readonly patches: readonly {
    readonly originX: number;
    readonly originY: number;
    readonly patchIndex: number;
  }[];
  readonly width: number;
}

function createPatchPicture(width: number, height: number, columns: readonly SyntheticPatchColumn[]): Buffer {
  if (columns.length !== width) {
    throw new RangeError(`synthetic patch expected ${width} columns, got ${columns.length}`);
  }

  const headerBytes = 8;
  const columnOffsetBytes = 4;
  const columnTableEnd = headerBytes + width * columnOffsetBytes;
  const columnPayloads = columns.map((column) => {
    const bytes: number[] = [];
    for (const post of column) {
      bytes.push(post.topDelta, post.pixels.length, 0, ...post.pixels, 0);
    }
    bytes.push(0xff);
    return Buffer.from(bytes);
  });
  const payloadBytes = columnPayloads.reduce((total, payload) => total + payload.length, 0);
  const buffer = Buffer.alloc(columnTableEnd + payloadBytes);

  buffer.writeInt16LE(width, 0);
  buffer.writeInt16LE(height, 2);
  buffer.writeInt16LE(0, 4);
  buffer.writeInt16LE(0, 6);

  let cursor = columnTableEnd;
  for (let columnIndex = 0; columnIndex < columnPayloads.length; columnIndex += 1) {
    const payload = columnPayloads[columnIndex]!;
    buffer.writeInt32LE(cursor, headerBytes + columnIndex * columnOffsetBytes);
    payload.copy(buffer, cursor);
    cursor += payload.length;
  }

  return buffer;
}

function createPnames(names: readonly string[]): PnamesLump {
  return Object.freeze({
    count: names.length,
    names: Object.freeze([...names]),
  });
}

function createTextureOne(textures: readonly SyntheticTextureInput[]): TextureOneLump {
  return Object.freeze({
    count: textures.length,
    textures: Object.freeze(
      textures.map((texture) =>
        Object.freeze({
          height: texture.height,
          masked: 0,
          name: texture.name,
          patchCount: texture.patches.length,
          patches: Object.freeze(texture.patches.map((patch) => Object.freeze({ originX: patch.originX, originY: patch.originY, patchIndex: patch.patchIndex }))),
          width: texture.width,
        }),
      ),
    ),
  });
}

function createTextureTwo(textures: readonly SyntheticTextureInput[]): TextureTwoLump {
  return Object.freeze({
    count: textures.length,
    textures: Object.freeze(
      textures.map((texture) =>
        Object.freeze({
          height: texture.height,
          masked: 0,
          name: texture.name,
          patchCount: texture.patches.length,
          patches: Object.freeze(texture.patches.map((patch) => Object.freeze({ originX: patch.originX, originY: patch.originY, patchIndex: patch.patchIndex }))),
          width: texture.width,
        }),
      ),
    ),
  });
}

function readColumn(texture: { readonly columns: readonly Uint8Array[] }, columnIndex: number): number[] {
  const column = texture.columns[columnIndex];
  if (column === undefined) {
    throw new RangeError(`texture column ${columnIndex} is missing`);
  }
  return Array.from(column);
}
