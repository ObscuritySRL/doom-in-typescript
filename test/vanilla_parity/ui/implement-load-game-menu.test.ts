import { describe, expect, test } from 'bun:test';

import { VANILLA_LOAD_NET_MESSAGE_KEY, VANILLA_LOAD_SLOT_COUNT, getVanillaLoadMenuSlots, resolveVanillaLoadMenuEntry } from '../../../src/ui/implement-load-game-menu.ts';

describe('load menu slot shape', () => {
  test('has exactly 6 slots', () => {
    expect(VANILLA_LOAD_SLOT_COUNT).toBe(6);
    expect(getVanillaLoadMenuSlots().length).toBe(6);
  });

  test('slot hotkeys are 1..6 in order', () => {
    const slots = getVanillaLoadMenuSlots();
    expect(slots.map((slot) => slot.hotkey)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  test('slot indices are 0..5 in order', () => {
    const slots = getVanillaLoadMenuSlots();
    expect(slots.map((slot) => slot.slotIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('every slot routes to M_LoadSelect with status byte 1', () => {
    for (const slot of getVanillaLoadMenuSlots()) {
      expect(slot.routine).toBe('M_LoadSelect');
      expect(slot.statusByte).toBe(1);
    }
  });

  test('slots are frozen', () => {
    expect(Object.isFrozen(getVanillaLoadMenuSlots())).toBe(true);
    for (const slot of getVanillaLoadMenuSlots()) {
      expect(Object.isFrozen(slot)).toBe(true);
    }
  });
});

describe('netgame message key', () => {
  test('LOADNET key matches upstream DeHackEd', () => {
    expect(VANILLA_LOAD_NET_MESSAGE_KEY).toBe('LOADNET');
  });
});

describe('resolveVanillaLoadMenuEntry', () => {
  test('non-netgame routes to load-menu', () => {
    expect(resolveVanillaLoadMenuEntry(false)).toBe('load-menu');
  });

  test('netgame routes to load-net-warning', () => {
    expect(resolveVanillaLoadMenuEntry(true)).toBe('load-net-warning');
  });
});
