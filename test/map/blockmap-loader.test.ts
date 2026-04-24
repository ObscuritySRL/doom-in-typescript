import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { FRACBITS } from '../../src/core/fixed.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle, findMapNames } from '../../src/map/mapBundle.ts';
import { parseVertexes } from '../../src/map/lineSectorGeometry.ts';
import { BLOCKMAP_HEADER_SIZE, BLOCKMAP_HEADER_WORDS, MAPBLOCKSIZE, MAPBTOFRAC, MAPBLOCKSHIFT, parseBlockmap } from '../../src/map/blockmap.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';

import wadMapSummary from '../../reference/manifests/wad-map-summary.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1Blockmap = parseBlockmap(e1m1Bundle.blockmap);
const e1m1Vertexes = parseVertexes(e1m1Bundle.vertexes);

describe('constants', () => {
  it('BLOCKMAP_HEADER_SIZE is 8', () => {
    expect(BLOCKMAP_HEADER_SIZE).toBe(8);
  });

  it('BLOCKMAP_HEADER_WORDS is 4', () => {
    expect(BLOCKMAP_HEADER_WORDS).toBe(4);
  });

  it('MAPBLOCKSIZE is 128', () => {
    expect(MAPBLOCKSIZE).toBe(128);
  });

  it('MAPBTOFRAC is 7', () => {
    expect(MAPBTOFRAC).toBe(7);
  });

  it('MAPBLOCKSHIFT is FRACBITS + 7', () => {
    expect(MAPBLOCKSHIFT).toBe(FRACBITS + 7);
    expect(MAPBLOCKSHIFT).toBe(23);
  });

  it('MAPBLOCKSIZE equals 1 << MAPBTOFRAC', () => {
    expect(MAPBLOCKSIZE).toBe(1 << MAPBTOFRAC);
  });
});

