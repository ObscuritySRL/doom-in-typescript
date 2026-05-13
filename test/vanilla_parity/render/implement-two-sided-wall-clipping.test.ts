import { describe, expect, test } from 'bun:test';

import { classifyVanillaPassClipFragment, vanillaPassClipBottomIsContained, vanillaPassClipFragmentRange, vanillaPassClipGapBetween } from '../../../src/render/implement-two-sided-wall-clipping.ts';

describe('classifyVanillaPassClipFragment', () => {
  test('fully-visible when range ends before first overlap', () => {
    expect(
      classifyVanillaPassClipFragment({
        range: { first: 0, last: 5 },
        firstOverlappingSolid: { first: 10, last: 20 },
      }),
    ).toBe('fully-visible');
  });

  test('fragment-above-start when range starts before solid and overlaps', () => {
    expect(
      classifyVanillaPassClipFragment({
        range: { first: 5, last: 15 },
        firstOverlappingSolid: { first: 10, last: 20 },
      }),
    ).toBe('fragment-above-start');
  });

  test('fully-occluded when range is inside the first solid', () => {
    expect(
      classifyVanillaPassClipFragment({
        range: { first: 12, last: 18 },
        firstOverlappingSolid: { first: 10, last: 20 },
      }),
    ).toBe('fully-occluded');
  });

  test('inter-segment-gap when range extends past start and is not contained', () => {
    expect(
      classifyVanillaPassClipFragment({
        range: { first: 15, last: 30 },
        firstOverlappingSolid: { first: 10, last: 20 },
      }),
    ).toBe('inter-segment-gap');
  });

  test('adjacency rule: range ending exactly 1 before solid is fully-visible', () => {
    expect(
      classifyVanillaPassClipFragment({
        range: { first: 0, last: 8 },
        firstOverlappingSolid: { first: 10, last: 20 },
      }),
    ).toBe('fully-visible');
  });

  test('adjacency rule: range ending exactly at solid.first-1 is still fully-visible', () => {
    expect(
      classifyVanillaPassClipFragment({
        range: { first: 0, last: 9 },
        firstOverlappingSolid: { first: 10, last: 20 },
      }),
    ).toBe('fragment-above-start');
  });
});

describe('vanillaPassClipFragmentRange', () => {
  test('returns full range when fully-visible', () => {
    const result = vanillaPassClipFragmentRange({
      range: { first: 0, last: 5 },
      firstOverlappingSolid: { first: 10, last: 20 },
    });
    expect(result).toEqual({ first: 0, last: 5 });
  });

  test('returns truncated range when fragment-above-start', () => {
    const result = vanillaPassClipFragmentRange({
      range: { first: 5, last: 15 },
      firstOverlappingSolid: { first: 10, last: 20 },
    });
    expect(result).toEqual({ first: 5, last: 9 });
  });

  test('returns null when fully-occluded', () => {
    expect(
      vanillaPassClipFragmentRange({
        range: { first: 12, last: 18 },
        firstOverlappingSolid: { first: 10, last: 20 },
      }),
    ).toBeNull();
  });

  test('returns null when inter-segment-gap (loop continues, no single fragment)', () => {
    expect(
      vanillaPassClipFragmentRange({
        range: { first: 15, last: 30 },
        firstOverlappingSolid: { first: 10, last: 20 },
      }),
    ).toBeNull();
  });

  test('returned range is frozen', () => {
    const result = vanillaPassClipFragmentRange({
      range: { first: 0, last: 5 },
      firstOverlappingSolid: { first: 10, last: 20 },
    });
    expect(result && Object.isFrozen(result)).toBe(true);
  });
});

describe('vanillaPassClipBottomIsContained', () => {
  test('true when range bottom <= solid bottom', () => {
    expect(vanillaPassClipBottomIsContained({ first: 5, last: 15 }, { first: 0, last: 20 })).toBe(true);
    expect(vanillaPassClipBottomIsContained({ first: 5, last: 20 }, { first: 0, last: 20 })).toBe(true);
  });

  test('false when range bottom > solid bottom', () => {
    expect(vanillaPassClipBottomIsContained({ first: 5, last: 25 }, { first: 0, last: 20 })).toBe(false);
  });
});

describe('vanillaPassClipGapBetween', () => {
  test('returns gap range when solids are non-adjacent', () => {
    const result = vanillaPassClipGapBetween({ first: 0, last: 10 }, { first: 20, last: 30 });
    expect(result).toEqual({ first: 11, last: 19 });
  });

  test('returns null when adjacent (no gap)', () => {
    expect(vanillaPassClipGapBetween({ first: 0, last: 10 }, { first: 11, last: 20 })).toBeNull();
  });

  test('returns null when overlapping (negative gap)', () => {
    expect(vanillaPassClipGapBetween({ first: 0, last: 15 }, { first: 10, last: 20 })).toBeNull();
  });
});
