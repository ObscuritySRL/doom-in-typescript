import { describe, expect, test } from 'bun:test';

import { VANILLA_DEMO3_EXPECTED_EPISODE, VANILLA_DEMO3_EXPECTED_VERSION, compareDemo3 } from '../../../src/demo/compare-demo-three-ticcmd-stream.ts';

function buildCanonicalDemo3(): Uint8Array {
  return new Uint8Array([VANILLA_DEMO3_EXPECTED_VERSION, 2, VANILLA_DEMO3_EXPECTED_EPISODE, 3, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0x80]);
}

describe('vanilla DEMO3 comparator', () => {
  test('DEMO3 expected version 109, episode 1', () => {
    expect(VANILLA_DEMO3_EXPECTED_VERSION).toBe(109);
    expect(VANILLA_DEMO3_EXPECTED_EPISODE).toBe(1);
  });

  test('accepts a canonical DEMO3 with version 109, episode 1', () => {
    const decision = compareDemo3({ demoBytes: buildCanonicalDemo3(), expectedTicCount: 2 });
    expect(decision.accepted).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags wrong_episode for non-episode-1 demo', () => {
    const bytes = buildCanonicalDemo3();
    bytes[2] = 2;
    expect(compareDemo3({ demoBytes: bytes, expectedTicCount: null }).violations).toContain('wrong_episode');
  });

  test('flags wrong_version when first byte is not 109', () => {
    const bytes = buildCanonicalDemo3();
    bytes[0] = 110;
    expect(compareDemo3({ demoBytes: bytes, expectedTicCount: null }).violations).toContain('wrong_version');
  });

  test('flags tic_count_mismatch when expected count differs', () => {
    expect(compareDemo3({ demoBytes: buildCanonicalDemo3(), expectedTicCount: 99 }).violations).toContain('tic_count_mismatch');
  });
});
