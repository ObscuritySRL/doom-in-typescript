import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MUSIC_VOLUME_DMX_MAX,
  VANILLA_MUSIC_VOLUME_DMX_SCALE_FACTOR,
  VANILLA_SND_MUSIC_VOLUME_MAX,
  VANILLA_SND_MUSIC_VOLUME_MIN,
  VANILLA_SND_SFX_VOLUME_MAX,
  VANILLA_SND_SFX_VOLUME_MIN,
  VANILLA_SOUND_VOLUME_MENU_STEP_COUNT,
  clampVanillaSoundVolume,
  vanillaMusicVolumeToDmxRegisterValue,
} from '../../../src/audio/implement-volume-controls.ts';

describe('vanilla volume controls pin', () => {
  test('sfx volume range is integer 0..15 (4-bit)', () => {
    expect(VANILLA_SND_SFX_VOLUME_MIN).toBe(0);
    expect(VANILLA_SND_SFX_VOLUME_MAX).toBe(15);
  });

  test('music volume range is integer 0..15 (4-bit)', () => {
    expect(VANILLA_SND_MUSIC_VOLUME_MIN).toBe(0);
    expect(VANILLA_SND_MUSIC_VOLUME_MAX).toBe(15);
  });

  test('menu shows 16 steps (0..15 inclusive)', () => {
    expect(VANILLA_SOUND_VOLUME_MENU_STEP_COUNT).toBe(16);
    expect(VANILLA_SOUND_VOLUME_MENU_STEP_COUNT).toBe(VANILLA_SND_SFX_VOLUME_MAX - VANILLA_SND_SFX_VOLUME_MIN + 1);
  });

  test('DMX register scale factor is 8 (15 -> 120, just under the 127 register max)', () => {
    expect(VANILLA_MUSIC_VOLUME_DMX_SCALE_FACTOR).toBe(8);
    expect(VANILLA_SND_MUSIC_VOLUME_MAX * VANILLA_MUSIC_VOLUME_DMX_SCALE_FACTOR).toBeLessThanOrEqual(VANILLA_MUSIC_VOLUME_DMX_MAX);
  });

  test('clampVanillaSoundVolume rejects non-integer input', () => {
    expect(() => clampVanillaSoundVolume(1.5)).toThrow(RangeError);
    expect(() => clampVanillaSoundVolume(Number.NaN)).toThrow(RangeError);
  });

  test('clampVanillaSoundVolume clamps below 0 to 0', () => {
    expect(clampVanillaSoundVolume(-1)).toBe(0);
    expect(clampVanillaSoundVolume(-100)).toBe(0);
  });

  test('clampVanillaSoundVolume clamps above 15 to 15', () => {
    expect(clampVanillaSoundVolume(16)).toBe(15);
    expect(clampVanillaSoundVolume(255)).toBe(15);
  });

  test('clampVanillaSoundVolume passes through valid 0..15 unchanged', () => {
    for (let value = 0; value <= 15; value += 1) {
      expect(clampVanillaSoundVolume(value)).toBe(value);
    }
  });

  test('music volume 0 yields DMX register 0 (mute)', () => {
    expect(vanillaMusicVolumeToDmxRegisterValue(0)).toBe(0);
  });

  test('music volume 15 yields DMX register 120 (15 * 8)', () => {
    expect(vanillaMusicVolumeToDmxRegisterValue(15)).toBe(120);
  });

  test('music volume out-of-range clamps before scaling', () => {
    expect(vanillaMusicVolumeToDmxRegisterValue(-5)).toBe(0);
    expect(vanillaMusicVolumeToDmxRegisterValue(99)).toBe(120);
  });
});
