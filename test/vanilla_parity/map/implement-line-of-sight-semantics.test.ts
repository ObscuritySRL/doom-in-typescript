import { describe, expect, test } from 'bun:test';

import { evaluateSightTrace } from '../../../src/map/implement-line-of-sight-semantics.ts';

describe('evaluateSightTrace', () => {
  test('no crossings means clear sight', () => {
    expect(evaluateSightTrace({ source: { z: 0 }, target: { z: 0 }, crossings: [] })).toBe(true);
  });

  test('single-sided line blocks sight', () => {
    const result = evaluateSightTrace({ source: { z: 0 }, target: { z: 0 }, crossings: [{ frac: 0.5, isTwoSided: false, openTop: 0, openBottom: 0 }] });
    expect(result).toBe(false);
  });

  test('two-sided line with sight ray inside opening allows sight', () => {
    const result = evaluateSightTrace({ source: { z: 40 }, target: { z: 40 }, crossings: [{ frac: 0.5, isTwoSided: true, openTop: 100, openBottom: 0 }] });
    expect(result).toBe(true);
  });

  test('two-sided line with ray above opentop blocks sight', () => {
    const result = evaluateSightTrace({ source: { z: 200 }, target: { z: 200 }, crossings: [{ frac: 0.5, isTwoSided: true, openTop: 100, openBottom: 0 }] });
    expect(result).toBe(false);
  });

  test('two-sided line with ray below openbottom blocks sight', () => {
    const result = evaluateSightTrace({ source: { z: -10 }, target: { z: -10 }, crossings: [{ frac: 0.5, isTwoSided: true, openTop: 100, openBottom: 0 }] });
    expect(result).toBe(false);
  });
});
