import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MAXDRAWSEGS,
  VANILLA_SOLIDSEGS_SENTINEL_LEFT_FIRST,
  VANILLA_SOLIDSEGS_SENTINEL_LEFT_LAST,
  VANILLA_SOLIDSEGS_SENTINEL_RIGHT_LAST,
  getVanillaSolidSegInitialSentinels,
  vanillaSolidSegRangeContains,
  vanillaSolidSegRangeIsTouching,
} from '../../../src/render/implement-solid-segment-clipping.ts';

describe('solid segment constants', () => {
  test('left sentinel first/last', () => {
    expect(VANILLA_SOLIDSEGS_SENTINEL_LEFT_FIRST).toBe(-0x7fffffff);
    expect(VANILLA_SOLIDSEGS_SENTINEL_LEFT_LAST).toBe(-1);
  });

  test('right sentinel last', () => {
    expect(VANILLA_SOLIDSEGS_SENTINEL_RIGHT_LAST).toBe(0x7fffffff);
  });

  test('MAXDRAWSEGS = 256', () => {
    expect(VANILLA_MAXDRAWSEGS).toBe(256);
  });
});

describe('vanillaSolidSegRangeIsTouching', () => {
  test('adjacent pixels (rangeA.last + 1 == rangeB.first) touch', () => {
    // rangeA.last = 9, rangeB.first = 10 -> adjacent
    expect(vanillaSolidSegRangeIsTouching({ first: 0, last: 9 }, 10)).toBe(true);
  });

  test('overlapping ranges touch', () => {
    expect(vanillaSolidSegRangeIsTouching({ first: 0, last: 20 }, 10)).toBe(true);
  });

  test('gap larger than 1 does NOT touch', () => {
    // rangeA.last = 9, rangeB.first = 12 -> gap of 2
    expect(vanillaSolidSegRangeIsTouching({ first: 0, last: 9 }, 12)).toBe(false);
  });
});

describe('vanillaSolidSegRangeContains', () => {
  test('parent contains child entirely', () => {
    expect(vanillaSolidSegRangeContains({ first: 0, last: 100 }, { first: 25, last: 75 })).toBe(true);
  });

  test('parent does not contain child extending beyond', () => {
    expect(vanillaSolidSegRangeContains({ first: 0, last: 100 }, { first: 50, last: 150 })).toBe(false);
    expect(vanillaSolidSegRangeContains({ first: 0, last: 100 }, { first: -1, last: 50 })).toBe(false);
  });
});

describe('getVanillaSolidSegInitialSentinels', () => {
  test('initial sentinels match vanilla R_ClearClipSegs', () => {
    const result = getVanillaSolidSegInitialSentinels(320);
    expect(result.leftSentinel.first).toBe(-0x7fffffff);
    expect(result.leftSentinel.last).toBe(-1);
    expect(result.rightSentinel.first).toBe(320);
    expect(result.rightSentinel.last).toBe(0x7fffffff);
  });

  test('right sentinel uses viewwidth as first', () => {
    expect(getVanillaSolidSegInitialSentinels(160).rightSentinel.first).toBe(160);
  });

  test('sentinels are frozen', () => {
    const result = getVanillaSolidSegInitialSentinels(320);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.leftSentinel)).toBe(true);
    expect(Object.isFrozen(result.rightSentinel)).toBe(true);
  });
});
