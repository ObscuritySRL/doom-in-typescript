import { describe, expect, test } from 'bun:test';

import { VANILLA_DETAIL_HIGH, VANILLA_DETAIL_LOW, VANILLA_DETAIL_LOW_PIXEL_STRIDE, isLowDetail } from '../../../src/render/implement-detail-level-toggle.ts';

describe('vanilla detail level constants', () => {
  test('detail high=0, low=1', () => {
    expect(VANILLA_DETAIL_HIGH).toBe(0);
    expect(VANILLA_DETAIL_LOW).toBe(1);
  });

  test('low detail stride = 2 pixels', () => {
    expect(VANILLA_DETAIL_LOW_PIXEL_STRIDE).toBe(2);
  });
});

describe('isLowDetail', () => {
  test('returns true only for detailshift = 1', () => {
    expect(isLowDetail(0)).toBe(false);
    expect(isLowDetail(1)).toBe(true);
  });
});
