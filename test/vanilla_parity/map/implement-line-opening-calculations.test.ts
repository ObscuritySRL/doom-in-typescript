import { describe, expect, test } from 'bun:test';

import { computeLineOpening } from '../../../src/map/implement-line-opening-calculations.ts';

describe('computeLineOpening', () => {
  test('single-sided line yields zero openrange', () => {
    const opening = computeLineOpening({ frontFloorHeight: 0, frontCeilingHeight: 128, backFloorHeight: null, backCeilingHeight: null });
    expect(opening).toEqual({ openTop: 0, openBottom: 0, openRange: 0, lowFloor: 0 });
  });

  test('two-sided line with same heights yields full openrange', () => {
    const opening = computeLineOpening({ frontFloorHeight: 0, frontCeilingHeight: 128, backFloorHeight: 0, backCeilingHeight: 128 });
    expect(opening).toEqual({ openTop: 128, openBottom: 0, openRange: 128, lowFloor: 0 });
  });

  test('two-sided line with floor step uses higher floor and lower ceiling', () => {
    const opening = computeLineOpening({ frontFloorHeight: 32, frontCeilingHeight: 128, backFloorHeight: 64, backCeilingHeight: 96 });
    expect(opening.openTop).toBe(96);
    expect(opening.openBottom).toBe(64);
    expect(opening.openRange).toBe(32);
    expect(opening.lowFloor).toBe(32);
  });

  test('inverted-ceiling case clamps openrange to 0', () => {
    const opening = computeLineOpening({ frontFloorHeight: 100, frontCeilingHeight: 110, backFloorHeight: 200, backCeilingHeight: 210 });
    expect(opening.openRange).toBe(0);
  });
});
