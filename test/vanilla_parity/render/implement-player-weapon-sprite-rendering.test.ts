import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { PS_FLASH, PS_WEAPON, VANILLA_NUMPSPRITES, VANILLA_WEAPONBOTTOM_FIXED, VANILLA_WEAPONTOP_FIXED } from '../../../src/render/implement-player-weapon-sprite-rendering.ts';

describe('vanilla psprite constants', () => {
  test('WEAPONTOP = 32 fixed', () => {
    expect(VANILLA_WEAPONTOP_FIXED).toBe(32 << FRACBITS);
  });

  test('WEAPONBOTTOM = 128 fixed', () => {
    expect(VANILLA_WEAPONBOTTOM_FIXED).toBe(128 << FRACBITS);
  });

  test('NUMPSPRITES = 2 (weapon + flash slots)', () => {
    expect(VANILLA_NUMPSPRITES).toBe(2);
  });

  test('PS_WEAPON=0, PS_FLASH=1', () => {
    expect(PS_WEAPON).toBe(0);
    expect(PS_FLASH).toBe(1);
  });
});
