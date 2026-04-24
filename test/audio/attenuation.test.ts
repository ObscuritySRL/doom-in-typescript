import { describe, expect, it } from 'bun:test';

import { ANG90, ANG180, ANG270 } from '../../src/core/angle.ts';
import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { BOSS_MAP_MIN_VOLUME, BOSS_MAP_NUMBER, MAX_STEREO_SEP, MIN_STEREO_SEP, NORM_SEP, S_ATTENUATOR, S_CLIPPING_DIST, S_CLOSE_DIST, S_STEREO_SWING, adjustSoundParams } from '../../src/audio/spatial.ts';
import type { AdjustSoundParams, AdjustSoundResult } from '../../src/audio/spatial.ts';

const FULL_VOL = 15;
const HALF_VOL = 8;
const MIDWAY_DIST = 700 * FRACUNIT;

function call(overrides: Partial<AdjustSoundParams> = {}): AdjustSoundResult {
  return adjustSoundParams({
    listener: overrides.listener ?? { x: 0, y: 0, angle: 0 },
    source: overrides.source ?? { x: 0, y: 0 },
    sfxVolume: overrides.sfxVolume ?? FULL_VOL,
    isBossMap: overrides.isBossMap ?? false,
  });
}

describe('spatial constants', () => {
  it('S_CLOSE_DIST === 200 * FRACUNIT', () => {
    expect(S_CLOSE_DIST).toBe(200 * FRACUNIT);
  });

  it('S_CLIPPING_DIST === 1200 * FRACUNIT', () => {
    expect(S_CLIPPING_DIST).toBe(1200 * FRACUNIT);
  });

  it('S_ATTENUATOR === (S_CLIPPING_DIST - S_CLOSE_DIST) >> FRACBITS === 1000', () => {
    expect(S_ATTENUATOR).toBe(1000);
    expect(S_ATTENUATOR).toBe((S_CLIPPING_DIST - S_CLOSE_DIST) >> FRACBITS);
  });

  it('S_STEREO_SWING === 96 * FRACUNIT', () => {
    expect(S_STEREO_SWING).toBe(96 * FRACUNIT);
  });

  it('NORM_SEP === 128', () => {
    expect(NORM_SEP).toBe(128);
  });

  it('BOSS_MAP_MIN_VOLUME === 15', () => {
    expect(BOSS_MAP_MIN_VOLUME).toBe(15);
  });

  it('BOSS_MAP_NUMBER === 8', () => {
    expect(BOSS_MAP_NUMBER).toBe(8);
  });

  it('MIN_STEREO_SEP === NORM_SEP - 96 === 32', () => {
    expect(MIN_STEREO_SEP).toBe(32);
    expect(MIN_STEREO_SEP).toBe(NORM_SEP - 96);
  });

  it('MAX_STEREO_SEP === NORM_SEP + 96 === 224', () => {
    expect(MAX_STEREO_SEP).toBe(224);
    expect(MAX_STEREO_SEP).toBe(NORM_SEP + 96);
  });
});

