import { describe, expect, test } from 'bun:test';

import { VANILLA_MIN_AUDIBLE_LINK_VOLUME, VANILLA_NORM_SEP, VANILLA_UPDATE_SOUNDS_ORIGIN_RULES, classifyVanillaOriginCase } from '../../../src/audio/implement-sound-origin-tracking.ts';
import { NORM_SEP } from '../../../src/audio/spatial.ts';

describe('vanilla S_UpdateSounds origin tracking pin', () => {
  test('NORM_SEP centre pan is 128 and matches spatial.ts runtime constant', () => {
    expect(VANILLA_NORM_SEP).toBe(128);
    expect(VANILLA_NORM_SEP).toBe(NORM_SEP);
  });

  test('link-adjusted volume floor before stop is 1', () => {
    expect(VANILLA_MIN_AUDIBLE_LINK_VOLUME).toBe(1);
  });

  test('anonymous origin (null) skips S_AdjustSoundParams', () => {
    expect(VANILLA_UPDATE_SOUNDS_ORIGIN_RULES.anonymous.callsAdjustSoundParams).toBe(false);
  });

  test('listener-self origin skips S_AdjustSoundParams (no re-pan of own sounds)', () => {
    expect(VANILLA_UPDATE_SOUNDS_ORIGIN_RULES['self-listener'].callsAdjustSoundParams).toBe(false);
  });

  test('remote mobj origin calls S_AdjustSoundParams every tic', () => {
    expect(VANILLA_UPDATE_SOUNDS_ORIGIN_RULES['remote-mobj'].callsAdjustSoundParams).toBe(true);
  });

  test('classifyVanillaOriginCase distinguishes null, self, and remote', () => {
    expect(classifyVanillaOriginCase(null, 42)).toBe('anonymous');
    expect(classifyVanillaOriginCase(42, 42)).toBe('self-listener');
    expect(classifyVanillaOriginCase(7, 42)).toBe('remote-mobj');
    expect(classifyVanillaOriginCase(null, null)).toBe('anonymous');
  });

  test('non-null origin with null listener is treated as remote (no self match possible)', () => {
    expect(classifyVanillaOriginCase(42, null)).toBe('remote-mobj');
  });
});
