import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { VANILLA_LOWERSPEED, VANILLA_NUMPSPRITES, VANILLA_PS_FLASH, VANILLA_PS_WEAPON, VANILLA_RAISESPEED, VANILLA_WEAPONBOTTOM, VANILLA_WEAPONTOP, stepVanillaPsprite } from '../../../src/player/implement-weapon-sprite-state-machine.ts';

describe('vanilla psprite slot enum', () => {
  test('NUMPSPRITES is 2 (weapon + flash)', () => {
    expect(VANILLA_NUMPSPRITES).toBe(2);
    expect(VANILLA_PS_WEAPON).toBe(0);
    expect(VANILLA_PS_FLASH).toBe(1);
  });
});

describe('vanilla weapon travel constants (p_pspr.c)', () => {
  test('WEAPONTOP rest position is 32 * FRACUNIT', () => {
    expect(VANILLA_WEAPONTOP).toBe(32 * FRACUNIT);
  });

  test('WEAPONBOTTOM fully-lowered position is 128 * FRACUNIT', () => {
    expect(VANILLA_WEAPONBOTTOM).toBe(128 * FRACUNIT);
  });

  test('RAISESPEED is 6 * FRACUNIT per tic', () => {
    expect(VANILLA_RAISESPEED).toBe(6 * FRACUNIT);
  });

  test('LOWERSPEED is 6 * FRACUNIT per tic (same as RAISESPEED)', () => {
    expect(VANILLA_LOWERSPEED).toBe(6 * FRACUNIT);
  });
});

describe('stepVanillaPsprite state advance', () => {
  test('tics = -1 stays at the current state (sticky)', () => {
    const result = stepVanillaPsprite({ currentTics: -1, currentState: { tics: -1, nextstate: 42 } });
    expect(result.transition).toBe('no-op');
    expect(result.nextStateId).toBeNull();
  });

  test('tics > 1 decrements and stays at current state', () => {
    const result = stepVanillaPsprite({ currentTics: 5, currentState: { tics: 5, nextstate: 42 } });
    expect(result.transition).toBe('tic-down');
    expect(result.nextStateId).toBeNull();
  });

  test('tics = 1 advances to nextstate', () => {
    const result = stepVanillaPsprite({ currentTics: 1, currentState: { tics: 5, nextstate: 42 } });
    expect(result.transition).toBe('advance');
    expect(result.nextStateId).toBe(42);
  });

  test('tics = 1 with null nextstate advances to null (end of chain)', () => {
    const result = stepVanillaPsprite({ currentTics: 1, currentState: { tics: 5, nextstate: null } });
    expect(result.transition).toBe('advance');
    expect(result.nextStateId).toBeNull();
  });
});
