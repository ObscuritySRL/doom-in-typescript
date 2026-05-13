import { describe, expect, test } from 'bun:test';

import {
  VANILLA_LIGHTBRIGHT,
  VANILLA_LIGHTLEVELS,
  VANILLA_LIGHTSCALESHIFT,
  VANILLA_LIGHTSEGSHIFT,
  VANILLA_MAXLIGHTSCALE,
  VANILLA_NUMCOLORMAPS,
  computeVanillaScalelightIndex,
  computeVanillaWallLightLevel,
} from '../../../src/render/implement-light-level-and-colormap-selection.ts';

describe('light level constants', () => {
  test('LIGHTLEVELS=16, LIGHTSEGSHIFT=4 (256/16)', () => {
    expect(VANILLA_LIGHTLEVELS).toBe(16);
    expect(VANILLA_LIGHTSEGSHIFT).toBe(4);
  });

  test('MAXLIGHTSCALE=48, LIGHTSCALESHIFT=12', () => {
    expect(VANILLA_MAXLIGHTSCALE).toBe(48);
    expect(VANILLA_LIGHTSCALESHIFT).toBe(12);
  });

  test('NUMCOLORMAPS=32, LIGHTBRIGHT=1', () => {
    expect(VANILLA_NUMCOLORMAPS).toBe(32);
    expect(VANILLA_LIGHTBRIGHT).toBe(1);
  });
});

describe('computeVanillaWallLightLevel', () => {
  test('diagonal wall: lightnum = sectorLightLevel >> 4 + extralight', () => {
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 128, extralight: 0, wallOrientation: 'diagonal' })).toBe(8);
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 240, extralight: 0, wallOrientation: 'diagonal' })).toBe(15);
  });

  test('horizontal wall (v1.y == v2.y) -> -1 brightness', () => {
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 128, extralight: 0, wallOrientation: 'horizontal' })).toBe(7);
  });

  test('vertical wall (v1.x == v2.x) -> +1 brightness', () => {
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 128, extralight: 0, wallOrientation: 'vertical' })).toBe(9);
  });

  test('extralight adds to lightnum', () => {
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 128, extralight: 3, wallOrientation: 'diagonal' })).toBe(11);
  });

  test('clamps to 0 when below 0', () => {
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 0, extralight: 0, wallOrientation: 'horizontal' })).toBe(0);
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 16, extralight: -5, wallOrientation: 'diagonal' })).toBe(0);
  });

  test('clamps to LIGHTLEVELS-1 when above max', () => {
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 255, extralight: 0, wallOrientation: 'vertical' })).toBe(15);
    expect(computeVanillaWallLightLevel({ sectorLightLevel: 240, extralight: 10, wallOrientation: 'diagonal' })).toBe(15);
  });
});

describe('computeVanillaScalelightIndex', () => {
  test('scale 0 -> index 0', () => {
    expect(computeVanillaScalelightIndex({ rwScale: 0 })).toBe(0);
  });

  test('scale = 1 << 12 -> index 1', () => {
    expect(computeVanillaScalelightIndex({ rwScale: 1 << 12 })).toBe(1);
  });

  test('scale >= 48 << 12 clamps to MAXLIGHTSCALE - 1 = 47', () => {
    expect(computeVanillaScalelightIndex({ rwScale: 48 << 12 })).toBe(47);
    expect(computeVanillaScalelightIndex({ rwScale: 1 << 30 })).toBe(47);
  });

  test('scale 47 << 12 stays at 47', () => {
    expect(computeVanillaScalelightIndex({ rwScale: 47 << 12 })).toBe(47);
  });

  test('negative scale clamps to 0', () => {
    expect(computeVanillaScalelightIndex({ rwScale: -1 })).toBe(0);
  });
});
