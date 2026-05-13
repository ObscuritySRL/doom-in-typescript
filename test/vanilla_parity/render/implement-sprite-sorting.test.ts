import { describe, expect, test } from 'bun:test';

import { VANILLA_MAXVISSPRITES, sortVisSpritesAscendingByScale } from '../../../src/render/implement-sprite-sorting.ts';

describe('vanilla sprite sorting constants', () => {
  test('MAXVISSPRITES = 128', () => {
    expect(VANILLA_MAXVISSPRITES).toBe(128);
  });
});

describe('sortVisSpritesAscendingByScale', () => {
  test('sorts by xscale ascending (farthest first)', () => {
    const sprites = [
      { id: 1, xscale: 100 },
      { id: 2, xscale: 50 },
      { id: 3, xscale: 200 },
    ];
    const result = sortVisSpritesAscendingByScale(sprites);
    expect(result.map((s) => s.id)).toEqual([2, 1, 3]);
  });

  test('does not mutate input', () => {
    const sprites = [
      { id: 1, xscale: 100 },
      { id: 2, xscale: 50 },
    ];
    const result = sortVisSpritesAscendingByScale(sprites);
    expect(sprites[0]!.id).toBe(1);
    expect(result[0]!.id).toBe(2);
  });
});
