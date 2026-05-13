import { describe, expect, test } from 'bun:test';

import { VANILLA_ENDGAME_MESSAGE_KEY, VANILLA_ENDGAME_OOF_SOUND_KEY, VANILLA_NETEND_MESSAGE_KEY, resolveVanillaEndGameEntry, resolveVanillaEndGameResponse } from '../../../src/ui/implement-end-game-confirmation.ts';

describe('resolveVanillaEndGameEntry', () => {
  test('returns play-oof-sound when not in user game', () => {
    expect(resolveVanillaEndGameEntry({ usergame: false, isNetgame: false })).toBe('play-oof-sound');
    expect(resolveVanillaEndGameEntry({ usergame: false, isNetgame: true })).toBe('play-oof-sound');
  });

  test('returns netend-warning when in user game but netgame', () => {
    expect(resolveVanillaEndGameEntry({ usergame: true, isNetgame: true })).toBe('netend-warning');
  });

  test('returns endgame-confirm in single-player user game', () => {
    expect(resolveVanillaEndGameEntry({ usergame: true, isNetgame: false })).toBe('endgame-confirm');
  });
});

describe('resolveVanillaEndGameResponse', () => {
  test('confirm key returns to title', () => {
    expect(resolveVanillaEndGameResponse({ key: 'y', menuConfirmKey: 'y' })).toBe('return-to-title');
  });

  test('any other key cancels', () => {
    expect(resolveVanillaEndGameResponse({ key: 'n', menuConfirmKey: 'y' })).toBe('cancel');
    expect(resolveVanillaEndGameResponse({ key: 'escape', menuConfirmKey: 'y' })).toBe('cancel');
  });
});

describe('DeHackEd message keys', () => {
  test('ENDGAME message key', () => {
    expect(VANILLA_ENDGAME_MESSAGE_KEY).toBe('ENDGAME');
  });

  test('NETEND message key', () => {
    expect(VANILLA_NETEND_MESSAGE_KEY).toBe('NETEND');
  });

  test('sfx_oof identifier', () => {
    expect(VANILLA_ENDGAME_OOF_SOUND_KEY).toBe('sfx_oof');
  });
});
