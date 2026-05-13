import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BLOCKMAP_HEADER_BYTES,
  VANILLA_BLOCKMAP_LIST_TERMINATOR,
  VANILLA_NODE_BYTES,
  VANILLA_NODE_SUBSECTOR_FLAG,
  VANILLA_SEG_BYTES,
  VANILLA_SSECTOR_BYTES,
  isSubsectorChild,
  parseNodeLump,
  parseSegLump,
  parseSubsectorLump,
  subsectorIndexFromChild,
} from '../../../src/map/parse-seg-ssector-node-reject-blockmap-lumps.ts';

describe('vanilla map BSP lump byte sizes', () => {
  test('SEG 12, SSECTOR 4, NODE 28, blockmap header 8, list terminator 0xFFFF, subsector flag 0x8000', () => {
    expect(VANILLA_SEG_BYTES).toBe(12);
    expect(VANILLA_SSECTOR_BYTES).toBe(4);
    expect(VANILLA_NODE_BYTES).toBe(28);
    expect(VANILLA_BLOCKMAP_HEADER_BYTES).toBe(8);
    expect(VANILLA_BLOCKMAP_LIST_TERMINATOR).toBe(0xffff);
    expect(VANILLA_NODE_SUBSECTOR_FLAG).toBe(0x8000);
  });
});

describe('parseSegLump', () => {
  test('decodes the 12-byte seg record', () => {
    const bytes = new Uint8Array([0x01, 0x00, 0x02, 0x00, 0x00, 0x40, 0x05, 0x00, 0x01, 0x00, 0x0a, 0x00]);
    const segs = parseSegLump(bytes);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.v1).toBe(1);
    expect(segs[0]?.v2).toBe(2);
    expect(segs[0]?.angle).toBe(0x4000);
    expect(segs[0]?.lineDefId).toBe(5);
    expect(segs[0]?.side).toBe(1);
    expect(segs[0]?.offset).toBe(10);
  });

  test('throws on non-multiple-of-12 input', () => {
    expect(() => parseSegLump(new Uint8Array(11))).toThrow(RangeError);
  });
});

describe('parseSubsectorLump', () => {
  test('decodes (segCount, firstSeg) pairs', () => {
    const bytes = new Uint8Array([0x03, 0x00, 0x07, 0x00]);
    const subsectors = parseSubsectorLump(bytes);
    expect(subsectors[0]).toEqual({ segCount: 3, firstSeg: 7 });
  });
});

describe('parseNodeLump', () => {
  test('decodes node coordinates, bboxes, and children', () => {
    const bytes = new Uint8Array(28);
    bytes[0] = 0xff;
    bytes[1] = 0xff; // x = -1
    bytes[24] = 0x00;
    bytes[25] = 0x80; // right child = 0x8000 (subsector flag)
    bytes[26] = 0x05;
    bytes[27] = 0x00; // left child = 5 (node index)
    const nodes = parseNodeLump(bytes);
    expect(nodes[0]?.x).toBe(-1);
    expect(nodes[0]?.children[0]).toBe(0x8000);
    expect(nodes[0]?.children[1]).toBe(5);
  });
});

describe('child flag helpers', () => {
  test('identifies subsector children via the 0x8000 flag', () => {
    expect(isSubsectorChild(0x8000)).toBe(true);
    expect(isSubsectorChild(0x8001)).toBe(true);
    expect(isSubsectorChild(0x0001)).toBe(false);
  });

  test('strips the flag to get the subsector index', () => {
    expect(subsectorIndexFromChild(0x8000)).toBe(0);
    expect(subsectorIndexFromChild(0x8005)).toBe(5);
    expect(subsectorIndexFromChild(0xff80)).toBe(0x7f80);
  });
});
