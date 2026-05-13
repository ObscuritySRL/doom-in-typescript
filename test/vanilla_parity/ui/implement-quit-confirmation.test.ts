import { describe, expect, test } from 'bun:test';

import {
  VANILLA_NUM_QUITMESSAGES,
  VANILLA_QUIT_PROMPT_DOSY_KEY,
  VANILLA_QUIT_SOUND_TABLE_SIZE,
  VANILLA_QUIT_WAIT_VBL_TICS,
  pickVanillaQuitMessageIndex,
  pickVanillaQuitSound,
  resolveVanillaQuitResponse,
} from '../../../src/ui/implement-quit-confirmation.ts';

describe('quit confirmation constants', () => {
  test('NUM_QUITMESSAGES = 22', () => {
    expect(VANILLA_NUM_QUITMESSAGES).toBe(22);
  });

  test('quit sound table size = 8 (matches & 7 mask)', () => {
    expect(VANILLA_QUIT_SOUND_TABLE_SIZE).toBe(8);
  });

  test('quit wait vblank tics = 105 (~3 seconds)', () => {
    expect(VANILLA_QUIT_WAIT_VBL_TICS).toBe(105);
  });

  test('DOSY DeHackEd key', () => {
    expect(VANILLA_QUIT_PROMPT_DOSY_KEY).toBe('DOSY');
  });
});

describe('pickVanillaQuitMessageIndex', () => {
  test('gametic 0 yields index 1 (first message)', () => {
    expect(pickVanillaQuitMessageIndex({ gametic: 0 })).toBe(1);
  });

  test('gametic 20 yields index 21 (last message in range)', () => {
    // 20 % 21 = 20, +1 = 21
    expect(pickVanillaQuitMessageIndex({ gametic: 20 })).toBe(21);
  });

  test('gametic 21 wraps to index 1', () => {
    // 21 % 21 = 0, +1 = 1
    expect(pickVanillaQuitMessageIndex({ gametic: 21 })).toBe(1);
  });

  test('range is always [1, 21] inclusive', () => {
    for (let g = 0; g < 100; g += 1) {
      const idx = pickVanillaQuitMessageIndex({ gametic: g });
      expect(idx).toBeGreaterThanOrEqual(1);
      expect(idx).toBeLessThanOrEqual(21);
    }
  });
});

describe('pickVanillaQuitSound', () => {
  test('non-commercial uses quitsounds[] table', () => {
    expect(pickVanillaQuitSound({ gametic: 0, gameMode: 'shareware' }).tableKind).toBe('quitsounds');
    expect(pickVanillaQuitSound({ gametic: 0, gameMode: 'registered' }).tableKind).toBe('quitsounds');
    expect(pickVanillaQuitSound({ gametic: 0, gameMode: 'retail' }).tableKind).toBe('quitsounds');
  });

  test('commercial uses quitsounds2[] table', () => {
    expect(pickVanillaQuitSound({ gametic: 0, gameMode: 'commercial' }).tableKind).toBe('quitsounds2');
  });

  test('index = (gametic >> 2) & 7 (range 0..7)', () => {
    expect(pickVanillaQuitSound({ gametic: 0, gameMode: 'shareware' }).index).toBe(0);
    expect(pickVanillaQuitSound({ gametic: 4, gameMode: 'shareware' }).index).toBe(1);
    expect(pickVanillaQuitSound({ gametic: 28, gameMode: 'shareware' }).index).toBe(7);
    expect(pickVanillaQuitSound({ gametic: 32, gameMode: 'shareware' }).index).toBe(0);
  });

  test('result is frozen', () => {
    expect(Object.isFrozen(pickVanillaQuitSound({ gametic: 0, gameMode: 'shareware' }))).toBe(true);
  });
});

describe('resolveVanillaQuitResponse', () => {
  test('non-confirm key cancels the quit', () => {
    expect(resolveVanillaQuitResponse({ key: 'n', menuConfirmKey: 'y', isNetgame: false })).toBe('cancel');
    expect(resolveVanillaQuitResponse({ key: 'escape', menuConfirmKey: 'y', isNetgame: false })).toBe('cancel');
  });

  test('confirm key in single-player plays sound then exits', () => {
    expect(resolveVanillaQuitResponse({ key: 'y', menuConfirmKey: 'y', isNetgame: false })).toBe('play-sound-then-exit');
  });

  test('confirm key in netgame exits immediately (no sound, no wait)', () => {
    expect(resolveVanillaQuitResponse({ key: 'y', menuConfirmKey: 'y', isNetgame: true })).toBe('exit-immediately');
  });
});
