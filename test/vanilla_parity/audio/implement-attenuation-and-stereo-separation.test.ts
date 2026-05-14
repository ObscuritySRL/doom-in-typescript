import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import {
  VANILLA_BOSS_GAMEMAP_NUMBER,
  VANILLA_BOSS_MAP_VOLUME_FLOOR,
  VANILLA_NORM_SEP_CENTRE_PAN,
  VANILLA_S_ATTENUATOR,
  VANILLA_S_CLIPPING_DIST_FIXED,
  VANILLA_S_CLOSE_DIST_FIXED,
  VANILLA_S_STEREO_SWING_FIXED,
  vanillaApproxDistanceFixed,
  vanillaComputeSfxVolume,
  vanillaIsSoundAudibleByClipping,
} from '../../../src/audio/implement-attenuation-and-stereo-separation.ts';

describe('vanilla attenuation constants', () => {
  test('S_CLIPPING_DIST = 1200 fixed, S_CLOSE_DIST = 200 fixed', () => {
    expect(VANILLA_S_CLIPPING_DIST_FIXED).toBe(1200 << FRACBITS);
    expect(VANILLA_S_CLOSE_DIST_FIXED).toBe(200 << FRACBITS);
  });

  test('S_ATTENUATOR = (CLIPPING - CLOSE) >> FRACBITS = 1000', () => {
    expect(VANILLA_S_ATTENUATOR).toBe(1000);
  });

  test('S_STEREO_SWING = 96 fixed, NORM_SEP = 128, boss volume floor = 15, boss map = 8', () => {
    expect(VANILLA_S_STEREO_SWING_FIXED).toBe(96 << FRACBITS);
    expect(VANILLA_NORM_SEP_CENTRE_PAN).toBe(128);
    expect(VANILLA_BOSS_MAP_VOLUME_FLOOR).toBe(15);
    expect(VANILLA_BOSS_GAMEMAP_NUMBER).toBe(8);
  });
});

describe('vanillaApproxDistanceFixed', () => {
  test('Manhattan-with-min-corner formula matches Game Gems I', () => {
    // dx=3 fixed, dy=4 fixed => |dx|+|dy| - min/2 = 7 - 1 = 6 (in raw fixed units)
    expect(vanillaApproxDistanceFixed(3 << FRACBITS, 4 << FRACBITS)).toBe((3 << FRACBITS) + (4 << FRACBITS) - ((3 << FRACBITS) >> 1));
  });

  test('absolutes are taken before the min', () => {
    expect(vanillaApproxDistanceFixed(-3 << FRACBITS, -4 << FRACBITS)).toBe((3 << FRACBITS) + (4 << FRACBITS) - ((3 << FRACBITS) >> 1));
  });

  test('zero deltas yield zero distance', () => {
    expect(vanillaApproxDistanceFixed(0, 0)).toBe(0);
  });
});

describe('vanillaIsSoundAudibleByClipping', () => {
  test('cutoff applies on non-boss maps', () => {
    expect(vanillaIsSoundAudibleByClipping(VANILLA_S_CLIPPING_DIST_FIXED, 1)).toBe(true);
    expect(vanillaIsSoundAudibleByClipping(VANILLA_S_CLIPPING_DIST_FIXED + 1, 1)).toBe(false);
  });

  test('boss-map exception keeps everything audible', () => {
    expect(vanillaIsSoundAudibleByClipping(VANILLA_S_CLIPPING_DIST_FIXED * 2, VANILLA_BOSS_GAMEMAP_NUMBER)).toBe(true);
  });
});

describe('vanillaComputeSfxVolume', () => {
  test('close-distance always returns full sfxVolume', () => {
    expect(vanillaComputeSfxVolume(VANILLA_S_CLOSE_DIST_FIXED - 1, 96, 1)).toBe(96);
    expect(vanillaComputeSfxVolume(VANILLA_S_CLOSE_DIST_FIXED - 1, 96, VANILLA_BOSS_GAMEMAP_NUMBER)).toBe(96);
  });

  test('non-boss map: linear taper from sfxVolume at CLOSE_DIST down to 0 at CLIPPING_DIST', () => {
    expect(vanillaComputeSfxVolume(VANILLA_S_CLIPPING_DIST_FIXED, 96, 1)).toBe(0);
    // Mid-point distance: (CLIPPING - dist >> FRACBITS) = 500; vol = 96 * 500 / 1000 = 48
    expect(vanillaComputeSfxVolume((700 << FRACBITS) as ReturnType<typeof vanillaApproxDistanceFixed>, 96, 1)).toBe(48);
  });

  test('boss map: volume floors at 15 even past CLIPPING_DIST (clamp + floor)', () => {
    // dist clamped to CLIPPING => fraction = 0 => 15 + (96-15)*0/1000 = 15
    expect(vanillaComputeSfxVolume(VANILLA_S_CLIPPING_DIST_FIXED * 2, 96, VANILLA_BOSS_GAMEMAP_NUMBER)).toBe(15);
  });

  test('boss map mid-distance: 15 + (sfxVolume-15) * fraction / 1000', () => {
    // dist = 700 fixed => fraction = 500; vol = 15 + 81*500/1000 = 15 + 40 = 55
    expect(vanillaComputeSfxVolume((700 << FRACBITS) as ReturnType<typeof vanillaApproxDistanceFixed>, 96, VANILLA_BOSS_GAMEMAP_NUMBER)).toBe(55);
  });
});
