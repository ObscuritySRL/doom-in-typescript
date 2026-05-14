import { describe, expect, test } from 'bun:test';

import { VANILLA_STOP_CHANNEL_ORDER, VANILLA_STOP_CHANNEL_PRESERVES_HANDLE, applyVanillaStopChannel } from '../../../src/audio/implement-sound-channel-eviction.ts';

describe('vanilla S_StopChannel eviction pin', () => {
  test('eviction order is I_StopSound, usefulness--, sfxinfo=null, origin=null', () => {
    expect([...VANILLA_STOP_CHANNEL_ORDER]).toEqual(['i-stop-sound', 'decrement-usefulness', 'null-sfxinfo', 'null-origin']);
  });

  test('hardware stop precedes usefulness decrement', () => {
    expect(VANILLA_STOP_CHANNEL_ORDER.indexOf('i-stop-sound')).toBeLessThan(VANILLA_STOP_CHANNEL_ORDER.indexOf('decrement-usefulness'));
  });

  test('usefulness decrement precedes sfxinfo nulling (otherwise the decrement target is gone)', () => {
    expect(VANILLA_STOP_CHANNEL_ORDER.indexOf('decrement-usefulness')).toBeLessThan(VANILLA_STOP_CHANNEL_ORDER.indexOf('null-sfxinfo'));
  });

  test('handle is preserved (not zeroed) by S_StopChannel', () => {
    expect(VANILLA_STOP_CHANNEL_PRESERVES_HANDLE).toBe(true);
  });

  test('applyVanillaStopChannel on occupied slot runs all four steps', () => {
    const outcome = applyVanillaStopChannel(true);
    expect(outcome.handleStopped).toBe(true);
    expect(outcome.usefulnessDecremented).toBe(true);
    expect(outcome.sfxInfoCleared).toBe(true);
    expect(outcome.originCleared).toBe(true);
  });

  test('applyVanillaStopChannel on already-free slot is a no-op (matches `if (c->sfxinfo)` guard)', () => {
    const outcome = applyVanillaStopChannel(false);
    expect(outcome.handleStopped).toBe(false);
    expect(outcome.usefulnessDecremented).toBe(false);
    expect(outcome.sfxInfoCleared).toBe(false);
    expect(outcome.originCleared).toBe(false);
  });
});
