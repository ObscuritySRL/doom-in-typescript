import { describe, expect, test } from 'bun:test';

import {
  VANILLA_CF_GODMODE,
  VANILLA_CF_NOCLIP,
  VANILLA_CF_NOMOMENTUM,
  VANILLA_INFRATICS,
  VANILLA_INVISTICS,
  VANILLA_INVULNTICS,
  VANILLA_IRONTICS,
  VANILLA_NUMPOWERS,
  VANILLA_PW_ALLMAP,
  VANILLA_PW_INFRARED,
  VANILLA_PW_INVISIBILITY,
  VANILLA_PW_INVULNERABILITY,
  VANILLA_PW_IRONFEET,
  VANILLA_PW_STRENGTH,
  VANILLA_TICRATE,
  isGodMode,
  isNoMomentum,
  isNoclip,
  powerupInitialDuration,
} from '../../../src/player/implement-god-mode-and-powerup-flags.ts';

describe('vanilla cheat flag bits (doomdef.h cheat_t)', () => {
  test('CF_NOCLIP=1, CF_GODMODE=2, CF_NOMOMENTUM=4', () => {
    expect(VANILLA_CF_NOCLIP).toBe(1);
    expect(VANILLA_CF_GODMODE).toBe(2);
    expect(VANILLA_CF_NOMOMENTUM).toBe(4);
  });

  test('isGodMode/isNoclip/isNoMomentum decode bit fields', () => {
    expect(isGodMode(VANILLA_CF_GODMODE)).toBe(true);
    expect(isGodMode(0)).toBe(false);
    expect(isGodMode(VANILLA_CF_NOCLIP)).toBe(false);
    expect(isNoclip(VANILLA_CF_NOCLIP | VANILLA_CF_GODMODE)).toBe(true);
    expect(isNoMomentum(VANILLA_CF_NOMOMENTUM)).toBe(true);
  });
});

describe('vanilla powerup slot enum (NUMPOWERS=6)', () => {
  test('slot ordering: invul=0, strength=1, invisibility=2, ironfeet=3, allmap=4, infrared=5', () => {
    expect(VANILLA_PW_INVULNERABILITY).toBe(0);
    expect(VANILLA_PW_STRENGTH).toBe(1);
    expect(VANILLA_PW_INVISIBILITY).toBe(2);
    expect(VANILLA_PW_IRONFEET).toBe(3);
    expect(VANILLA_PW_ALLMAP).toBe(4);
    expect(VANILLA_PW_INFRARED).toBe(5);
    expect(VANILLA_NUMPOWERS).toBe(6);
  });
});

describe('vanilla powerup durations (TICRATE=35)', () => {
  test('TICRATE is 35 Hz', () => {
    expect(VANILLA_TICRATE).toBe(35);
  });

  test('invulnerability = 30 * TICRATE = 1050 tics', () => {
    expect(VANILLA_INVULNTICS).toBe(30 * 35);
    expect(VANILLA_INVULNTICS).toBe(1050);
  });

  test('invisibility = 60 * TICRATE = 2100 tics', () => {
    expect(VANILLA_INVISTICS).toBe(60 * 35);
    expect(VANILLA_INVISTICS).toBe(2100);
  });

  test('ironfeet (radsuit) = 60 * TICRATE = 2100 tics', () => {
    expect(VANILLA_IRONTICS).toBe(60 * 35);
    expect(VANILLA_IRONTICS).toBe(2100);
  });

  test('infrared = 120 * TICRATE = 4200 tics', () => {
    expect(VANILLA_INFRATICS).toBe(120 * 35);
    expect(VANILLA_INFRATICS).toBe(4200);
  });
});

describe('powerupInitialDuration', () => {
  test('returns timed-power durations for the four timed slots', () => {
    expect(powerupInitialDuration(VANILLA_PW_INVULNERABILITY)).toBe(VANILLA_INVULNTICS);
    expect(powerupInitialDuration(VANILLA_PW_INVISIBILITY)).toBe(VANILLA_INVISTICS);
    expect(powerupInitialDuration(VANILLA_PW_IRONFEET)).toBe(VANILLA_IRONTICS);
    expect(powerupInitialDuration(VANILLA_PW_INFRARED)).toBe(VANILLA_INFRATICS);
  });

  test('returns 0 for untimed slots (strength, allmap)', () => {
    expect(powerupInitialDuration(VANILLA_PW_STRENGTH)).toBe(0);
    expect(powerupInitialDuration(VANILLA_PW_ALLMAP)).toBe(0);
  });
});
