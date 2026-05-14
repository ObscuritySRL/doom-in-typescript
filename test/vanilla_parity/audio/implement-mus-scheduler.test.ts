import { describe, expect, test } from 'bun:test';

import { MUS_DEFAULT_VELOCITY, MUS_TICKS_PER_GAME_TIC, MUS_TICK_HZ } from '../../../src/audio/musScheduler.ts';
import {
  VANILLA_GAMEPLAY_TICK_RATE_HZ,
  VANILLA_MUS_CHANNEL_COUNT,
  VANILLA_MUS_DEFAULT_VELOCITY,
  VANILLA_MUS_PERCUSSION_CHANNEL,
  VANILLA_MUS_PLAY_NOTE_VELOCITY_BIT_MASK,
  VANILLA_MUS_TICKS_PER_GAMETIC,
  VANILLA_MUS_TICK_RATE_HZ,
  resolveVanillaMusPlayNoteVelocity,
  vanillaMusQuickticksForGameTics,
} from '../../../src/audio/implement-mus-scheduler.ts';

describe('vanilla MUS scheduler tick-rate constants', () => {
  test('MUS tick rate 140 Hz / 35 Hz gameplay = 4 quickticks per gametic', () => {
    expect(VANILLA_MUS_TICK_RATE_HZ).toBe(140);
    expect(VANILLA_GAMEPLAY_TICK_RATE_HZ).toBe(35);
    expect(VANILLA_MUS_TICKS_PER_GAMETIC).toBe(4);
  });

  test('matches musScheduler.ts runtime constants', () => {
    expect(VANILLA_MUS_TICK_RATE_HZ).toBe(MUS_TICK_HZ);
    expect(VANILLA_MUS_TICKS_PER_GAMETIC).toBe(MUS_TICKS_PER_GAME_TIC);
    expect(VANILLA_MUS_DEFAULT_VELOCITY).toBe(MUS_DEFAULT_VELOCITY);
  });
});

describe('vanilla MUS scheduler channel/velocity constants', () => {
  test('16 MUS channels, percussion at index 15, default velocity 127, velocity bit mask 0x80', () => {
    expect(VANILLA_MUS_CHANNEL_COUNT).toBe(16);
    expect(VANILLA_MUS_PERCUSSION_CHANNEL).toBe(15);
    expect(VANILLA_MUS_DEFAULT_VELOCITY).toBe(127);
    expect(VANILLA_MUS_PLAY_NOTE_VELOCITY_BIT_MASK).toBe(0x80);
  });
});

describe('resolveVanillaMusPlayNoteVelocity', () => {
  test('explicit velocity updates the cache and is dispatched directly', () => {
    const result = resolveVanillaMusPlayNoteVelocity({ channel: 0, hasExplicitVelocity: true, explicitVelocity: 90, cachedVelocity: 50 });
    expect(result.dispatchedVelocity).toBe(90);
    expect(result.cacheUpdated).toBe(true);
  });

  test('implicit velocity reuses the cache without updating it', () => {
    const result = resolveVanillaMusPlayNoteVelocity({ channel: 0, hasExplicitVelocity: false, explicitVelocity: null, cachedVelocity: 64 });
    expect(result.dispatchedVelocity).toBe(64);
    expect(result.cacheUpdated).toBe(false);
  });

  test('velocity is masked to 7 bits on dispatch (0..127)', () => {
    const result = resolveVanillaMusPlayNoteVelocity({ channel: 5, hasExplicitVelocity: true, explicitVelocity: 0xff, cachedVelocity: 0 });
    expect(result.dispatchedVelocity).toBe(127);
  });

  test('hasExplicitVelocity=true with null explicitVelocity throws (bad caller invariant)', () => {
    expect(() => resolveVanillaMusPlayNoteVelocity({ channel: 0, hasExplicitVelocity: true, explicitVelocity: null, cachedVelocity: 0 })).toThrow(TypeError);
  });
});

describe('vanillaMusQuickticksForGameTics', () => {
  test('scales game tics by 4', () => {
    expect(vanillaMusQuickticksForGameTics(0)).toBe(0);
    expect(vanillaMusQuickticksForGameTics(1)).toBe(4);
    expect(vanillaMusQuickticksForGameTics(35)).toBe(140); // 1 second of gameplay = 140 quickticks (1 sec of MUS)
  });

  test('returns an int32 (no fractional quickticks)', () => {
    const result = vanillaMusQuickticksForGameTics(7);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(28);
  });
});