describe('adjustSoundParams — non-boss attenuation curve', () => {
  it('returns full sfxVolume when source is strictly inside S_CLOSE_DIST', () => {
    const r = call({ source: { x: FRACUNIT, y: 0 }, sfxVolume: FULL_VOL });
    expect(r.volume).toBe(FULL_VOL);
    expect(r.audible).toBe(true);
  });

  it('returns full sfxVolume when source sits exactly at S_CLOSE_DIST (linear branch agrees)', () => {
    const r = call({ source: { x: S_CLOSE_DIST, y: 0 }, sfxVolume: FULL_VOL });
    expect(r.volume).toBe(FULL_VOL);
    expect(r.audible).toBe(true);
  });

  it('returns 0 / inaudible exactly at S_CLIPPING_DIST', () => {
    const r = call({ source: { x: S_CLIPPING_DIST, y: 0 }, sfxVolume: FULL_VOL });
    expect(r.volume).toBe(0);
    expect(r.audible).toBe(false);
  });

  it('early-exits (audible=false, volume=0) beyond S_CLIPPING_DIST', () => {
    const r = call({ source: { x: S_CLIPPING_DIST + FRACUNIT, y: 0 }, sfxVolume: FULL_VOL });
    expect(r.volume).toBe(0);
    expect(r.audible).toBe(false);
  });

  it('on early-exit sets separation to NORM_SEP (reference never computes the angle math)', () => {
    const r = call({ source: { x: S_CLIPPING_DIST + 10 * FRACUNIT, y: 0 }, sfxVolume: FULL_VOL });
    expect(r.separation).toBe(NORM_SEP);
  });

  it('midway (700 * FRACUNIT, ramp=500/1000) attenuates sfxVolume=15 → 7 via C trunc', () => {
    const r = call({ source: { x: MIDWAY_DIST, y: 0 }, sfxVolume: FULL_VOL });
    expect(r.volume).toBe(7);
    expect(r.audible).toBe(true);
  });

  it('midway (700 * FRACUNIT) attenuates sfxVolume=8 → 4', () => {
    const r = call({ source: { x: MIDWAY_DIST, y: 0 }, sfxVolume: HALF_VOL });
    expect(r.volume).toBe(4);
    expect(r.audible).toBe(true);
  });

  it('midway (700 * FRACUNIT) attenuates sfxVolume=10 → 5', () => {
    const r = call({ source: { x: MIDWAY_DIST, y: 0 }, sfxVolume: 10 });
    expect(r.volume).toBe(5);
  });

  it('sfxVolume=0 is silent everywhere even inside S_CLOSE_DIST', () => {
    const r = call({ source: { x: FRACUNIT, y: 0 }, sfxVolume: 0 });
    expect(r.volume).toBe(0);
    expect(r.audible).toBe(false);
  });

  it('sfxVolume=0 is silent at the linear-branch ramp too', () => {
    const r = call({ source: { x: MIDWAY_DIST, y: 0 }, sfxVolume: 0 });
    expect(r.volume).toBe(0);
    expect(r.audible).toBe(false);
  });

  it('matches the reference linear formula for a sweep of distances', () => {
    const sfxVolume = 15;
    for (let d = S_CLOSE_DIST; d <= S_CLIPPING_DIST; d += 50 * FRACUNIT) {
      const expected = Math.trunc((sfxVolume * ((S_CLIPPING_DIST - d) >> FRACBITS)) / S_ATTENUATOR);
      const r = call({ source: { x: d, y: 0 }, sfxVolume });
      expect(r.volume).toBe(expected);
    }
  });

  it('uses the Manhattan-minus-half-min distance (adx=ady sweeps)', () => {
    const sfxVolume = 15;
    const d = 500 * FRACUNIT;
    const approx = d + d - (d >> 1);
    const r = call({ source: { x: d, y: d }, sfxVolume });
    if (approx > S_CLIPPING_DIST) {
      expect(r.volume).toBe(0);
    } else if (approx < S_CLOSE_DIST) {
      expect(r.volume).toBe(sfxVolume);
    } else {
      const expected = Math.trunc((sfxVolume * ((S_CLIPPING_DIST - approx) >> FRACBITS)) / S_ATTENUATOR);
      expect(r.volume).toBe(expected);
    }
  });

  it('negative coordinates produce the same approx distance as positive (abs on both axes)', () => {
    const a = call({ source: { x: MIDWAY_DIST, y: 0 } });
    const b = call({ source: { x: -MIDWAY_DIST, y: 0 } });
    expect(b.volume).toBe(a.volume);
  });
});

