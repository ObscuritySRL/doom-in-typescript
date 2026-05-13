import { describe, expect, test } from 'bun:test';

import {
  VANILLA_NUMBONUSPALS,
  VANILLA_NUMREDPALS,
  VANILLA_PLAYPAL_BYTES_PER_PALETTE,
  VANILLA_PLAYPAL_TOTAL_PALETTES,
  VANILLA_RADIATIONPAL,
  VANILLA_STARTBONUSPALS,
  VANILLA_STARTREDPALS,
  selectVanillaPlayerPaletteIndex,
} from '../../../src/render/implement-extra-light-and-palette-effects.ts';

describe('palette constants', () => {
  test('NUMREDPALS=8, NUMBONUSPALS=4', () => {
    expect(VANILLA_NUMREDPALS).toBe(8);
    expect(VANILLA_NUMBONUSPALS).toBe(4);
  });

  test('STARTREDPALS=1, STARTBONUSPALS=9, RADIATIONPAL=13', () => {
    expect(VANILLA_STARTREDPALS).toBe(1);
    expect(VANILLA_STARTBONUSPALS).toBe(9);
    expect(VANILLA_RADIATIONPAL).toBe(13);
  });

  test('14 total palettes, 768 bytes per palette', () => {
    expect(VANILLA_PLAYPAL_TOTAL_PALETTES).toBe(14);
    expect(VANILLA_PLAYPAL_BYTES_PER_PALETTE).toBe(768);
  });
});

describe('selectVanillaPlayerPaletteIndex — no effects', () => {
  test('returns 0 when no effects active', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 0, bonuscount: 0, powersStrength: 0, powersIronfeet: 0 })).toBe(0);
  });
});

describe('selectVanillaPlayerPaletteIndex — damage', () => {
  test('damagecount 1 -> (1+7)>>3 + 1 = palette 2', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 1, bonuscount: 0, powersStrength: 0, powersIronfeet: 0 })).toBe(2);
  });

  test('damagecount 8 -> (8+7)>>3 + 1 = palette 2', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 8, bonuscount: 0, powersStrength: 0, powersIronfeet: 0 })).toBe(2);
  });

  test('damagecount 100 clamps to NUMREDPALS-1 + STARTREDPALS = 7+1 = 8', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 100, bonuscount: 0, powersStrength: 0, powersIronfeet: 0 })).toBe(8);
  });
});

describe('selectVanillaPlayerPaletteIndex — berserk strength boost', () => {
  test('powersStrength = 1 yields bzc = 12 -> (12+7)>>3 = 2, clamped within NUMREDPALS, + STARTREDPALS = 3', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 0, bonuscount: 0, powersStrength: 1, powersIronfeet: 0 })).toBe(3);
  });

  test('strength bzc decreases as power tics rise (32 << 6 = 2048 -> bzc=12-32=-20, never triggers)', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 0, bonuscount: 0, powersStrength: 32 << 6, powersIronfeet: 0 })).toBe(0);
  });

  test('damage takes precedence over berserk when higher', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 100, bonuscount: 0, powersStrength: 1, powersIronfeet: 0 })).toBe(8);
  });
});

describe('selectVanillaPlayerPaletteIndex — bonus', () => {
  test('bonuscount 1 -> (1+7)>>3 + 9 = palette 10', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 0, bonuscount: 1, powersStrength: 0, powersIronfeet: 0 })).toBe(10);
  });

  test('bonuscount 100 clamps to NUMBONUSPALS-1 + STARTBONUSPALS = 3+9 = 12', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 0, bonuscount: 100, powersStrength: 0, powersIronfeet: 0 })).toBe(12);
  });

  test('damage takes precedence over bonus', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 5, bonuscount: 100, powersStrength: 0, powersIronfeet: 0 })).toBe(2);
  });
});

describe('selectVanillaPlayerPaletteIndex — radiation', () => {
  test('powersIronfeet > 128 yields RADIATIONPAL', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 0, bonuscount: 0, powersStrength: 0, powersIronfeet: 200 })).toBe(13);
  });

  test('powersIronfeet with bit 8 set (blink phase) yields RADIATIONPAL', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 0, bonuscount: 0, powersStrength: 0, powersIronfeet: 8 })).toBe(13);
  });

  test('damage takes precedence over radiation', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 5, bonuscount: 0, powersStrength: 0, powersIronfeet: 200 })).toBe(2);
  });

  test('bonus takes precedence over radiation', () => {
    expect(selectVanillaPlayerPaletteIndex({ damagecount: 0, bonuscount: 5, powersStrength: 0, powersIronfeet: 200 })).toBe(10);
  });
});
