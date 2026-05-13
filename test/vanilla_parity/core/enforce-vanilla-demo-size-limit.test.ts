import { describe, expect, test } from 'bun:test';

import { VANILLA_DEMO_BYTE_LIMIT, VANILLA_DEMO_LIMIT_FLAG_VALUE_ENFORCED, VANILLA_DEMO_LIMIT_FLAG_VALUE_RELAXED, evaluateDemoSize } from '../../../src/core/enforce-vanilla-demo-size-limit.ts';

describe('vanilla demo size limit contract', () => {
  test('byte limit is 128 KiB (0x20000 = 131072)', () => {
    expect(VANILLA_DEMO_BYTE_LIMIT).toBe(0x20000);
    expect(VANILLA_DEMO_BYTE_LIMIT).toBe(131_072);
  });

  test('flag values: 1 enforces, 0 relaxes', () => {
    expect(VANILLA_DEMO_LIMIT_FLAG_VALUE_ENFORCED).toBe(1);
    expect(VANILLA_DEMO_LIMIT_FLAG_VALUE_RELAXED).toBe(0);
  });
});

describe('evaluateDemoSize', () => {
  test('within-limit when bytes < 131072 and flag enforced', () => {
    expect(evaluateDemoSize({ recordedBytes: 1000, vanillaDemoLimitFlag: 1 })).toBe('within-limit');
  });

  test('truncated-at-limit when bytes >= 131072 and flag enforced', () => {
    expect(evaluateDemoSize({ recordedBytes: 131_072, vanillaDemoLimitFlag: 1 })).toBe('truncated-at-limit');
    expect(evaluateDemoSize({ recordedBytes: 200_000, vanillaDemoLimitFlag: 1 })).toBe('truncated-at-limit');
  });

  test('within-limit when bytes <= 131072 and flag relaxed', () => {
    expect(evaluateDemoSize({ recordedBytes: 131_072, vanillaDemoLimitFlag: 0 })).toBe('within-limit');
  });

  test('over-limit-but-relaxed when bytes > 131072 and flag relaxed', () => {
    expect(evaluateDemoSize({ recordedBytes: 200_000, vanillaDemoLimitFlag: 0 })).toBe('over-limit-but-relaxed');
  });
});
