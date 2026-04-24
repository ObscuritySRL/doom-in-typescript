import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { parsePnames } from '../../src/assets/pnames.ts';
import { TEXTURE_COUNT_SIZE, TEXTURE_DEFINITION_HEADER_SIZE, TEXTURE_NAME_SIZE, TEXTURE_OFFSET_SIZE, TEXTURE_PATCH_ENTRY_SIZE, parseTextureLump } from '../../src/assets/texture1.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lookup = new LumpLookup(directory);
const texture1Data = lookup.getLumpData('TEXTURE1', wadBuffer);
const textures = parseTextureLump(texture1Data);
const pnames = parsePnames(lookup.getLumpData('PNAMES', wadBuffer));

describe('TEXTURE1 constants', () => {
  it('TEXTURE_COUNT_SIZE is 4', () => {
    expect(TEXTURE_COUNT_SIZE).toBe(4);
  });

  it('TEXTURE_OFFSET_SIZE is 4', () => {
    expect(TEXTURE_OFFSET_SIZE).toBe(4);
  });

  it('TEXTURE_DEFINITION_HEADER_SIZE is 22', () => {
    expect(TEXTURE_DEFINITION_HEADER_SIZE).toBe(22);
  });

  it('TEXTURE_NAME_SIZE is 8', () => {
    expect(TEXTURE_NAME_SIZE).toBe(8);
  });

  it('TEXTURE_PATCH_ENTRY_SIZE is 10', () => {
    expect(TEXTURE_PATCH_ENTRY_SIZE).toBe(10);
  });
});

