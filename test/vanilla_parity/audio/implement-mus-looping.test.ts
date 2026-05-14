import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MUS_LOOP_DEFAULT,
  VANILLA_MUS_LOOP_PRESERVES_SCORE_END_TRAILING_DELAY,
  VANILLA_MUS_LOOP_REWIND_EVENT_INDEX,
  VANILLA_MUS_LOOP_VELOCITY_CACHE_RESET_ON_WRAP,
  handleVanillaMusScoreEnd,
} from '../../../src/audio/implement-mus-looping.ts';

describe('vanilla MUS looping constants', () => {
  test('loop default = true (vanilla music plays indefinitely until S_StopMusic)', () => {
    expect(VANILLA_MUS_LOOP_DEFAULT).toBe(true);
  });

  test('rewind target = event index 0', () => {
    expect(VANILLA_MUS_LOOP_REWIND_EVENT_INDEX).toBe(0);
  });

  test('per-channel velocity cache is NOT reset on loop wrap', () => {
    expect(VANILLA_MUS_LOOP_VELOCITY_CACHE_RESET_ON_WRAP).toBe(false);
  });

  test('ScoreEnd trailing delay is preserved as gap before re-fire', () => {
    expect(VANILLA_MUS_LOOP_PRESERVES_SCORE_END_TRAILING_DELAY).toBe(true);
  });
});

describe('handleVanillaMusScoreEnd', () => {
  test('looping mode: rewinds to event 0 with ScoreEnd trailing delay preserved', () => {
    const outcome = handleVanillaMusScoreEnd({ mode: 'looping', scoreEndTrailingDelay: 70, eventsLength: 1000 });
    expect(outcome).toEqual({ nextEventIndex: 0, residualDelay: 70, finished: false, velocityCachePreserved: true });
  });

  test('looping mode preserves zero trailing delay (next loop fires immediately)', () => {
    const outcome = handleVanillaMusScoreEnd({ mode: 'looping', scoreEndTrailingDelay: 0, eventsLength: 1000 });
    expect(outcome.nextEventIndex).toBe(0);
    expect(outcome.residualDelay).toBe(0);
    expect(outcome.finished).toBe(false);
  });

  test('once mode: marks finished and advances past the end', () => {
    const outcome = handleVanillaMusScoreEnd({ mode: 'once', scoreEndTrailingDelay: 70, eventsLength: 1000 });
    expect(outcome).toEqual({ nextEventIndex: 1000, residualDelay: 0, finished: true, velocityCachePreserved: true });
  });

  test('both modes preserve the per-channel velocity cache', () => {
    const looping = handleVanillaMusScoreEnd({ mode: 'looping', scoreEndTrailingDelay: 5, eventsLength: 100 });
    const once = handleVanillaMusScoreEnd({ mode: 'once', scoreEndTrailingDelay: 5, eventsLength: 100 });
    expect(looping.velocityCachePreserved).toBe(true);
    expect(once.velocityCachePreserved).toBe(true);
  });
});
