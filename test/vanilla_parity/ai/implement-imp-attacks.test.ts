import { describe, expect, test } from 'bun:test';

import { VANILLA_IMP_MELEE_DAMAGE_BASE, VANILLA_IMP_MELEE_DAMAGE_MULTIPLIER_MAX, VANILLA_MT_TROOPSHOT, VANILLA_SFX_CLAW, applyVanillaImpAttack } from '../../../src/ai/implement-imp-attacks.ts';

describe('vanilla A_TroopAttack constants', () => {
  test('melee damage base is 3 (3 * (P_Random()%8+1) range)', () => {
    expect(VANILLA_IMP_MELEE_DAMAGE_BASE).toBe(3);
  });

  test('melee damage multiplier max is 8 (P_Random() % 8 + 1 = 1..8)', () => {
    expect(VANILLA_IMP_MELEE_DAMAGE_MULTIPLIER_MAX).toBe(8);
  });

  test('SFX_CLAW is 32 (per sounds.h sfxenum_t)', () => {
    expect(VANILLA_SFX_CLAW).toBe(32);
  });

  test('MT_TROOPSHOT is 23 (per info.h mobjtype_t)', () => {
    expect(VANILLA_MT_TROOPSHOT).toBe(23);
  });
});

describe('applyVanillaImpAttack', () => {
  test('in melee range: claw damage with sfx_claw', () => {
    const result = applyVanillaImpAttack({ inMeleeRange: true, randomByte: 0 });
    expect(result.attackKind).toBe('melee');
    expect(result.damage).toBe(3);
    expect(result.soundId).toBe(VANILLA_SFX_CLAW);
    expect(result.missileType).toBeNull();
  });

  test('melee damage range is 3..24 (3 * 1..8)', () => {
    expect(applyVanillaImpAttack({ inMeleeRange: true, randomByte: 0 }).damage).toBe(3);
    expect(applyVanillaImpAttack({ inMeleeRange: true, randomByte: 7 }).damage).toBe(24);
  });

  test('out of melee range: launches MT_TROOPSHOT missile', () => {
    const result = applyVanillaImpAttack({ inMeleeRange: false, randomByte: 42 });
    expect(result.attackKind).toBe('missile');
    expect(result.damage).toBe(0);
    expect(result.soundId).toBeNull();
    expect(result.missileType).toBe(VANILLA_MT_TROOPSHOT);
  });
});
