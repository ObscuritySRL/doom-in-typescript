import { describe, expect, test } from 'bun:test';

import { VANILLA_DEMO2_EXPECTED_EPISODE, VANILLA_DEMO2_EXPECTED_VERSION, compareDemo2 } from '../../../src/demo/compare-demo-two-ticcmd-stream.ts';

function buildCanonicalDemo2(): Uint8Array {
  return new Uint8Array([VANILLA_DEMO2_EXPECTED_VERSION, 2, VANILLA_DEMO2_EXPECTED_EPISODE, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0x80]);
}

describe('vanilla DEMO2 comparator', () => {
  test('DEMO2 expected version 109, episode 1', () => {
    expect(VANILLA_DEMO2_EXPECTED_VERSION).toBe(109);
    expect(VANILLA_DEMO2_EXPECTED_EPISODE).toBe(1);
  });

  test('accepts a canonical DEMO2 with version 109, episode 1', () => {
    const decision = compareDemo2({ demoBytes: buildCanonicalDemo2(), expectedTicCount: 2 });
    expect(decision.accepted).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags wrong_episode for non-episode-1 demo', () => {
    const bytes = buildCanonicalDemo2();
    bytes[2] = 2;
    expect(compareDemo2({ demoBytes: bytes, expectedTicCount: null }).violations).toContain('wrong_episode');
  });

  test('flags wrong_version when first byte is not 109', () => {
    const bytes = buildCanonicalDemo2();
    bytes[0] = 110;
    expect(compareDemo2({ demoBytes: bytes, expectedTicCount: null }).violations).toContain('wrong_version');
  });

  test('flags tic_count_mismatch when expected count differs', () => {
    expect(compareDemo2({ demoBytes: buildCanonicalDemo2(), expectedTicCount: 99 }).violations).toContain('tic_count_mismatch');
  });
});
