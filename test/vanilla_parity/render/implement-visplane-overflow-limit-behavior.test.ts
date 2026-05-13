import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MAXVISPLANES,
  VANILLA_VISPLANE_OVERFLOW_ERROR_MESSAGE,
  vanillaVisplaneCountIsValid,
  vanillaVisplaneOverflowWouldFire,
  vanillaVisplaneRemainingCapacity,
} from '../../../src/render/implement-visplane-overflow-limit-behavior.ts';

describe('visplane overflow constants', () => {
  test('MAXVISPLANES = 128', () => {
    expect(VANILLA_MAXVISPLANES).toBe(128);
  });

  test('overflow error message matches upstream literal', () => {
    expect(VANILLA_VISPLANE_OVERFLOW_ERROR_MESSAGE).toBe('R_FindPlane: no more visplanes');
  });
});

describe('vanillaVisplaneOverflowWouldFire', () => {
  test('true exactly at MAXVISPLANES (strict equality check)', () => {
    expect(vanillaVisplaneOverflowWouldFire({ activeVisplaneCount: 128 })).toBe(true);
  });

  test('false at 127 (last successful allocation)', () => {
    expect(vanillaVisplaneOverflowWouldFire({ activeVisplaneCount: 127 })).toBe(false);
  });

  test('false at 0 (no planes allocated)', () => {
    expect(vanillaVisplaneOverflowWouldFire({ activeVisplaneCount: 0 })).toBe(false);
  });

  test('still false above 128 (== check, not >=)', () => {
    expect(vanillaVisplaneOverflowWouldFire({ activeVisplaneCount: 129 })).toBe(false);
  });
});

describe('vanillaVisplaneCountIsValid', () => {
  test('valid in [0, 128]', () => {
    expect(vanillaVisplaneCountIsValid({ activeVisplaneCount: 0 })).toBe(true);
    expect(vanillaVisplaneCountIsValid({ activeVisplaneCount: 128 })).toBe(true);
    expect(vanillaVisplaneCountIsValid({ activeVisplaneCount: 100 })).toBe(true);
  });

  test('invalid below 0 or above 128', () => {
    expect(vanillaVisplaneCountIsValid({ activeVisplaneCount: -1 })).toBe(false);
    expect(vanillaVisplaneCountIsValid({ activeVisplaneCount: 129 })).toBe(false);
  });
});

describe('vanillaVisplaneRemainingCapacity', () => {
  test('returns 128 - active when in range', () => {
    expect(vanillaVisplaneRemainingCapacity({ activeVisplaneCount: 0 })).toBe(128);
    expect(vanillaVisplaneRemainingCapacity({ activeVisplaneCount: 127 })).toBe(1);
    expect(vanillaVisplaneRemainingCapacity({ activeVisplaneCount: 128 })).toBe(0);
  });

  test('clamps to 0 when active exceeds max', () => {
    expect(vanillaVisplaneRemainingCapacity({ activeVisplaneCount: 200 })).toBe(0);
  });

  test('throws on negative active count', () => {
    expect(() => vanillaVisplaneRemainingCapacity({ activeVisplaneCount: -1 })).toThrow(RangeError);
  });
});
