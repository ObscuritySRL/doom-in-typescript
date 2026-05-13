import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BSP_EMPTY_SENTINEL_INT16,
  VANILLA_NF_SUBSECTOR,
  decodeVanillaBspSubsectorIndex,
  getVanillaBspRenderOrder,
  vanillaBspChildIsSubsector,
  vanillaBspOppositeSide,
} from '../../../src/render/implement-bsp-front-to-back-render-walk.ts';

describe('NF_SUBSECTOR constant', () => {
  test('NF_SUBSECTOR = 0x8000', () => {
    expect(VANILLA_NF_SUBSECTOR).toBe(0x8000);
  });

  test('empty sentinel is -1', () => {
    expect(VANILLA_BSP_EMPTY_SENTINEL_INT16).toBe(-1);
  });
});

describe('vanillaBspChildIsSubsector', () => {
  test('returns true when bit 0x8000 is set', () => {
    expect(vanillaBspChildIsSubsector({ bspnum: 0x8000 })).toBe(true);
    expect(vanillaBspChildIsSubsector({ bspnum: 0x8042 })).toBe(true);
  });

  test('returns false when bit 0x8000 is clear (internal node)', () => {
    expect(vanillaBspChildIsSubsector({ bspnum: 0x0000 })).toBe(false);
    expect(vanillaBspChildIsSubsector({ bspnum: 0x0042 })).toBe(false);
    expect(vanillaBspChildIsSubsector({ bspnum: 0x7fff })).toBe(false);
  });

  test('returns true for negative bspnum (-1 has all bits set)', () => {
    expect(vanillaBspChildIsSubsector({ bspnum: -1 })).toBe(true);
  });
});

describe('decodeVanillaBspSubsectorIndex', () => {
  test('returns 0 for empty-sentinel -1', () => {
    expect(decodeVanillaBspSubsectorIndex(-1)).toBe(0);
  });

  test('returns bspnum & ~0x8000 for tagged subsector references', () => {
    expect(decodeVanillaBspSubsectorIndex(0x8000)).toBe(0);
    expect(decodeVanillaBspSubsectorIndex(0x8042)).toBe(0x42);
    expect(decodeVanillaBspSubsectorIndex(0xffff)).toBe(0x7fff);
  });

  test('throws when bspnum is not a subsector reference', () => {
    expect(() => decodeVanillaBspSubsectorIndex(0x0042)).toThrow(RangeError);
  });
});

describe('vanillaBspOppositeSide', () => {
  test('0 -> 1, 1 -> 0', () => {
    expect(vanillaBspOppositeSide(0)).toBe(1);
    expect(vanillaBspOppositeSide(1)).toBe(0);
  });
});

describe('getVanillaBspRenderOrder', () => {
  test('viewpoint on front (side=0): recurse front first, then back', () => {
    const result = getVanillaBspRenderOrder({ side: 0 });
    expect(result.firstChildIndex).toBe(0);
    expect(result.secondChildIndex).toBe(1);
  });

  test('viewpoint on back (side=1): recurse back first, then front', () => {
    const result = getVanillaBspRenderOrder({ side: 1 });
    expect(result.firstChildIndex).toBe(1);
    expect(result.secondChildIndex).toBe(0);
  });

  test('result is frozen', () => {
    expect(Object.isFrozen(getVanillaBspRenderOrder({ side: 0 }))).toBe(true);
  });
});
