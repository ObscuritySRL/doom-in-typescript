import { describe, expect, test } from 'bun:test';

import { computeBlockLinkSet } from '../../../src/map/implement-block-things-linking.ts';

const header = { originX: 0, originY: 0, columns: 4, rows: 4 };

describe('computeBlockLinkSet', () => {
  test('groups things by linear cell index', () => {
    const links = computeBlockLinkSet(header, [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 0, y: 0 },
      { id: 3, x: 128, y: 0 },
    ]);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ cellIndex: 0, memberIds: [1, 2] });
    expect(links[1]).toEqual({ cellIndex: 1, memberIds: [3] });
  });

  test('out-of-range things are skipped', () => {
    const links = computeBlockLinkSet(header, [{ id: 1, x: -1, y: 0 }]);
    expect(links).toEqual([]);
  });

  test('empty input yields empty link set', () => {
    expect(computeBlockLinkSet(header, [])).toEqual([]);
  });
});
