import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MAXVISPLANES,
  VANILLA_VISPLANE_INITIAL_MAXX,
  VANILLA_VISPLANE_INITIAL_MINX,
  VANILLA_VISPLANE_TOP_SENTINEL,
  classifyVanillaVisplaneCheck,
  collapseVanillaVisplaneSky,
  vanillaVisplaneMatches,
  vanillaVisplaneTopInitialValue,
} from '../../../src/render/implement-visplane-allocation-and-merge.ts';

describe('visplane constants', () => {
  test('MAXVISPLANES = 128', () => {
    expect(VANILLA_MAXVISPLANES).toBe(128);
  });

  test('top sentinel is 0xFF', () => {
    expect(VANILLA_VISPLANE_TOP_SENTINEL).toBe(0xff);
    expect(vanillaVisplaneTopInitialValue()).toBe(0xff);
  });

  test('initial minx = SCREENWIDTH = 320, maxx = -1 (inverted empty range)', () => {
    expect(VANILLA_VISPLANE_INITIAL_MINX).toBe(320);
    expect(VANILLA_VISPLANE_INITIAL_MAXX).toBe(-1);
  });
});

describe('collapseVanillaVisplaneSky', () => {
  test('sky picnum collapses height and lightlevel to 0', () => {
    const result = collapseVanillaVisplaneSky({ height: 0x800000, picnum: 5, lightlevel: 224, skyflatnum: 5 });
    expect(result).toEqual({ height: 0, picnum: 5, lightlevel: 0 });
  });

  test('non-sky picnum preserves height and lightlevel', () => {
    const result = collapseVanillaVisplaneSky({ height: 0x800000, picnum: 10, lightlevel: 224, skyflatnum: 5 });
    expect(result).toEqual({ height: 0x800000, picnum: 10, lightlevel: 224 });
  });
});

describe('vanillaVisplaneMatches', () => {
  test('all three fields must match', () => {
    expect(vanillaVisplaneMatches({ height: 0, picnum: 1, lightlevel: 200 }, { height: 0, picnum: 1, lightlevel: 200 })).toBe(true);
  });

  test('differing height does not match', () => {
    expect(vanillaVisplaneMatches({ height: 0, picnum: 1, lightlevel: 200 }, { height: 1, picnum: 1, lightlevel: 200 })).toBe(false);
  });

  test('differing picnum does not match', () => {
    expect(vanillaVisplaneMatches({ height: 0, picnum: 1, lightlevel: 200 }, { height: 0, picnum: 2, lightlevel: 200 })).toBe(false);
  });

  test('differing lightlevel does not match', () => {
    expect(vanillaVisplaneMatches({ height: 0, picnum: 1, lightlevel: 200 }, { height: 0, picnum: 1, lightlevel: 100 })).toBe(false);
  });
});

describe('classifyVanillaVisplaneCheck', () => {
  test('disjoint range left of plane -> extend-in-place', () => {
    expect(classifyVanillaVisplaneCheck({ plMinx: 50, plMaxx: 100, start: 0, stop: 30 })).toBe('extend-in-place');
  });

  test('disjoint range right of plane -> extend-in-place', () => {
    expect(classifyVanillaVisplaneCheck({ plMinx: 50, plMaxx: 100, start: 150, stop: 200 })).toBe('extend-in-place');
  });

  test('overlapping range -> allocate-new (conservative)', () => {
    expect(classifyVanillaVisplaneCheck({ plMinx: 50, plMaxx: 100, start: 70, stop: 80 })).toBe('allocate-new');
    expect(classifyVanillaVisplaneCheck({ plMinx: 50, plMaxx: 100, start: 30, stop: 70 })).toBe('allocate-new');
  });

  test('exactly-touching ranges -> allocate-new (inclusive bounds)', () => {
    expect(classifyVanillaVisplaneCheck({ plMinx: 50, plMaxx: 100, start: 100, stop: 110 })).toBe('allocate-new');
  });
});
