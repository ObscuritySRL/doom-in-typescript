import { describe, expect, test } from 'bun:test';

import { detectLongRunDrift } from '../../../src/core/detect-long-run-drift.ts';

describe('detectLongRunDrift', () => {
  test('identical streams report no drift', () => {
    const hashes = ['a', 'b', 'c'];
    const decision = detectLongRunDrift({ observedHashes: hashes, expectedHashes: hashes });
    expect(decision.drifted).toBe(false);
    expect(decision.firstDivergentTic).toBeNull();
  });

  test('flags first_divergence at the first mismatch tic', () => {
    const decision = detectLongRunDrift({ observedHashes: ['a', 'b', 'X'], expectedHashes: ['a', 'b', 'c'] });
    expect(decision.drifted).toBe(true);
    expect(decision.firstDivergentTic).toBe(2);
    expect(decision.kinds).toContain('first_divergence');
  });

  test('flags length_mismatch when streams differ in length', () => {
    const decision = detectLongRunDrift({ observedHashes: ['a', 'b'], expectedHashes: ['a', 'b', 'c'] });
    expect(decision.drifted).toBe(true);
    expect(decision.kinds).toContain('length_mismatch');
  });

  test('combines length_mismatch and first_divergence when both occur', () => {
    const decision = detectLongRunDrift({ observedHashes: ['a', 'X'], expectedHashes: ['a', 'b', 'c'] });
    expect(decision.kinds).toContain('length_mismatch');
    expect(decision.kinds).toContain('first_divergence');
    expect(decision.firstDivergentTic).toBe(1);
  });

  test('empty streams are not considered drift', () => {
    const decision = detectLongRunDrift({ observedHashes: [], expectedHashes: [] });
    expect(decision.drifted).toBe(false);
    expect(decision.kinds).toContain('empty_streams');
  });
});
