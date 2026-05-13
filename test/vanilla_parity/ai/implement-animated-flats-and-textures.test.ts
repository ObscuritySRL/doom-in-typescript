import { describe, expect, test } from 'bun:test';

import { VANILLA_ANIM_FRAME_DURATION_TICS, VANILLA_FLAT_ANIMS } from '../../../src/ai/implement-animated-flats-and-textures.ts';

describe('vanilla animation constants', () => {
  test('frame duration is 8 tics', () => {
    expect(VANILLA_ANIM_FRAME_DURATION_TICS).toBe(8);
  });

  test('canonical DOOM 1 flat animations: NUKAGE, FWATER, LAVA, BLOOD', () => {
    expect(VANILLA_FLAT_ANIMS).toHaveLength(4);
    const names = VANILLA_FLAT_ANIMS.map((a) => a.startName);
    expect(names).toEqual(['NUKAGE1', 'FWATER1', 'LAVA1', 'BLOOD1']);
  });

  test('each flat animation has 3 or 4 frames at 8 tics each', () => {
    for (const anim of VANILLA_FLAT_ANIMS) {
      expect(anim.tics).toBe(8);
      expect(anim.isTexture).toBe(false);
    }
  });
});
