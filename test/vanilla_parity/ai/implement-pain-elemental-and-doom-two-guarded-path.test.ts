import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MAX_SOULS_PER_PAIN_ELEMENTAL,
  VANILLA_MT_PAIN,
  VANILLA_PAIN_DIE_ANGLE_INTERVAL_BAM,
  VANILLA_PAIN_DIE_LOST_SOUL_COUNT,
  isPainElementalAllowedInGameMode,
} from '../../../src/ai/implement-pain-elemental-and-doom-two-guarded-path.ts';

describe('vanilla pain elemental constants', () => {
  test('MT_PAIN = 21', () => {
    expect(VANILLA_MT_PAIN).toBe(21);
  });

  test('MAXSOULS per pain elemental = 21', () => {
    expect(VANILLA_MAX_SOULS_PER_PAIN_ELEMENTAL).toBe(21);
  });

  test('pain die spawns 3 lost souls at ANG90 intervals', () => {
    expect(VANILLA_PAIN_DIE_LOST_SOUL_COUNT).toBe(3);
    expect(VANILLA_PAIN_DIE_ANGLE_INTERVAL_BAM).toBe(0x40000000);
  });
});

describe('isPainElementalAllowedInGameMode', () => {
  test('commercial allows pain elemental', () => {
    expect(isPainElementalAllowedInGameMode('commercial')).toBe(true);
  });

  test('shareware, registered, retail do NOT', () => {
    expect(isPainElementalAllowedInGameMode('shareware')).toBe(false);
    expect(isPainElementalAllowedInGameMode('registered')).toBe(false);
    expect(isPainElementalAllowedInGameMode('retail')).toBe(false);
  });
});
