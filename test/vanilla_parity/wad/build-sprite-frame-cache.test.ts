import { describe, expect, test } from 'bun:test';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';

import { buildSpriteFrameCache, getSpriteFrameCacheEntry, loadSpriteFramePatch } from '../../../src/assets/build-sprite-frame-cache.ts';
import { PATCH_HEADER_BYTES } from '../../../src/assets/parse-patch-picture-format.ts';
import { SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE } from '../../../src/assets/parse-sprite-namespace.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';

describe('buildSpriteFrameCache', () => {
  test('builds static metadata arrays and purgable patch policy from a sprite namespace', () => {
    const wadBuffer = buildSingleColumnPatchBuffer({
      height: 2,
      leftOffset: -5,
      pixels: [13, 37],
      topOffset: 7,
      width: 1,
    });
    const directory = makeSingleSpriteDirectory('TESTA0', wadBuffer.length);

    const cache = buildSpriteFrameCache({ directory, wadBuffer });
    const entry = cache.entries[0]!;
    const loadedPatch = loadSpriteFramePatch(cache, wadBuffer, 0);

    expect(Object.isFrozen(cache)).toBe(true);
    expect(Object.isFrozen(cache.entries)).toBe(true);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(cache.category).toBe('static');
    expect(cache.patchCategory).toBe('purgable');
    expect(cache.patchTag).toBe('PU_CACHE');
    expect(cache.tag).toBe('PU_STATIC');
    expect(entry).toEqual({
      directoryIndex: 1,
      height: 2,
      name: 'TESTA0',
      offset: 0,
      size: wadBuffer.length,
      spriteNumber: 0,
      spriteOffset: -5 << 16,
      spriteTopOffset: 7 << 16,
      spriteWidth: 1 << 16,
      width: 1,
    });
    expect(cache.spriteOffsets).toEqual([-5 << 16]);
    expect(cache.spriteTopOffsets).toEqual([7 << 16]);
    expect(cache.spriteWidths).toEqual([1 << 16]);
    expect(getSpriteFrameCacheEntry(cache, 0)).toBe(entry);
    expect(getSpriteFrameCacheEntry(cache, 'testa0')).toBe(entry);
    expect(loadedPatch.columns[0]![0]!.pixels).toEqual(new Uint8Array([13, 37]));
  });

  test('rejects sprite lumps too small to contain a patch header', () => {
    const wadBuffer = Buffer.alloc(PATCH_HEADER_BYTES - 1);
    const directory = makeSingleSpriteDirectory('BADA0', wadBuffer.length);

    expect(() => buildSpriteFrameCache({ directory, wadBuffer })).toThrow(RangeError);
  });

  test('matches the live shareware DOOM1.WAD sprite metadata oracle', async () => {
    const wadBuffer = await readSharewareWad();
    const directory = parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer));

    const cache = buildSpriteFrameCache({ directory, wadBuffer });
    const oracle = SHAREWARE_DOOM1_WAD_SPRITE_NAMESPACE_ORACLE;

    expect(cache.entries).toHaveLength(oracle.numSpriteLumps);
    expect(cache.namespace.firstSpriteIndex).toBe(oracle.firstSpriteIndex);
    expect(cache.namespace.lastSpriteIndex).toBe(oracle.lastSpriteIndex);
    expect(cache.namespace.numSpriteLumps).toBe(oracle.numSpriteLumps);

    for (const pinnedSprite of oracle.pinnedSprites) {
      const entry = getSpriteFrameCacheEntry(cache, pinnedSprite.name);
      expect(entry).not.toBeNull();
      expect(entry).toMatchObject({
        directoryIndex: pinnedSprite.directoryIndex,
        name: pinnedSprite.name,
        offset: pinnedSprite.fileOffset,
        size: pinnedSprite.size,
        spriteNumber: pinnedSprite.spriteNumber,
        spriteOffset: pinnedSprite.patchLeftoffset << 16,
        spriteTopOffset: pinnedSprite.patchTopoffset << 16,
        spriteWidth: pinnedSprite.patchWidth << 16,
        width: pinnedSprite.patchWidth,
      });
      expect(cache.spriteWidths[pinnedSprite.spriteNumber]).toBe(pinnedSprite.patchWidth << 16);
      expect(loadSpriteFramePatch(cache, wadBuffer, pinnedSprite.spriteNumber).header.width).toBe(pinnedSprite.patchWidth);
    }
  });
});

async function readSharewareWad(): Promise<Buffer> {
  const wadPaths = ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'];
  for (const wadPath of wadPaths) {
    const wadFile = Bun.file(wadPath);
    if (await wadFile.exists()) {
      return Buffer.from(await wadFile.arrayBuffer());
    }
  }
  throw new Error('build-sprite-frame-cache test requires doom/DOOM1.WAD or iwad/DOOM1.WAD');
}

function buildSingleColumnPatchBuffer(input: { readonly height: number; readonly leftOffset: number; readonly pixels: readonly number[]; readonly topOffset: number; readonly width: number }): Buffer {
  const columnOffset = PATCH_HEADER_BYTES + 4;
  const buffer = Buffer.alloc(columnOffset + 3 + input.pixels.length + 1 + 1);
  buffer.writeInt16LE(input.width, 0);
  buffer.writeInt16LE(input.height, 2);
  buffer.writeInt16LE(input.leftOffset, 4);
  buffer.writeInt16LE(input.topOffset, 6);
  buffer.writeInt32LE(columnOffset, PATCH_HEADER_BYTES);
  buffer[columnOffset] = 0;
  buffer[columnOffset + 1] = input.pixels.length;
  buffer[columnOffset + 2] = 0;
  for (let pixelIndex = 0; pixelIndex < input.pixels.length; pixelIndex += 1) {
    buffer[columnOffset + 3 + pixelIndex] = input.pixels[pixelIndex]!;
  }
  buffer[columnOffset + 3 + input.pixels.length] = 0;
  buffer[columnOffset + 4 + input.pixels.length] = 0xff;
  return buffer;
}

function makeSingleSpriteDirectory(name: string, size: number): readonly DirectoryEntry[] {
  return Object.freeze([Object.freeze({ name: 'S_START', offset: 0, size: 0 }), Object.freeze({ name, offset: 0, size }), Object.freeze({ name: 'S_END', offset: size, size: 0 })]);
}
