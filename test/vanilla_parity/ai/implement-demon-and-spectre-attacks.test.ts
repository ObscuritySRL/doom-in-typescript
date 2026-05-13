import { describe, expect, test } from 'bun:test';

import { VANILLA_DEMON_MELEE_DAMAGE_BASE, VANILLA_DEMON_MELEE_DAMAGE_MULTIPLIER_MAX, VANILLA_MT_SERGEANT, VANILLA_MT_SHADOWS, applyVanillaDemonAttack } from '../../../src/ai/implement-demon-and-spectre-attacks.ts';

describe('vanilla A_SargAttack constants', () => {
  test('melee damage base is 4 (4 * (P_Random()%10+1))', () => {
    expect(VANILLA_DEMON_MELEE_DAMAGE_BASE).toBe(4);
  });

  test('melee damage multiplier max is 10 (P_Random() % 10 + 1 = 1..10)', () => {
    expect(VANILLA_DEMON_MELEE_DAMAGE_MULTIPLIER_MAX).toBe(10);
  });

  test('MT_SERGEANT (demon) is 8', () => {
    expect(VANILLA_MT_SERGEANT).toBe(8);
  });

  test('MT_SHADOWS (spectre) is 9', () => {
    expect(VANILLA_MT_SHADOWS).toBe(9);
  });
});

describe('applyVanillaDemonAttack', () => {
  test('out of melee range: no-op', () => {
    const result = applyVanillaDemonAttack({ inMeleeRange: false, randomByte: 7 });
    expect(result.attackKind).toBe('no-op');
    expect(result.damage).toBe(0);
  });

  test('in melee range: damage = 4 * (rng%10 + 1) range 4..40', () => {
    expect(applyVanillaDemonAttack({ inMeleeRange: true, randomByte: 0 }).damage).toBe(4);
    expect(applyVanillaDemonAttack({ inMeleeRange: true, randomByte: 9 }).damage).toBe(40);
    expect(applyVanillaDemonAttack({ inMeleeRange: true, randomByte: 5 }).damage).toBe(24);
  });

  test('attack kind is melee when in range', () => {
    expect(applyVanillaDemonAttack({ inMeleeRange: true, randomByte: 0 }).attackKind).toBe('melee');
  });
});
