import { describe, expect, test } from 'bun:test';

import { VANILLA_SOUND_SHUTDOWN_ORDER, vanillaSoundShutdownStepIndex, vanillaSoundShutdownStepPrecedes } from '../../../src/audio/implement-sound-shutdown-ordering.ts';

describe('vanilla sound shutdown ordering pin', () => {
  test('shutdown order is I_StopSong, I_UnRegisterSong, I_ShutdownMusic, I_StopSound-per-channel, S_StopChannel-per-channel, I_ShutdownSound', () => {
    expect([...VANILLA_SOUND_SHUTDOWN_ORDER]).toEqual(['I_StopSong', 'I_UnRegisterSong', 'I_ShutdownMusic', 'I_StopSound-per-channel', 'S_StopChannel-per-channel', 'I_ShutdownSound']);
  });

  test('music driver shutdown precedes sfx hardware shutdown', () => {
    expect(vanillaSoundShutdownStepPrecedes('I_ShutdownMusic', 'I_ShutdownSound')).toBe(true);
  });

  test('song-stop precedes unregister precedes music driver shutdown', () => {
    expect(vanillaSoundShutdownStepPrecedes('I_StopSong', 'I_UnRegisterSong')).toBe(true);
    expect(vanillaSoundShutdownStepPrecedes('I_UnRegisterSong', 'I_ShutdownMusic')).toBe(true);
  });

  test('per-channel I_StopSound precedes per-channel S_StopChannel (drain before release)', () => {
    expect(vanillaSoundShutdownStepPrecedes('I_StopSound-per-channel', 'S_StopChannel-per-channel')).toBe(true);
  });

  test('S_StopChannel cleanup precedes I_ShutdownSound (channels released before driver)', () => {
    expect(vanillaSoundShutdownStepPrecedes('S_StopChannel-per-channel', 'I_ShutdownSound')).toBe(true);
  });

  test('vanillaSoundShutdownStepIndex returns 0..5 for the six pinned steps', () => {
    expect(vanillaSoundShutdownStepIndex('I_StopSong')).toBe(0);
    expect(vanillaSoundShutdownStepIndex('I_ShutdownSound')).toBe(5);
  });

  test('I_ShutdownMusic must run before I_StopSound-per-channel (music timer cleared before sfx drain)', () => {
    expect(vanillaSoundShutdownStepPrecedes('I_ShutdownMusic', 'I_StopSound-per-channel')).toBe(true);
  });
});
