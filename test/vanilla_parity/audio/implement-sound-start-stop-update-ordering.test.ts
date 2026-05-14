import { describe, expect, test } from 'bun:test';

import { VANILLA_SFX_NONE, classifyStartAgainstExisting, orderTicSoundCalls, shouldStartSoundCallSkip, type VanillaSoundCall } from '../../../src/audio/implement-sound-start-stop-update-ordering.ts';

describe('vanilla sound start/stop/update ordering', () => {
  test('sfx_None constant is 0 to match s_sound.c guard', () => {
    expect(VANILLA_SFX_NONE).toBe(0);
  });

  test('shouldStartSoundCallSkip returns true only for sfx_None', () => {
    expect(shouldStartSoundCallSkip(VANILLA_SFX_NONE)).toBe(true);
    expect(shouldStartSoundCallSkip(1)).toBe(false);
    expect(shouldStartSoundCallSkip(42)).toBe(false);
  });

  test('orderTicSoundCalls places update pass first then thinker-issued starts/stops', () => {
    const update: VanillaSoundCall = { kind: 'update', origin: null, sfxId: VANILLA_SFX_NONE };
    const start: VanillaSoundCall = { kind: 'start', origin: 1, sfxId: 17 };
    const stop: VanillaSoundCall = { kind: 'stop', origin: 2, sfxId: VANILLA_SFX_NONE };
    const ordered = orderTicSoundCalls([update], [start, stop]);
    expect(ordered.map((c) => c.kind)).toEqual(['update', 'start', 'stop']);
  });

  test('orderTicSoundCalls preserves the order thinkers issued their start/stop calls', () => {
    const update: VanillaSoundCall = { kind: 'update', origin: null, sfxId: VANILLA_SFX_NONE };
    const startA: VanillaSoundCall = { kind: 'start', origin: 1, sfxId: 5 };
    const stopA: VanillaSoundCall = { kind: 'stop', origin: 1, sfxId: VANILLA_SFX_NONE };
    const startB: VanillaSoundCall = { kind: 'start', origin: 2, sfxId: 7 };
    const ordered = orderTicSoundCalls([update], [startA, stopA, startB]);
    expect(ordered.slice(1)).toEqual([startA, stopA, startB]);
  });

  test('orderTicSoundCalls rejects non-update calls in the update pass', () => {
    const bad: VanillaSoundCall = { kind: 'start', origin: 1, sfxId: 1 };
    expect(() => orderTicSoundCalls([bad], [])).toThrow();
  });

  test('classifyStartAgainstExisting returns start-fresh when origin idle', () => {
    expect(classifyStartAgainstExisting(null, 5)).toBe('start-fresh');
  });

  test('classifyStartAgainstExisting drops same-sfx same-origin restarts', () => {
    expect(classifyStartAgainstExisting(5, 5)).toBe('drop');
  });

  test('classifyStartAgainstExisting stops-then-starts on different sfx for same origin', () => {
    expect(classifyStartAgainstExisting(5, 7)).toBe('stop-then-start');
  });
});