describe('parseTextureLump with DOOM1.WAD', () => {
  it('returns 125 textures for shareware TEXTURE1', () => {
    expect(textures.length).toBe(125);
  });

  it('first texture is AASTINKY', () => {
    expect(textures[0]!.name).toBe('AASTINKY');
  });

  it('second texture is BIGDOOR1', () => {
    expect(textures[1]!.name).toBe('BIGDOOR1');
  });

  it('last texture is TEKWALL5', () => {
    expect(textures[textures.length - 1]!.name).toBe('TEKWALL5');
  });

  it('AASTINKY dimensions are 24x72 with 2 patches', () => {
    const first = textures[0]!;
    expect(first.width).toBe(24);
    expect(first.height).toBe(72);
    expect(first.patchCount).toBe(2);
    expect(first.patches.length).toBe(2);
  });

  it('all names are non-empty uppercase ASCII', () => {
    for (const texture of textures) {
      expect(texture.name.length).toBeGreaterThan(0);
      expect(texture.name.length).toBeLessThanOrEqual(TEXTURE_NAME_SIZE);
      expect(texture.name).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it('all 125 texture names are unique', () => {
    const names = new Set(textures.map((t) => t.name));
    expect(names.size).toBe(125);
  });

  it('all textures have positive width and height', () => {
    for (const texture of textures) {
      expect(texture.width).toBeGreaterThan(0);
      expect(texture.height).toBeGreaterThan(0);
    }
  });

  it('every texture has at least one patch', () => {
    for (const texture of textures) {
      expect(texture.patchCount).toBeGreaterThan(0);
      expect(texture.patches.length).toBe(texture.patchCount);
    }
  });

  it('total patch count across all textures is 598', () => {
    let total = 0;
    for (const texture of textures) {
      total += texture.patchCount;
    }
    expect(total).toBe(598);
  });

  it('all patch indices are within PNAMES range [0, 349]', () => {
    for (const texture of textures) {
      for (const patch of texture.patches) {
        expect(patch.patchIndex).toBeGreaterThanOrEqual(0);
        expect(patch.patchIndex).toBeLessThan(pnames.length);
      }
    }
  });

  it('no masked textures in shareware TEXTURE1', () => {
    const maskedCount = textures.filter((t) => t.masked).length;
    expect(maskedCount).toBe(0);
  });

  it('returned array is frozen', () => {
    expect(Object.isFrozen(textures)).toBe(true);
  });

  it('individual patch arrays are frozen', () => {
    for (const texture of textures) {
      expect(Object.isFrozen(texture.patches)).toBe(true);
    }
  });

  it('TEXTURE1 lump exists in the WAD directory', () => {
    expect(lookup.hasLump('TEXTURE1')).toBe(true);
  });

  it('TEXTURE2 lump does not exist in shareware WAD', () => {
    expect(lookup.hasLump('TEXTURE2')).toBe(false);
  });

  it('lump size matches expected layout', () => {
    // count header + count * offset + texture definitions
    expect(texture1Data.length).toBe(9234);
  });

  it('accepts Uint8Array input', () => {
    const uint8 = new Uint8Array(texture1Data);
    const result = parseTextureLump(uint8);
    expect(result.length).toBe(125);
    expect(result[0]!.name).toBe('AASTINKY');
  });

  it('accepts Uint8Array subarray input with a non-zero byteOffset', () => {
    const container = Buffer.alloc(texture1Data.length + 4);
    texture1Data.copy(container, 2);
    const uint8 = new Uint8Array(container.buffer, container.byteOffset + 2, texture1Data.length);
    const result = parseTextureLump(uint8);
    expect(result.length).toBe(125);
    expect(result[0]!.name).toBe('AASTINKY');
    expect(result[result.length - 1]!.name).toBe('TEKWALL5');
  });
});

describe('error handling', () => {
  it('throws RangeError for data smaller than count size', () => {
    const tooSmall = Buffer.alloc(TEXTURE_COUNT_SIZE - 1);
    expect(() => parseTextureLump(tooSmall)).toThrow(RangeError);
  });

  it('throws RangeError for negative texture count', () => {
    const buffer = Buffer.alloc(TEXTURE_COUNT_SIZE);
    buffer.writeInt32LE(-1, 0);
    expect(() => parseTextureLump(buffer)).toThrow(RangeError);
  });

  it('throws RangeError when offset directory exceeds lump size', () => {
    const buffer = Buffer.alloc(TEXTURE_COUNT_SIZE);
    buffer.writeInt32LE(100, 0); // claims 100 textures but only 4 bytes total
    expect(() => parseTextureLump(buffer)).toThrow(RangeError);
  });

  it('throws RangeError when texture offset points past lump end', () => {
    // 1 texture with offset pointing beyond the buffer
    const buffer = Buffer.alloc(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE);
    buffer.writeInt32LE(1, 0);
    buffer.writeInt32LE(99999, 4); // bad offset
    expect(() => parseTextureLump(buffer)).toThrow(RangeError);
  });

  it('handles zero-count TEXTUREx lump', () => {
    const buffer = Buffer.alloc(TEXTURE_COUNT_SIZE);
    buffer.writeInt32LE(0, 0);
    const result = parseTextureLump(buffer);
    expect(result.length).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('throws RangeError for negative patchCount', () => {
    const buffer = Buffer.alloc(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE + TEXTURE_DEFINITION_HEADER_SIZE);
    let pos = 0;
    buffer.writeInt32LE(1, pos);
    pos += 4;
    buffer.writeInt32LE(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE, pos);
    pos += 4;
    buffer.write('BADPATCH', pos, 'ascii');
    pos += 8; // name
    buffer.writeInt32LE(0, pos);
    pos += 4; // masked
    buffer.writeInt16LE(64, pos);
    pos += 2; // width
    buffer.writeInt16LE(64, pos);
    pos += 2; // height
    buffer.writeInt32LE(0, pos);
    pos += 4; // obsolete
    buffer.writeInt16LE(-1, pos); // negative patchcount
    expect(() => parseTextureLump(buffer)).toThrow(RangeError);
  });

  it('throws RangeError when patch data extends past lump end', () => {
    // Header claims 2 patches but buffer only holds space for 1 patch entry.
    const buffer = Buffer.alloc(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE + TEXTURE_DEFINITION_HEADER_SIZE + TEXTURE_PATCH_ENTRY_SIZE);
    let pos = 0;
    buffer.writeInt32LE(1, pos);
    pos += 4;
    buffer.writeInt32LE(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE, pos);
    pos += 4;
    buffer.write('TRUNCPCH', pos, 'ascii');
    pos += 8; // name
    buffer.writeInt32LE(0, pos);
    pos += 4; // masked
    buffer.writeInt16LE(64, pos);
    pos += 2; // width
    buffer.writeInt16LE(64, pos);
    pos += 2; // height
    buffer.writeInt32LE(0, pos);
    pos += 4; // obsolete
    buffer.writeInt16LE(2, pos); // claims 2 patches but buffer only fits 1
    expect(() => parseTextureLump(buffer)).toThrow(RangeError);
  });

  it('throws RangeError for non-positive texture dimensions', () => {
    const buffer = Buffer.alloc(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE + TEXTURE_DEFINITION_HEADER_SIZE + TEXTURE_PATCH_ENTRY_SIZE);
    let pos = 0;
    buffer.writeInt32LE(1, pos);
    pos += 4;
    buffer.writeInt32LE(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE, pos);
    pos += 4;
    buffer.write('ZEROWIDE', pos, 'ascii');
    pos += 8; // name
    buffer.writeInt32LE(0, pos);
    pos += 4; // masked
    buffer.writeInt16LE(0, pos);
    pos += 2; // width
    buffer.writeInt16LE(64, pos);
    pos += 2; // height
    buffer.writeInt32LE(0, pos);
    pos += 4; // obsolete
    buffer.writeInt16LE(1, pos);
    pos += 2; // patchcount
    buffer.writeInt16LE(0, pos);
    pos += 2; // originX
    buffer.writeInt16LE(0, pos);
    pos += 2; // originY
    buffer.writeInt16LE(0, pos);
    pos += 2; // patchIndex
    buffer.writeInt16LE(0, pos);
    pos += 2; // stepdir
    buffer.writeInt16LE(0, pos); // colormap
    expect(() => parseTextureLump(buffer)).toThrow(/positive dimensions/);
  });

  it('throws RangeError for negative patch indices', () => {
    const buffer = Buffer.alloc(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE + TEXTURE_DEFINITION_HEADER_SIZE + TEXTURE_PATCH_ENTRY_SIZE);
    let pos = 0;
    buffer.writeInt32LE(1, pos);
    pos += 4;
    buffer.writeInt32LE(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE, pos);
    pos += 4;
    buffer.write('BADINDEX', pos, 'ascii');
    pos += 8; // name
    buffer.writeInt32LE(0, pos);
    pos += 4; // masked
    buffer.writeInt16LE(64, pos);
    pos += 2; // width
    buffer.writeInt16LE(64, pos);
    pos += 2; // height
    buffer.writeInt32LE(0, pos);
    pos += 4; // obsolete
    buffer.writeInt16LE(1, pos);
    pos += 2; // patchcount
    buffer.writeInt16LE(0, pos);
    pos += 2; // originX
    buffer.writeInt16LE(0, pos);
    pos += 2; // originY
    buffer.writeInt16LE(-1, pos);
    pos += 2; // patchIndex
    buffer.writeInt16LE(0, pos);
    pos += 2; // stepdir
    buffer.writeInt16LE(0, pos); // colormap
    expect(() => parseTextureLump(buffer)).toThrow(/negative patch index/);
  });
});

describe('parity-sensitive edge cases', () => {
  it('texture index order is load-bearing (renderer indexes by position)', () => {
    // The first few textures must appear in exact lump order because
    // the engine references textures by numeric index, not name.
    expect(textures[0]!.name).toBe('AASTINKY');
    expect(textures[1]!.name).toBe('BIGDOOR1');
    expect(textures[2]!.name).toBe('BIGDOOR2');
    expect(textures[3]!.name).toBe('BIGDOOR4');
    expect(textures[4]!.name).toBe('BRNBIGC');
  });

  it('patch originX/originY are signed (can be negative)', () => {
    // Some textures use negative patch origins to compose patches
    // that extend beyond the texture boundary.
    let hasNegativeOrigin = false;
    for (const texture of textures) {
      for (const patch of texture.patches) {
        if (patch.originX < 0 || patch.originY < 0) {
          hasNegativeOrigin = true;
          break;
        }
      }
      if (hasNegativeOrigin) break;
    }
    // Whether or not negatives exist in this WAD, the parser must
    // accept signed values — verify at minimum that the type allows it.
    // Build a synthetic texture with negative origin:
    const synth = Buffer.alloc(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE + TEXTURE_DEFINITION_HEADER_SIZE + TEXTURE_PATCH_ENTRY_SIZE);
    let pos = 0;
    synth.writeInt32LE(1, pos);
    pos += 4; // count
    synth.writeInt32LE(TEXTURE_COUNT_SIZE + TEXTURE_OFFSET_SIZE, pos);
    pos += 4; // offset
    // texture header
    synth.write('TEST\0\0\0\0', pos, 'ascii');
    pos += 8; // name
    synth.writeInt32LE(0, pos);
    pos += 4; // masked
    synth.writeInt16LE(64, pos);
    pos += 2; // width
    synth.writeInt16LE(64, pos);
    pos += 2; // height
    synth.writeInt32LE(0, pos);
    pos += 4; // obsolete
    synth.writeInt16LE(1, pos);
    pos += 2; // patchcount
    // patch entry with negative origins
    synth.writeInt16LE(-16, pos);
    pos += 2; // originX
    synth.writeInt16LE(-8, pos);
    pos += 2; // originY
    synth.writeInt16LE(0, pos);
    pos += 2; // patchIndex
    synth.writeInt16LE(0, pos);
    pos += 2; // stepdir
    synth.writeInt16LE(0, pos); // colormap

    const result = parseTextureLump(synth);
    expect(result[0]!.patches[0]!.originX).toBe(-16);
    expect(result[0]!.patches[0]!.originY).toBe(-8);
  });

  it('maximum patch index (162) is within PNAMES bounds', () => {
    let maxIndex = -1;
    for (const texture of textures) {
      for (const patch of texture.patches) {
        if (patch.patchIndex > maxIndex) maxIndex = patch.patchIndex;
      }
    }
    expect(maxIndex).toBe(162);
    expect(maxIndex).toBeLessThan(pnames.length);
  });

  it('offset directory values point to valid texture definitions', () => {
    // Read the raw offset directory and verify each points within bounds
    const count = texture1Data.readInt32LE(0);
    for (let i = 0; i < count; i++) {
      const offset = texture1Data.readInt32LE(TEXTURE_COUNT_SIZE + i * TEXTURE_OFFSET_SIZE);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset + TEXTURE_DEFINITION_HEADER_SIZE).toBeLessThanOrEqual(texture1Data.length);
    }
  });
});
