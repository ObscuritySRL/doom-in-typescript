import { describe, expect, test } from 'bun:test';

import { VANILLA_MAXINTERCEPTS, sortAndCapIntercepts } from '../../../src/map/implement-intercept-ordering.ts';

describe('vanilla intercept ordering', () => {
  test('MAXINTERCEPTS is 128', () => {
    expect(VANILLA_MAXINTERCEPTS).toBe(128);
  });

  test('sorts ascending by frac, stable for ties', () => {
    const result = sortAndCapIntercepts([
      { frac: 0.3, kind: 'line', referenceId: 1, insertionOrder: 0 },
      { frac: 0.1, kind: 'thing', referenceId: 2, insertionOrder: 1 },
      { frac: 0.3, kind: 'line', referenceId: 3, insertionOrder: 2 },
    ]);
    expect(result.sorted.map((record) => record.referenceId)).toEqual([2, 1, 3]);
    expect(result.truncatedAtCap).toBe(false);
  });

  test('truncates at the cap', () => {
    const unsorted = Array.from({ length: 200 }, (_unused, index) => ({ frac: index / 200, kind: 'line' as const, referenceId: index, insertionOrder: index }));
    const result = sortAndCapIntercepts(unsorted);
    expect(result.sorted).toHaveLength(VANILLA_MAXINTERCEPTS);
    expect(result.truncatedAtCap).toBe(true);
  });
});
