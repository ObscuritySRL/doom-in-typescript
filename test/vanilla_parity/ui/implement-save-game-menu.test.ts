import { describe, expect, test } from 'bun:test';

import { VANILLA_SAVE_DEAD_MESSAGE_KEY, VANILLA_SAVE_SLOT_COUNT, VANILLA_SAVE_STRING_SIZE, clampVanillaSaveDescription, getVanillaSaveMenuSlots, resolveVanillaSaveMenuEntry } from '../../../src/ui/implement-save-game-menu.ts';

describe('save menu slot shape', () => {
  test('has exactly 6 slots', () => {
    expect(VANILLA_SAVE_SLOT_COUNT).toBe(6);
    expect(getVanillaSaveMenuSlots().length).toBe(6);
  });

  test('slot hotkeys are 1..6 in order', () => {
    const slots = getVanillaSaveMenuSlots();
    expect(slots.map((slot) => slot.hotkey)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  test('slot indices are 0..5 in order', () => {
    const slots = getVanillaSaveMenuSlots();
    expect(slots.map((slot) => slot.slotIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('every slot routes to M_SaveSelect with status byte 1', () => {
    for (const slot of getVanillaSaveMenuSlots()) {
      expect(slot.routine).toBe('M_SaveSelect');
      expect(slot.statusByte).toBe(1);
    }
  });

  test('slots are frozen', () => {
    expect(Object.isFrozen(getVanillaSaveMenuSlots())).toBe(true);
    for (const slot of getVanillaSaveMenuSlots()) {
      expect(Object.isFrozen(slot)).toBe(true);
    }
  });
});

describe('save string constants', () => {
  test('SAVESTRINGSIZE is 24', () => {
    expect(VANILLA_SAVE_STRING_SIZE).toBe(24);
  });

  test('savedead message key is SAVEDEAD', () => {
    expect(VANILLA_SAVE_DEAD_MESSAGE_KEY).toBe('SAVEDEAD');
  });
});

describe('resolveVanillaSaveMenuEntry', () => {
  test('returns save-dead-warning when not in user game', () => {
    expect(resolveVanillaSaveMenuEntry({ usergame: false, gamestate: 'GS_TITLESCREEN' })).toBe('save-dead-warning');
    expect(resolveVanillaSaveMenuEntry({ usergame: false, gamestate: 'GS_LEVEL' })).toBe('save-dead-warning');
  });

  test('returns ignored when in user game but not at GS_LEVEL', () => {
    expect(resolveVanillaSaveMenuEntry({ usergame: true, gamestate: 'GS_INTERMISSION' })).toBe('ignored');
    expect(resolveVanillaSaveMenuEntry({ usergame: true, gamestate: 'GS_FINALE' })).toBe('ignored');
    expect(resolveVanillaSaveMenuEntry({ usergame: true, gamestate: 'GS_DEMOSCREEN' })).toBe('ignored');
  });

  test('opens the save menu when in user game at GS_LEVEL', () => {
    expect(resolveVanillaSaveMenuEntry({ usergame: true, gamestate: 'GS_LEVEL' })).toBe('save-menu');
  });
});

describe('clampVanillaSaveDescription', () => {
  test('passes through descriptions up to SAVESTRINGSIZE chars', () => {
    expect(clampVanillaSaveDescription('Hello')).toBe('Hello');
    expect(clampVanillaSaveDescription('A'.repeat(24))).toBe('A'.repeat(24));
  });

  test('truncates longer descriptions to SAVESTRINGSIZE chars', () => {
    expect(clampVanillaSaveDescription('A'.repeat(50))).toHaveLength(24);
    expect(clampVanillaSaveDescription('A'.repeat(50))).toBe('A'.repeat(24));
  });
});
