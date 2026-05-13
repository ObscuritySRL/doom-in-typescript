import { describe, expect, test } from 'bun:test';

import { SIL_BOTH, SIL_BOTTOM, SIL_NONE, SIL_TOP, VANILLA_MAXDRAWSEGS, hasBottomSilhouette, hasTopSilhouette } from '../../../src/render/implement-sprite-clipping-against-drawsegs.ts';

describe('vanilla sprite clipping constants', () => {
  test('MAXDRAWSEGS = 256', () => {
    expect(VANILLA_MAXDRAWSEGS).toBe(256);
  });

  test('silhouette mask bits: NONE=0, BOTTOM=1, TOP=2, BOTH=3', () => {
    expect(SIL_NONE).toBe(0);
    expect(SIL_BOTTOM).toBe(1);
    expect(SIL_TOP).toBe(2);
    expect(SIL_BOTH).toBe(3);
  });
});

describe('silhouette helpers', () => {
  test('hasBottomSilhouette checks bit 0', () => {
    expect(hasBottomSilhouette(SIL_BOTTOM)).toBe(true);
    expect(hasBottomSilhouette(SIL_BOTH)).toBe(true);
    expect(hasBottomSilhouette(SIL_TOP)).toBe(false);
    expect(hasBottomSilhouette(SIL_NONE)).toBe(false);
  });

  test('hasTopSilhouette checks bit 1', () => {
    expect(hasTopSilhouette(SIL_TOP)).toBe(true);
    expect(hasTopSilhouette(SIL_BOTH)).toBe(true);
    expect(hasTopSilhouette(SIL_BOTTOM)).toBe(false);
    expect(hasTopSilhouette(SIL_NONE)).toBe(false);
  });
});