describe('adjustSoundParams — boss map floor-of-15 branch', () => {
  it('does NOT early-exit beyond S_CLIPPING_DIST when isBossMap=true', () => {
    const r = call({
      source: { x: S_CLIPPING_DIST + 500 * FRACUNIT, y: 0 },
      sfxVolume: FULL_VOL,
      isBossMap: true,
    });
    expect(r.audible).toBe(true);
  });

  it('clamps approx_dist to S_CLIPPING_DIST before the ramp and yields volume=15', () => {
    const r = call({
      source: { x: S_CLIPPING_DIST + 500 * FRACUNIT, y: 0 },
      sfxVolume: FULL_VOL,
      isBossMap: true,
    });
    expect(r.volume).toBe(BOSS_MAP_MIN_VOLUME);
  });

  it('boss map with sfxVolume=15 produces volume=15 at every distance beyond S_CLOSE_DIST', () => {
    for (let d = S_CLOSE_DIST; d <= S_CLIPPING_DIST; d += 100 * FRACUNIT) {
      const r = call({ source: { x: d, y: 0 }, sfxVolume: FULL_VOL, isBossMap: true });
      expect(r.volume).toBe(BOSS_MAP_MIN_VOLUME);
    }
  });

  it('boss map with sfxVolume=15 inside S_CLOSE_DIST still returns 15 (close-dist branch)', () => {
    const r = call({ source: { x: FRACUNIT, y: 0 }, sfxVolume: FULL_VOL, isBossMap: true });
    expect(r.volume).toBe(FULL_VOL);
  });

  it('boss map with sfxVolume=8 at exactly S_CLOSE_DIST produces volume=8 (ramp=1000)', () => {
    const r = call({ source: { x: S_CLOSE_DIST, y: 0 }, sfxVolume: HALF_VOL, isBossMap: true });
    expect(r.volume).toBe(HALF_VOL);
  });

  it('boss map with sfxVolume=8 midway (ramp=500) produces 15 + trunc(-7 * 500 / 1000) = 12', () => {
    const r = call({ source: { x: MIDWAY_DIST, y: 0 }, sfxVolume: HALF_VOL, isBossMap: true });
    expect(r.volume).toBe(12);
  });

  it('boss map with sfxVolume=0 at S_CLOSE_DIST produces volume=0 (audible=false)', () => {
    const r = call({ source: { x: S_CLOSE_DIST, y: 0 }, sfxVolume: 0, isBossMap: true });
    expect(r.volume).toBe(0);
    expect(r.audible).toBe(false);
  });

  it('boss map with sfxVolume=0 at S_CLIPPING_DIST still returns volume=15 (ramp collapses)', () => {
    const r = call({ source: { x: S_CLIPPING_DIST, y: 0 }, sfxVolume: 0, isBossMap: true });
    expect(r.volume).toBe(BOSS_MAP_MIN_VOLUME);
    expect(r.audible).toBe(true);
  });

  it('boss map volume grows monotonically from sfxVolume (close) to 15 (far) when sfxVolume < 15', () => {
    const sfxVolume = 5;
    let prev = -1;
    for (const d of [S_CLOSE_DIST, 400 * FRACUNIT, 700 * FRACUNIT, 1000 * FRACUNIT, S_CLIPPING_DIST]) {
      const r = call({ source: { x: d, y: 0 }, sfxVolume, isBossMap: true });
      expect(r.volume).toBeGreaterThanOrEqual(prev);
      prev = r.volume;
    }
    expect(prev).toBe(BOSS_MAP_MIN_VOLUME);
  });

  it('boss map is sfxVolume-equivalent to non-boss when sfxVolume=15 at S_CLOSE_DIST', () => {
    const boss = call({ source: { x: S_CLOSE_DIST, y: 0 }, sfxVolume: FULL_VOL, isBossMap: true });
    const flat = call({ source: { x: S_CLOSE_DIST, y: 0 }, sfxVolume: FULL_VOL, isBossMap: false });
    expect(boss.volume).toBe(flat.volume);
  });
});

