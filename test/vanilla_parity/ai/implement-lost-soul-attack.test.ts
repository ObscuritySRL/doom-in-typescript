import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { VANILLA_MT_SKULL, VANILLA_SFX_SKLATK, VANILLA_SKULL_DAMAGE_MULTIPLIER_MAX, VANILLA_SKULL_INFO_DAMAGE, VANILLA_SKULL_SPEED_FIXED, computeLostSoulCollisionDamage } from '../../../src/ai/implement-lost-soul-attack.ts';

describe('vanilla lost soul constants', () => {
  test('SKULLSPEED = 20 fixed', () => {
    expect(VANILLA_SKULL_SPEED_FIXED).toBe(20 << FRACBITS);
  });

  test('skull info damage = 3', () => {
    expect(VANILLA_SKULL_INFO_DAMAGE).toBe(3);
  });

  test('damage multiplier max = 8 (rng%8+1)', () => {
    expect(VANILLA_SKULL_DAMAGE_MULTIPLIER_MAX).toBe(8);
  });

  test('MT_SKULL is 19', () => {
    expect(VANILLA_MT_SKULL).toBe(19);
  });

  test('SFX_SKLATK is 71', () => {
    expect(VANILLA_SFX_SKLATK).toBe(71);
  });
});

describe('computeLostSoulCollisionDamage', () => {
  test('damage range 3..24', () => {
    expect(computeLostSoulCollisionDamage(0)).toBe(3);
    expect(computeLostSoulCollisionDamage(7)).toBe(24);
  });

  test('rng wraps via %8', () => {
    expect(computeLostSoulCollisionDamage(8)).toBe(3);
  });
});
