import { describe, expect, test } from 'bun:test';

import { VANILLA_THINKER_INSERTION_POSITION, VANILLA_THINKER_REMOVED_SENTINEL, VANILLA_THINKER_TRAVERSAL_DIRECTION, compactRemovedThinkers, iterateVanillaThinkers } from '../../../src/ai/implement-thinker-list-ordering.ts';

describe('vanilla P_RunThinkers semantics', () => {
  test('removed sentinel is -1 (function pointer cast)', () => {
    expect(VANILLA_THINKER_REMOVED_SENTINEL).toBe(-1);
  });

  test('traversal direction is forward (head to tail)', () => {
    expect(VANILLA_THINKER_TRAVERSAL_DIRECTION).toBe('forward');
  });

  test('new thinkers are inserted at the tail (queue order)', () => {
    expect(VANILLA_THINKER_INSERTION_POSITION).toBe('tail');
  });
});

describe('iterateVanillaThinkers', () => {
  test('returns thinker ids in list order, skipping removed', () => {
    const result = iterateVanillaThinkers({
      entries: [
        { id: 'a', removed: false },
        { id: 'b', removed: true },
        { id: 'c', removed: false },
      ],
    });
    expect([...result]).toEqual(['a', 'c']);
  });

  test('empty list returns empty', () => {
    expect([...iterateVanillaThinkers({ entries: [] })]).toEqual([]);
  });
});

describe('compactRemovedThinkers', () => {
  test('drops removed entries and preserves order', () => {
    const result = compactRemovedThinkers({
      entries: [
        { id: 'a', removed: false },
        { id: 'b', removed: true },
        { id: 'c', removed: false },
        { id: 'd', removed: true },
      ],
    });
    expect(result.entries.map((entry) => entry.id)).toEqual(['a', 'c']);
  });
});
