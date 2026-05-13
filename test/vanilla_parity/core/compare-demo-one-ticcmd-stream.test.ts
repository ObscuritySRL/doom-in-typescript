import { describe, expect, test } from 'bun:test';

import { VANILLA_DEMO1_EXPECTED_EPISODE, VANILLA_DEMO1_EXPECTED_MAP, VANILLA_DEMO1_EXPECTED_VERSION, compareDemo1 } from '../../../src/demo/compare-demo-one-ticcmd-stream.ts';

function buildCanonicalDemo1(): Uint8Array {
  const header = [VANILLA_DEMO1_EXPECTED_VERSION, 2, VANILLA_DEMO1_EXPECTED_EPISODE, VANILLA_DEMO1_EXPECTED_MAP, 0, 0, 0, 0, 0, 1, 0, 0, 0];
  const ticcmds = [0, 0, 0, 0, 5, 0, 0, 0];
  const terminator = [0x80];
  return new Uint8Array([...header, ...ticcmds, ...terminator]);
}

describe('vanilla DEMO1 expected metadata', () => {
  test('DEMO1 targets E1M5 at version 109', () => {
    expect(VANILLA_DEMO1_EXPECTED_VERSION).toBe(109);
    expect(VANILLA_DEMO1_EXPECTED_EPISODE).toBe(1);
    expect(VANILLA_DEMO1_EXPECTED_MAP).toBe(5);
  });
});

describe('compareDemo1', () => {
  test('accepts a canonical 2-ticcmd DEMO1 with the right header', () => {
    const bytes = buildCanonicalDemo1();
    const decision = compareDemo1({ demoBytes: bytes, expectedTicCount: 2 });
    expect(decision.accepted).toBe(true);
    expect(decision.observedTicCount).toBe(2);
    expect(decision.violations).toEqual([]);
  });

  test('flags wrong_episode when episode != 1', () => {
    const bytes = buildCanonicalDemo1();
    bytes[2] = 2;
    const decision = compareDemo1({ demoBytes: bytes, expectedTicCount: null });
    expect(decision.violations).toContain('wrong_episode');
  });

  test('flags wrong_map when map != 5', () => {
    const bytes = buildCanonicalDemo1();
    bytes[3] = 1;
    const decision = compareDemo1({ demoBytes: bytes, expectedTicCount: null });
    expect(decision.violations).toContain('wrong_map');
  });

  test('flags missing_terminator when stream lacks 0x80', () => {
    const bytes = new Uint8Array([VANILLA_DEMO1_EXPECTED_VERSION, 2, 1, 5, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    const decision = compareDemo1({ demoBytes: bytes, expectedTicCount: null });
    expect(decision.violations).toContain('missing_terminator');
  });

  test('flags tic_count_mismatch when expected count differs', () => {
    const bytes = buildCanonicalDemo1();
    const decision = compareDemo1({ demoBytes: bytes, expectedTicCount: 99 });
    expect(decision.violations).toContain('tic_count_mismatch');
  });

  test('flags header_parse_failed on too-short input', () => {
    const decision = compareDemo1({ demoBytes: new Uint8Array(5), expectedTicCount: null });
    expect(decision.violations).toContain('header_parse_failed');
  });
});
