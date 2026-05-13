import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { LINE_TRIGGER_GROUP_NAMES, LINE_TRIGGER_REPEAT_NAMES, VANILLA_MELEERANGE_FIXED, VANILLA_USERANGE_FIXED, projectVanillaUseLine } from '../../../src/world/gate-line-use-and-trigger-collision.ts';

describe('gate: line use and trigger collision', () => {
  test('USERANGE = 64 map units in fixed-point', () => {
    expect(VANILLA_USERANGE_FIXED).toBe(64 << FRACBITS);
  });

  test('MELEERANGE = 64 map units in fixed-point (matches USERANGE)', () => {
    expect(VANILLA_MELEERANGE_FIXED).toBe(64 << FRACBITS);
  });

  test('trigger groups cover walk/push/gun/switch', () => {
    expect([...LINE_TRIGGER_GROUP_NAMES]).toEqual(['walk', 'push', 'gun', 'switch']);
  });

  test('trigger repeat covers once and repeatable', () => {
    expect([...LINE_TRIGGER_REPEAT_NAMES]).toEqual(['once', 'repeatable']);
  });

  test('projectVanillaUseLine returns the pinned range with caller-supplied group/repeat', () => {
    const projection = projectVanillaUseLine('walk', 'repeatable');
    expect(projection.rangeFixed).toBe(VANILLA_USERANGE_FIXED);
    expect(projection.group).toBe('walk');
    expect(projection.repeat).toBe('repeatable');
  });
});
