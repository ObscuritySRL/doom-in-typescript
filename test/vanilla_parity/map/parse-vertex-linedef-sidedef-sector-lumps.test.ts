import { describe, expect, test } from 'bun:test';

import {
  VANILLA_LINEDEF_BYTES,
  VANILLA_SECTOR_BYTES,
  VANILLA_SIDEDEF_BYTES,
  VANILLA_TEXTURE_NAME_BYTES,
  VANILLA_VERTEX_BYTES,
  parseLineDefLump,
  parseSectorLump,
  parseSideDefLump,
  parseVertexLump,
} from '../../../src/map/parse-vertex-linedef-sidedef-sector-lumps.ts';

describe('vanilla map lump byte sizes', () => {
  test('VERTEX 4, LINEDEF 14, SIDEDEF 30, SECTOR 26, texture name 8', () => {
    expect(VANILLA_VERTEX_BYTES).toBe(4);
    expect(VANILLA_LINEDEF_BYTES).toBe(14);
    expect(VANILLA_SIDEDEF_BYTES).toBe(30);
    expect(VANILLA_SECTOR_BYTES).toBe(26);
    expect(VANILLA_TEXTURE_NAME_BYTES).toBe(8);
  });
});

describe('parseVertexLump', () => {
  test('decodes signed-16 LE coordinates', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xfe, 0xff]);
    const vertexes = parseVertexLump(bytes);
    expect(vertexes).toHaveLength(2);
    expect(vertexes[0]).toEqual({ x: 0, y: 0 });
    expect(vertexes[1]).toEqual({ x: -1, y: -2 });
  });

  test('throws on non-multiple-of-4 input', () => {
    expect(() => parseVertexLump(new Uint8Array(5))).toThrow(RangeError);
  });
});

describe('parseLineDefLump', () => {
  test('decodes the 14-byte linedef record', () => {
    const bytes = new Uint8Array([0x01, 0x00, 0x02, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff]);
    const lines = parseLineDefLump(bytes);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.v1).toBe(1);
    expect(lines[0]?.v2).toBe(2);
    expect(lines[0]?.flags).toBe(4);
    expect(lines[0]?.sidenum[0]).toBe(0);
    expect(lines[0]?.sidenum[1]).toBe(-1);
  });
});

describe('parseSideDefLump', () => {
  test('decodes texture names and trims trailing NULs', () => {
    const bytes = new Uint8Array(30);
    // textures: TOP, BOT, MID
    'TOP\0\0\0\0\0'.split('').forEach((c, i) => (bytes[4 + i] = c.charCodeAt(0)));
    'BOT\0\0\0\0\0'.split('').forEach((c, i) => (bytes[12 + i] = c.charCodeAt(0)));
    'MID\0\0\0\0\0'.split('').forEach((c, i) => (bytes[20 + i] = c.charCodeAt(0)));
    const sides = parseSideDefLump(bytes);
    expect(sides[0]?.topTexture).toBe('TOP');
    expect(sides[0]?.bottomTexture).toBe('BOT');
    expect(sides[0]?.midTexture).toBe('MID');
  });
});

describe('parseSectorLump', () => {
  test('decodes 26-byte sector record with floor/ceiling heights and tags', () => {
    const bytes = new Uint8Array(26);
    bytes[0] = 0x00;
    bytes[1] = 0x00; // floor 0
    bytes[2] = 0x80;
    bytes[3] = 0x00; // ceiling 128
    'FLOOR1\0\0'.split('').forEach((c, i) => (bytes[4 + i] = c.charCodeAt(0)));
    'CEIL2\0\0\0'.split('').forEach((c, i) => (bytes[12 + i] = c.charCodeAt(0)));
    bytes[20] = 144;
    bytes[21] = 0; // lightlevel 144
    bytes[22] = 0;
    bytes[23] = 0; // special 0
    bytes[24] = 5;
    bytes[25] = 0; // tag 5
    const sectors = parseSectorLump(bytes);
    expect(sectors[0]?.floorHeight).toBe(0);
    expect(sectors[0]?.ceilingHeight).toBe(128);
    expect(sectors[0]?.floorPic).toBe('FLOOR1');
    expect(sectors[0]?.ceilingPic).toBe('CEIL2');
    expect(sectors[0]?.lightLevel).toBe(144);
    expect(sectors[0]?.tag).toBe(5);
  });
});