describe('adjustSoundParams — stereo separation', () => {
  it('source directly ahead (east) of east-facing listener yields sep = 129 (vanilla off-by-one quirk)', () => {
    const r = call({
      listener: { x: 0, y: 0, angle: 0 },
      source: { x: FRACUNIT, y: 0 },
    });
    expect(r.separation).toBe(129);
  });

  it('source directly north (left of east-facing listener) yields sep = 33 (near MIN_STEREO_SEP)', () => {
    const r = call({
      listener: { x: 0, y: 0, angle: 0 },
      source: { x: 0, y: FRACUNIT },
    });
    expect(r.separation).toBe(33);
  });

  it('source directly south (right of east-facing listener) yields sep = 224 (MAX_STEREO_SEP)', () => {
    const r = call({
      listener: { x: 0, y: 0, angle: 0 },
      source: { x: 0, y: -FRACUNIT },
    });
    expect(r.separation).toBe(MAX_STEREO_SEP);
  });

  it('source directly behind (west of east-facing listener) yields sep = 128 (NORM_SEP)', () => {
    const r = call({
      listener: { x: 0, y: 0, angle: 0 },
      source: { x: -FRACUNIT, y: 0 },
    });
    expect(r.separation).toBe(NORM_SEP);
  });

  it('separation is always within [MIN_STEREO_SEP, MAX_STEREO_SEP] for cardinal directions', () => {
    const directions: Array<{ x: number; y: number }> = [
      { x: FRACUNIT, y: 0 },
      { x: 0, y: FRACUNIT },
      { x: -FRACUNIT, y: 0 },
      { x: 0, y: -FRACUNIT },
    ];
    for (const source of directions) {
      const r = call({ source });
      expect(r.separation).toBeGreaterThanOrEqual(MIN_STEREO_SEP);
      expect(r.separation).toBeLessThanOrEqual(MAX_STEREO_SEP);
    }
  });

  it('separation is within [MIN_STEREO_SEP, MAX_STEREO_SEP] for a 16-point angular sweep', () => {
    const r = 10 * FRACUNIT;
    for (let i = 0; i < 16; i++) {
      const theta = (i / 16) * Math.PI * 2;
      const source = { x: Math.round(Math.cos(theta) * r), y: Math.round(Math.sin(theta) * r) };
      const result = call({ source });
      expect(result.separation).toBeGreaterThanOrEqual(MIN_STEREO_SEP);
      expect(result.separation).toBeLessThanOrEqual(MAX_STEREO_SEP);
    }
  });

  it('rotation invariance: listener facing north with source east matches listener facing east with source south', () => {
    const facingNorthSrcEast = call({
      listener: { x: 0, y: 0, angle: ANG90 },
      source: { x: FRACUNIT, y: 0 },
    });
    const facingEastSrcSouth = call({
      listener: { x: 0, y: 0, angle: 0 },
      source: { x: 0, y: -FRACUNIT },
    });
    expect(facingNorthSrcEast.separation).toBe(facingEastSrcSouth.separation);
  });

  it('listener facing south (ANG180): source west of listener (behind of facing east) is ahead of facing south', () => {
    const r = call({
      listener: { x: 0, y: 0, angle: ANG180 },
      source: { x: -FRACUNIT, y: 0 },
    });
    expect(r.separation).toBe(129);
  });

  it('listener facing west (ANG180): source north of listener appears on the right of facing west', () => {
    const ahead = call({
      listener: { x: 0, y: 0, angle: ANG180 },
      source: { x: -FRACUNIT, y: 0 },
    });
    const northOfWestFacing = call({
      listener: { x: 0, y: 0, angle: ANG180 },
      source: { x: 0, y: FRACUNIT },
    });
    expect(northOfWestFacing.separation).not.toBe(ahead.separation);
    expect(northOfWestFacing.separation).toBe(MAX_STEREO_SEP);
  });

  it('same-position source with listener.angle=0 produces relAngle=0xffffffff (off-by-one): sep=129', () => {
    const r = call({
      listener: { x: 0, y: 0, angle: 0 },
      source: { x: 0, y: 0 },
    });
    expect(r.separation).toBe(129);
  });

  it('same-position source with listener.angle=ANG90 rotates the off-by-one wrap into fineIdx=6143 (sep=224)', () => {
    const r = call({
      listener: { x: 0, y: 0, angle: ANG90 },
      source: { x: 0, y: 0 },
    });
    expect(r.separation).toBe(MAX_STEREO_SEP);
  });

  it('separation respects listener angle rotation: ANG270-facing listener sees east source as ahead', () => {
    const eastFacingSrcNorth = call({
      listener: { x: 0, y: 0, angle: 0 },
      source: { x: 0, y: FRACUNIT },
    });
    const sameRelativePos = call({
      listener: { x: 0, y: 0, angle: ANG270 },
      source: { x: FRACUNIT, y: 0 },
    });
    expect(sameRelativePos.separation).toBe(eastFacingSrcNorth.separation);
  });
});

describe('adjustSoundParams — combined behaviour', () => {
  it('non-boss distant source returns silent result with sep defaulted to NORM_SEP', () => {
    const r = call({
      source: { x: S_CLIPPING_DIST + 100 * FRACUNIT, y: S_CLIPPING_DIST },
      sfxVolume: FULL_VOL,
    });
    expect(r).toEqual({ audible: false, volume: 0, separation: NORM_SEP });
  });

  it('boss map distant source returns vol=15 and computes a non-trivial sep', () => {
    const r = call({
      source: { x: S_CLIPPING_DIST + 100 * FRACUNIT, y: 0 },
      sfxVolume: FULL_VOL,
      isBossMap: true,
    });
    expect(r.volume).toBe(BOSS_MAP_MIN_VOLUME);
    expect(r.audible).toBe(true);
    expect(r.separation).toBe(129);
  });

  it('close source at sfxVolume=1 is audible (vol=1 > 0)', () => {
    const r = call({ source: { x: FRACUNIT, y: 0 }, sfxVolume: 1 });
    expect(r.volume).toBe(1);
    expect(r.audible).toBe(true);
  });

  it('linear ramp with sfxVolume=1 produces 0 at any dist >= S_CLOSE_DIST (trunc)', () => {
    const r = call({ source: { x: S_CLOSE_DIST, y: 0 }, sfxVolume: 1 });
    expect(r.volume).toBe(1);
    const r2 = call({ source: { x: MIDWAY_DIST, y: 0 }, sfxVolume: 1 });
    expect(r2.volume).toBe(0);
  });

  it('result is a fresh object each call (no shared state)', () => {
    const a = call();
    const b = call();
    expect(a).not.toBe(b);
  });
});
