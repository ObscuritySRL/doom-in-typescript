import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { VANILLA_SCREENHEIGHT, VANILLA_SCREENWIDTH, VANILLA_SPRITE_BASEYCENTER, VANILLA_SPRITE_MINZ_FIXED, isSpriteTooCloseToReject } from '../../../src/render/implement-sprite-projection.ts';

describe('vanilla sprite projection constants', () => {
  test('MINZ = 4 fixed = 0x40000', () => {
    expect(VANILLA_SPRITE_MINZ_FIXED).toBe(4 << FRACBITS);
    expect(VANILLA_SPRITE_MINZ_FIXED).toBe(0x40000);
  });

  test('BASEYCENTER = 100, screen 320x200', () => {
    expect(VANILLA_SPRITE_BASEYCENTER).toBe(100);
    expect(VANILLA_SCREENWIDTH).toBe(320);
    expect(VANILLA_SCREENHEIGHT).toBe(200);
  });
});

describe('isSpriteTooCloseToReject', () => {
  test('returns true when depth < MINZ', () => {
    expect(isSpriteTooCloseToReject(0)).toBe(true);
    expect(isSpriteTooCloseToReject((3 << FRACBITS) | 0)).toBe(true);
  });

  test('returns false when depth >= MINZ', () => {
    expect(isSpriteTooCloseToReject(VANILLA_SPRITE_MINZ_FIXED)).toBe(false);
    expect(isSpriteTooCloseToReject((100 << FRACBITS) | 0)).toBe(false);
  });
});
