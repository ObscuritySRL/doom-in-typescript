import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { VANILLA_SFX_NOWAY, VANILLA_USERANGE, classifyVanillaPlayerUseAction } from '../../../src/player/implement-player-use-action.ts';

describe('vanilla P_UseLines constants', () => {
  test('USERANGE is 64 * FRACUNIT (same as MELEERANGE)', () => {
    expect(VANILLA_USERANGE).toBe(64 * FRACUNIT);
  });

  test('SFX_NOWAY is 20 (door-locked / unusable line)', () => {
    expect(VANILLA_SFX_NOWAY).toBe(20);
  });
});

describe('classifyVanillaPlayerUseAction edge-triggered use', () => {
  test('button released => no fire, latch clears', () => {
    expect(classifyVanillaPlayerUseAction({ buttonHeld: false, previousUsedown: false })).toEqual({ fireUseEvent: false, nextUsedown: false });
    expect(classifyVanillaPlayerUseAction({ buttonHeld: false, previousUsedown: true })).toEqual({ fireUseEvent: false, nextUsedown: false });
  });

  test('first press (latch was false) => fire, latch true', () => {
    expect(classifyVanillaPlayerUseAction({ buttonHeld: true, previousUsedown: false })).toEqual({ fireUseEvent: true, nextUsedown: true });
  });

  test('held (latch was true) => no fire, latch stays true', () => {
    expect(classifyVanillaPlayerUseAction({ buttonHeld: true, previousUsedown: true })).toEqual({ fireUseEvent: false, nextUsedown: true });
  });
});
