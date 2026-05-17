import { describe, expect, test } from 'bun:test';

import type { VanillaAnimDef } from '../../src/ai/implement-animated-flats-and-textures.ts';
import { makeFlatAnimation } from '../../src/render/assembledFlatAnimation.ts';

// Synthetic flat numbering: NUKAGE1..3 = 10..12, FWATER1..4 = 20..23.
// LAVA/BLOOD absent (flatExists false) → those animdefs skipped.
const NUMS = new Map<string, number>([
  ['NUKAGE1', 10],
  ['NUKAGE2', 11],
  ['NUKAGE3', 12],
  ['FWATER1', 20],
  ['FWATER2', 21],
  ['FWATER3', 22],
  ['FWATER4', 23],
]);
const flatNumber = (name: string): number => {
  const n = NUMS.get(name);
  if (n === undefined) {
    throw new Error(`R_FlatNumForName: ${name} not found`);
  }
  return n;
};
const flatExists = (name: string): boolean => NUMS.has(name);

describe('assembledFlatAnimation: P_InitPicAnims + P_UpdateSpecials flattranslation', () => {
  const xlate = makeFlatAnimation(flatNumber, flatExists);

  test('cycles a flat in its animdef: basepic + ((leveltime/speed + i) % numpics)', () => {
    // NUKAGE: basepic 10, numpics 3, speed 8.
    expect(xlate(10, 0)).toBe(10 + ((0 + 10) % 3)); // 10 + 1 = 11
    expect(xlate(11, 0)).toBe(10 + ((0 + 11) % 3)); // 10 + 2 = 12
    expect(xlate(12, 0)).toBe(10 + ((0 + 12) % 3)); // 10 + 0 = 10
    // leveltime 8 → leveltime/speed = 1.
    expect(xlate(10, 8)).toBe(10 + ((1 + 10) % 3)); // 10 + 2 = 12
    // Integer division: leveltime 7 → 7/8 = 0 (same as tic 0).
    expect(xlate(10, 7)).toBe(xlate(10, 0));
    // FWATER: basepic 20, numpics 4.
    expect(xlate(20, 0)).toBe(20 + ((0 + 20) % 4)); // 20 + 0 = 20
    expect(xlate(23, 16)).toBe(20 + ((2 + 23) % 4)); // 20 + 1 = 21
  });

  test('a flat outside every cycle keeps identity translation', () => {
    expect(xlate(99, 0)).toBe(99);
    expect(xlate(99, 1000)).toBe(99);
    expect(xlate(13, 8)).toBe(13); // just past NUKAGE3
    expect(xlate(9, 8)).toBe(9); // just before NUKAGE1
  });

  test('animdefs whose start flat is absent are skipped (W_CheckNumForName == -1)', () => {
    // LAVA1/BLOOD1 are not in NUMS → those VANILLA_FLAT_ANIMS entries
    // were skipped, so a would-be LAVA flat number is untouched.
    expect(xlate(500, 0)).toBe(500);
  });

  test('numpics < 2 is a P_InitPicAnims I_Error', () => {
    const badDefs: readonly VanillaAnimDef[] = [Object.freeze({ startName: 'NUKAGE1', endName: 'NUKAGE1', isTexture: false, tics: 8 })];
    expect(() => makeFlatAnimation(flatNumber, flatExists, badDefs)).toThrow('P_InitPicAnims: bad cycle from NUKAGE1 to NUKAGE1');
  });

  test('texture animdefs are ignored (flat translation only)', () => {
    const texDefs: readonly VanillaAnimDef[] = [Object.freeze({ startName: 'FOO', endName: 'BAR', isTexture: true, tics: 8 })];
    const onlyTex = makeFlatAnimation(flatNumber, flatExists, texDefs);
    expect(onlyTex(10, 0)).toBe(10); // no flat anims → identity everywhere
  });

  test('is deterministic for a given (picnum, leveltime)', () => {
    expect(xlate(11, 24)).toBe(xlate(11, 24));
    expect(xlate(22, 100)).toBe(xlate(22, 100));
  });
});
