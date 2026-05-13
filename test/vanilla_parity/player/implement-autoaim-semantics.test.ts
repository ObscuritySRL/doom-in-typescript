import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { VANILLA_AUTOAIM_ANGLE_SEQUENCE, VANILLA_AUTOAIM_CONE_SHIFT_BAM, VANILLA_BULLET_AIM_RANGE } from '../../../src/player/implement-autoaim-semantics.ts';

describe('vanilla P_BulletSlope constants', () => {
  test('bullet aim range is 16 * MELEERANGE = 16 * 64 * FRACUNIT', () => {
    expect(VANILLA_BULLET_AIM_RANGE).toBe(16 * 64 * FRACUNIT);
  });

  test('autoaim cone shift is 1 << 26 (BAM)', () => {
    expect(VANILLA_AUTOAIM_CONE_SHIFT_BAM).toBe(1 << 26);
  });
});

describe('autoaim angle sequence order', () => {
  test('three offsets in order: 0, +cone, -cone', () => {
    expect(VANILLA_AUTOAIM_ANGLE_SEQUENCE.length).toBe(3);
    expect(VANILLA_AUTOAIM_ANGLE_SEQUENCE[0]!.bamOffset).toBe(0);
    expect(VANILLA_AUTOAIM_ANGLE_SEQUENCE[1]!.bamOffset).toBe(VANILLA_AUTOAIM_CONE_SHIFT_BAM);
    expect(VANILLA_AUTOAIM_ANGLE_SEQUENCE[2]!.bamOffset).toBe(-VANILLA_AUTOAIM_CONE_SHIFT_BAM);
  });

  test('each entry has a description', () => {
    for (const entry of VANILLA_AUTOAIM_ANGLE_SEQUENCE) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});
