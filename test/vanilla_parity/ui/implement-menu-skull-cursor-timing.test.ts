import { describe, expect, test } from 'bun:test';

import {
  VANILLA_LINEHEIGHT,
  VANILLA_SKULLXOFF,
  VANILLA_SKULL_ANIM_INITIAL_TICS,
  VANILLA_SKULL_ANIM_RESET_TICS,
  VANILLA_SKULL_LUMP_M_SKULL1,
  VANILLA_SKULL_LUMP_M_SKULL2,
  getVanillaSkullLumpForFrame,
  tickVanillaSkullCursor,
} from '../../../src/ui/implement-menu-skull-cursor-timing.ts';

describe('skull animation constants', () => {
  test('reset tics is 8 (steady-state phase)', () => {
    expect(VANILLA_SKULL_ANIM_RESET_TICS).toBe(8);
  });

  test('initial tics is 10 at M_Init', () => {
    expect(VANILLA_SKULL_ANIM_INITIAL_TICS).toBe(10);
  });

  test('skull lumps are M_SKULL1 and M_SKULL2', () => {
    expect(VANILLA_SKULL_LUMP_M_SKULL1).toBe('M_SKULL1');
    expect(VANILLA_SKULL_LUMP_M_SKULL2).toBe('M_SKULL2');
  });

  test('SKULLXOFF -32 and LINEHEIGHT 16', () => {
    expect(VANILLA_SKULLXOFF).toBe(-32);
    expect(VANILLA_LINEHEIGHT).toBe(16);
  });
});

describe('tickVanillaSkullCursor', () => {
  test('decrements counter when positive (no toggle)', () => {
    const result = tickVanillaSkullCursor({ skullAnimCounter: 5, whichSkull: 0 });
    expect(result.skullAnimCounterAfter).toBe(4);
    expect(result.whichSkullAfter).toBe(0);
    expect(result.toggled).toBe(false);
  });

  test('toggles whichSkull from 0->1 when counter reaches 0', () => {
    const result = tickVanillaSkullCursor({ skullAnimCounter: 1, whichSkull: 0 });
    expect(result.skullAnimCounterAfter).toBe(8);
    expect(result.whichSkullAfter).toBe(1);
    expect(result.toggled).toBe(true);
  });

  test('toggles whichSkull from 1->0 on next reset', () => {
    const result = tickVanillaSkullCursor({ skullAnimCounter: 1, whichSkull: 1 });
    expect(result.whichSkullAfter).toBe(0);
    expect(result.toggled).toBe(true);
  });

  test('result is frozen', () => {
    const result = tickVanillaSkullCursor({ skullAnimCounter: 5, whichSkull: 0 });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('full animation cycle', () => {
  test('initial 10 tics + 8 tics + 8 tics = 26 tics for first M_SKULL1 -> M_SKULL2 -> M_SKULL1', () => {
    let counter = VANILLA_SKULL_ANIM_INITIAL_TICS;
    let skull: 0 | 1 = 0;
    let toggles = 0;
    let ticks = 0;
    while (toggles < 2) {
      const result = tickVanillaSkullCursor({ skullAnimCounter: counter, whichSkull: skull });
      counter = result.skullAnimCounterAfter;
      skull = result.whichSkullAfter;
      ticks += 1;
      if (result.toggled) toggles += 1;
      if (ticks > 100) throw new Error('runaway loop');
    }
    expect(ticks).toBe(VANILLA_SKULL_ANIM_INITIAL_TICS + VANILLA_SKULL_ANIM_RESET_TICS);
    expect(skull).toBe(0);
  });
});

describe('getVanillaSkullLumpForFrame', () => {
  test('frame 0 -> M_SKULL1', () => {
    expect(getVanillaSkullLumpForFrame(0)).toBe('M_SKULL1');
  });

  test('frame 1 -> M_SKULL2', () => {
    expect(getVanillaSkullLumpForFrame(1)).toBe('M_SKULL2');
  });
});
