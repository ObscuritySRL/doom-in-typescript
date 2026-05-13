import { describe, expect, test } from 'bun:test';

import { VANILLA_ANGLETOFINESHIFT, VANILLA_PLAYER_FRICTION, VANILLA_PLAYER_STOPSPEED, angleToFineIndex, applyVanillaPlayerFriction } from '../../../src/player/implement-player-thrust-and-friction.ts';

describe('vanilla player thrust + friction constants', () => {
  test('FRICTION is 0xE800 (per p_mobj.c)', () => {
    expect(VANILLA_PLAYER_FRICTION).toBe(0xe800);
  });

  test('STOPSPEED is 0x1000 (per p_mobj.c)', () => {
    expect(VANILLA_PLAYER_STOPSPEED).toBe(0x1000);
  });

  test('ANGLETOFINESHIFT is 19 (32-bit BAM -> 8192 finecosine table)', () => {
    expect(VANILLA_ANGLETOFINESHIFT).toBe(19);
  });
});

describe('angleToFineIndex', () => {
  test('zero angle maps to fine index 0', () => {
    expect(angleToFineIndex(0)).toBe(0);
  });

  test('full 32-bit angle (-1 >>> 0) maps to fine index 8191', () => {
    expect(angleToFineIndex(0xffffffff)).toBe(8191);
  });

  test('mid-range angles preserve top 13 bits', () => {
    const angle = 1 << 19;
    expect(angleToFineIndex(angle)).toBe(1);
  });
});

describe('applyVanillaPlayerFriction', () => {
  test('momentum within +/- STOPSPEED clamps to zero', () => {
    expect(applyVanillaPlayerFriction(0)).toBe(0);
    expect(applyVanillaPlayerFriction(0x800)).toBe(0);
    expect(applyVanillaPlayerFriction(-0x800)).toBe(0);
  });

  test('momentum exactly at STOPSPEED triggers friction multiply (not snapped to 0)', () => {
    const result = applyVanillaPlayerFriction(VANILLA_PLAYER_STOPSPEED);
    expect(result).not.toBe(0);
  });

  test('momentum above STOPSPEED is scaled by FRICTION (about 0.90625)', () => {
    const result = applyVanillaPlayerFriction(0x10000);
    expect(result).toBe(Math.imul(0x10000, 0xe800) >> 16);
  });

  test('negative momentum above |STOPSPEED| also scales by FRICTION', () => {
    const result = applyVanillaPlayerFriction(-0x10000);
    expect(result).toBe(Math.imul(-0x10000, 0xe800) >> 16);
  });
});
