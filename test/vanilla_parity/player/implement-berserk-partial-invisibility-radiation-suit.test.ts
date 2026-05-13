import { describe, expect, test } from 'bun:test';

import { VANILLA_BERSERK_HEALTH, VANILLA_INVISTICS, VANILLA_IRONTICS, VANILLA_MF_SHADOW, applyVanillaPowerPickup } from '../../../src/player/implement-berserk-partial-invisibility-radiation-suit.ts';

describe('vanilla power pickup constants', () => {
  test('berserk heals to 100 (MAXHEALTH)', () => {
    expect(VANILLA_BERSERK_HEALTH).toBe(100);
  });

  test('partial invisibility duration is 60 * TICRATE = 2100 tics', () => {
    expect(VANILLA_INVISTICS).toBe(60 * 35);
    expect(VANILLA_INVISTICS).toBe(2100);
  });

  test('radiation suit duration is 60 * TICRATE = 2100 tics', () => {
    expect(VANILLA_IRONTICS).toBe(60 * 35);
  });

  test('MF_SHADOW flag is 0x40000 (bit 18, per p_mobj.h)', () => {
    expect(VANILLA_MF_SHADOW).toBe(0x40000);
  });
});

describe('applyVanillaPowerPickup', () => {
  test('berserk heals player below 100 hp to 100', () => {
    const result = applyVanillaPowerPickup({ powerType: 'strength', currentHealth: 50 });
    expect(result.newHealth).toBe(100);
    expect(result.powerTics).toBe(1);
    expect(result.countDirection).toBe('up');
    expect(result.mobjFlagsToOr).toBe(0);
  });

  test('berserk does NOT heal player already above 100 hp', () => {
    const result = applyVanillaPowerPickup({ powerType: 'strength', currentHealth: 150 });
    expect(result.newHealth).toBe(150);
  });

  test('partial invisibility sets INVISTICS and OR-s MF_SHADOW', () => {
    const result = applyVanillaPowerPickup({ powerType: 'invisibility', currentHealth: 100 });
    expect(result.powerTics).toBe(VANILLA_INVISTICS);
    expect(result.mobjFlagsToOr).toBe(VANILLA_MF_SHADOW);
    expect(result.countDirection).toBe('down');
  });

  test('radiation suit sets IRONTICS and does NOT alter mobj flags', () => {
    const result = applyVanillaPowerPickup({ powerType: 'ironfeet', currentHealth: 100 });
    expect(result.powerTics).toBe(VANILLA_IRONTICS);
    expect(result.mobjFlagsToOr).toBe(0);
    expect(result.countDirection).toBe('down');
  });

  test('result is frozen', () => {
    const result = applyVanillaPowerPickup({ powerType: 'strength', currentHealth: 50 });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
