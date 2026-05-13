import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BTS_PAUSE,
  VANILLA_BTS_SAVEGAME,
  VANILLA_BTS_SAVESHIFT,
  VANILLA_BT_ATTACK,
  VANILLA_BT_CHANGE,
  VANILLA_BT_SPECIAL,
  VANILLA_BT_USE,
  VANILLA_BT_WEAPONMASK,
  VANILLA_BT_WEAPONSHIFT,
  applyUseButtonLatch,
  decodeWeaponChangeRequest,
} from '../../../src/player/implement-ticcmd-application.ts';

describe('vanilla ticcmd button bit constants', () => {
  test('BT_ATTACK=1, BT_USE=2, BT_CHANGE=4, BT_SPECIAL=128', () => {
    expect(VANILLA_BT_ATTACK).toBe(1);
    expect(VANILLA_BT_USE).toBe(2);
    expect(VANILLA_BT_CHANGE).toBe(4);
    expect(VANILLA_BT_SPECIAL).toBe(128);
  });

  test('BT_WEAPONMASK occupies bits 3..5 (8|16|32 = 56)', () => {
    expect(VANILLA_BT_WEAPONMASK).toBe(56);
    expect(VANILLA_BT_WEAPONSHIFT).toBe(3);
  });

  test('BTS_PAUSE=1, BTS_SAVEGAME=2, BTS_SAVESHIFT=2', () => {
    expect(VANILLA_BTS_PAUSE).toBe(1);
    expect(VANILLA_BTS_SAVEGAME).toBe(2);
    expect(VANILLA_BTS_SAVESHIFT).toBe(2);
  });
});

describe('BT_USE latch fires on rising edge only', () => {
  test('use button released clears usedown without firing event', () => {
    expect(applyUseButtonLatch({ buttons: 0, previousUsedown: true })).toEqual({ fireUseEvent: false, nextUsedown: false });
    expect(applyUseButtonLatch({ buttons: 0, previousUsedown: false })).toEqual({ fireUseEvent: false, nextUsedown: false });
  });

  test('use button pressed for the first time fires event and sets usedown', () => {
    expect(applyUseButtonLatch({ buttons: VANILLA_BT_USE, previousUsedown: false })).toEqual({ fireUseEvent: true, nextUsedown: true });
  });

  test('use button held does not fire repeated events (latched)', () => {
    expect(applyUseButtonLatch({ buttons: VANILLA_BT_USE, previousUsedown: true })).toEqual({ fireUseEvent: false, nextUsedown: true });
  });

  test('latch only inspects the BT_USE bit, ignoring BT_ATTACK and BT_CHANGE', () => {
    const buttons = VANILLA_BT_USE | VANILLA_BT_ATTACK | VANILLA_BT_CHANGE;
    expect(applyUseButtonLatch({ buttons, previousUsedown: false })).toEqual({ fireUseEvent: true, nextUsedown: true });
  });
});

describe('decodeWeaponChangeRequest', () => {
  test('returns null when BT_CHANGE bit is clear', () => {
    expect(decodeWeaponChangeRequest(0)).toBeNull();
    expect(decodeWeaponChangeRequest(VANILLA_BT_ATTACK | VANILLA_BT_USE)).toBeNull();
  });

  test('returns weapon index 0..7 from bits 3..5 when BT_CHANGE is set', () => {
    expect(decodeWeaponChangeRequest(VANILLA_BT_CHANGE | (0 << VANILLA_BT_WEAPONSHIFT))).toBe(0);
    expect(decodeWeaponChangeRequest(VANILLA_BT_CHANGE | (3 << VANILLA_BT_WEAPONSHIFT))).toBe(3);
    expect(decodeWeaponChangeRequest(VANILLA_BT_CHANGE | (7 << VANILLA_BT_WEAPONSHIFT))).toBe(7);
  });

  test('ignores BT_ATTACK and BT_USE bits when computing weapon index', () => {
    expect(decodeWeaponChangeRequest(VANILLA_BT_CHANGE | (5 << VANILLA_BT_WEAPONSHIFT) | VANILLA_BT_ATTACK | VANILLA_BT_USE)).toBe(5);
  });
});