describe('parseBlockmap E1M1', () => {
  it('returns a frozen object', () => {
    expect(Object.isFrozen(e1m1Blockmap)).toBe(true);
  });

  it('offsets array is frozen', () => {
    expect(Object.isFrozen(e1m1Blockmap.offsets)).toBe(true);
  });

  it('columns and rows are positive integers', () => {
    expect(e1m1Blockmap.columns).toBeGreaterThan(0);
    expect(e1m1Blockmap.rows).toBeGreaterThan(0);
    expect(Number.isInteger(e1m1Blockmap.columns)).toBe(true);
    expect(Number.isInteger(e1m1Blockmap.rows)).toBe(true);
  });

  it('cell count matches columns × rows', () => {
    expect(e1m1Blockmap.offsets.length).toBe(e1m1Blockmap.columns * e1m1Blockmap.rows);
  });

  it('origins are in 16.16 fixed-point (fractional bits zero)', () => {
    expect(e1m1Blockmap.originX & 0xffff).toBe(0);
    expect(e1m1Blockmap.originY & 0xffff).toBe(0);
  });

  it('lump size matches wad-map-summary', () => {
    const e1m1Summary = (wadMapSummary as { maps: { name: string; lumps: { name: string; size: number }[] }[] }).maps.find((map) => map.name === 'E1M1')!;
    const blockmapLump = e1m1Summary.lumps.find((lump) => lump.name === 'BLOCKMAP')!;
    expect(e1m1Bundle.blockmap.length).toBe(blockmapLump.size);
  });

  it('lump size is consistent with header and offset table', () => {
    const cellCount = e1m1Blockmap.columns * e1m1Blockmap.rows;
    const headerAndOffsets = BLOCKMAP_HEADER_SIZE + cellCount * 2;
    expect(e1m1Bundle.blockmap.length).toBeGreaterThanOrEqual(headerAndOffsets);
  });

  it('all offsets are within lump bounds', () => {
    const totalWords = e1m1Bundle.blockmap.length / 2;
    for (const offset of e1m1Blockmap.offsets) {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(totalWords);
    }
  });

  it('all offsets point past the header and offset table', () => {
    const cellCount = e1m1Blockmap.columns * e1m1Blockmap.rows;
    const firstBlockListWord = BLOCKMAP_HEADER_WORDS + cellCount;
    for (const offset of e1m1Blockmap.offsets) {
      expect(offset).toBeGreaterThanOrEqual(firstBlockListWord);
    }
  });

  it('every block list is terminated by -1', () => {
    const lump = e1m1Blockmap.lumpData;
    for (const wordOffset of e1m1Blockmap.offsets) {
      let cursor = wordOffset * 2;
      let foundTerminator = false;
      while (cursor + 2 <= lump.length) {
        const value = lump.readInt16LE(cursor);
        cursor += 2;
        if (value === -1) {
          foundTerminator = true;
          break;
        }
      }
      expect(foundTerminator).toBe(true);
    }
  });

  it('every block list starts with a 0 entry', () => {
    const lump = e1m1Blockmap.lumpData;
    for (const wordOffset of e1m1Blockmap.offsets) {
      const firstEntry = lump.readInt16LE(wordOffset * 2);
      expect(firstEntry).toBe(0);
    }
  });

  it('block list linedef indices are non-negative', () => {
    const lump = e1m1Blockmap.lumpData;
    for (const wordOffset of e1m1Blockmap.offsets) {
      let cursor = wordOffset * 2;
      while (cursor + 2 <= lump.length) {
        const value = lump.readInt16LE(cursor);
        cursor += 2;
        if (value === -1) break;
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('origin covers all map vertexes', () => {
    const originMapX = e1m1Blockmap.originX >> FRACBITS;
    const originMapY = e1m1Blockmap.originY >> FRACBITS;
    for (const vertex of e1m1Vertexes) {
      const mapX = vertex.x >> FRACBITS;
      const mapY = vertex.y >> FRACBITS;
      expect(mapX).toBeGreaterThanOrEqual(originMapX);
      expect(mapY).toBeGreaterThanOrEqual(originMapY);
    }
  });

  it('grid extent covers all map vertexes', () => {
    const originMapX = e1m1Blockmap.originX >> FRACBITS;
    const originMapY = e1m1Blockmap.originY >> FRACBITS;
    const maxX = originMapX + e1m1Blockmap.columns * MAPBLOCKSIZE;
    const maxY = originMapY + e1m1Blockmap.rows * MAPBLOCKSIZE;
    for (const vertex of e1m1Vertexes) {
      const mapX = vertex.x >> FRACBITS;
      const mapY = vertex.y >> FRACBITS;
      expect(mapX).toBeLessThanOrEqual(maxX);
      expect(mapY).toBeLessThanOrEqual(maxY);
    }
  });

  it('lumpData is the original buffer reference', () => {
    expect(e1m1Blockmap.lumpData).toBe(e1m1Bundle.blockmap);
  });

  it('accepts Uint8Array input', () => {
    const uint8 = new Uint8Array(e1m1Bundle.blockmap);
    const result = parseBlockmap(Buffer.from(uint8));
    expect(result.columns).toBe(e1m1Blockmap.columns);
    expect(result.rows).toBe(e1m1Blockmap.rows);
  });
});

describe('all 9 maps', () => {
  const mapNames = findMapNames(directory);

  it('every map has a parseable blockmap', () => {
    expect(mapNames.length).toBe(9);
    for (const name of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, name);
      const blockmap = parseBlockmap(bundle.blockmap);
      expect(blockmap.columns).toBeGreaterThan(0);
      expect(blockmap.rows).toBeGreaterThan(0);
      expect(blockmap.offsets.length).toBe(blockmap.columns * blockmap.rows);
    }
  });

  it('every map blockmap has valid terminators', () => {
    for (const name of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, name);
      const blockmap = parseBlockmap(bundle.blockmap);
      for (const wordOffset of blockmap.offsets) {
        let cursor = wordOffset * 2;
        let foundTerminator = false;
        while (cursor + 2 <= blockmap.lumpData.length) {
          const value = blockmap.lumpData.readInt16LE(cursor);
          cursor += 2;
          if (value === -1) {
            foundTerminator = true;
            break;
          }
        }
        expect(foundTerminator).toBe(true);
      }
    }
  });
});

describe('error handling', () => {
  it('throws RangeError on empty buffer', () => {
    expect(() => parseBlockmap(Buffer.alloc(0))).toThrow(RangeError);
  });

  it('throws RangeError on buffer smaller than header', () => {
    expect(() => parseBlockmap(Buffer.alloc(6))).toThrow(RangeError);
  });

  it('throws RangeError on odd-sized buffer', () => {
    const buffer = Buffer.alloc(9);
    buffer.writeInt16LE(0, 0);
    buffer.writeInt16LE(0, 2);
    buffer.writeInt16LE(1, 4);
    buffer.writeInt16LE(1, 6);
    expect(() => parseBlockmap(buffer)).toThrow(RangeError);
  });

  it('throws RangeError on zero columns', () => {
    const buffer = Buffer.alloc(8);
    buffer.writeInt16LE(0, 0);
    buffer.writeInt16LE(0, 2);
    buffer.writeInt16LE(0, 4);
    buffer.writeInt16LE(1, 6);
    expect(() => parseBlockmap(buffer)).toThrow(RangeError);
  });

  it('throws RangeError on negative rows', () => {
    const buffer = Buffer.alloc(8);
    buffer.writeInt16LE(0, 0);
    buffer.writeInt16LE(0, 2);
    buffer.writeInt16LE(1, 4);
    buffer.writeInt16LE(-1, 6);
    expect(() => parseBlockmap(buffer)).toThrow(RangeError);
  });

  it('throws RangeError when lump is too small for declared grid', () => {
    const buffer = Buffer.alloc(8);
    buffer.writeInt16LE(0, 0);
    buffer.writeInt16LE(0, 2);
    buffer.writeInt16LE(10, 4);
    buffer.writeInt16LE(10, 6);
    expect(() => parseBlockmap(buffer)).toThrow(RangeError);
  });

  it('throws RangeError on out-of-bounds offset in table', () => {
    // 1×1 grid: header(8) + 1 offset(2) = 10 bytes, offset points beyond lump
    const buffer = Buffer.alloc(10);
    buffer.writeInt16LE(0, 0);
    buffer.writeInt16LE(0, 2);
    buffer.writeInt16LE(1, 4);
    buffer.writeInt16LE(1, 6);
    buffer.writeInt16LE(999, 8); // way out of bounds
    expect(() => parseBlockmap(buffer)).toThrow(RangeError);
  });
});

describe('parity-sensitive edge cases', () => {
  it('origin is stored as header word << FRACBITS with sign extension', () => {
    const rawOriginX = e1m1Bundle.blockmap.readInt16LE(0);
    const rawOriginY = e1m1Bundle.blockmap.readInt16LE(2);
    expect(e1m1Blockmap.originX).toBe((rawOriginX << FRACBITS) | 0);
    expect(e1m1Blockmap.originY).toBe((rawOriginY << FRACBITS) | 0);
  });

  it('MAPBLOCKSHIFT converts fixed-point to block index in one shift', () => {
    const originMapX = e1m1Blockmap.originX >> FRACBITS;
    const testFixedX = ((originMapX + MAPBLOCKSIZE) << FRACBITS) | 0;
    const blockIndex = (testFixedX - e1m1Blockmap.originX) >> MAPBLOCKSHIFT;
    expect(blockIndex).toBe(1);
  });

  it('block list terminator is -1 (0xFFFF as signed int16)', () => {
    const lump = e1m1Blockmap.lumpData;
    const firstOffset = e1m1Blockmap.offsets[0]!;
    let cursor = firstOffset * 2;
    let lastValue = 0;
    while (cursor + 2 <= lump.length) {
      lastValue = lump.readInt16LE(cursor);
      cursor += 2;
      if (lastValue === -1) break;
    }
    expect(lastValue).toBe(-1);
    // Same bytes read as unsigned = 0xFFFF
    const terminatorUnsigned = lump.readUInt16LE(cursor - 2);
    expect(terminatorUnsigned).toBe(0xffff);
  });

  it('shared offsets: multiple cells may reference the same block list', () => {
    const offsetSet = new Set(e1m1Blockmap.offsets);
    // Not all cells have unique block lists — some share the same offset
    // (e.g., empty cells with no linedefs may share a 0/-1 list)
    expect(offsetSet.size).toBeLessThanOrEqual(e1m1Blockmap.offsets.length);
  });

  it('negative origin values produce correct fixed-point via sign extension', () => {
    // E1M1 has negative y coordinates, so originY should be negative
    const rawOriginY = e1m1Bundle.blockmap.readInt16LE(2);
    if (rawOriginY < 0) {
      expect(e1m1Blockmap.originY).toBeLessThan(0);
      // Verify the | 0 truncation matches the shift
      expect(e1m1Blockmap.originY).toBe((rawOriginY << FRACBITS) | 0);
    }
  });

  it('lump size is always even (word-aligned)', () => {
    const mapNames = findMapNames(directory);
    for (const name of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, name);
      expect(bundle.blockmap.length % 2).toBe(0);
    }
  });
});
