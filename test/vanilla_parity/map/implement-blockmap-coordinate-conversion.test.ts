import { describe, expect, test } from 'bun:test';

import { VANILLA_BLOCKMAP_OUT_OF_RANGE, VANILLA_MAPBLOCKUNITS, blockmapCellLinearIndex, pointToBlockmapCell } from '../../../src/map/implement-blockmap-coordinate-conversion.ts';

const header = { originX: -512, originY: -512, columns: 8, rows: 8 };

describe('vanilla blockmap constants', () => {
  test('128-unit cells; -1 out-of-range sentinel', () => {
    expect(VANILLA_MAPBLOCKUNITS).toBe(128);
    expect(VANILLA_BLOCKMAP_OUT_OF_RANGE).toBe(-1);
  });
});

describe('pointToBlockmapCell', () => {
  test('point at origin lands in (0, 0)', () => {
    const cell = pointToBlockmapCell(header, -512, -512);
    expect(cell).toEqual({ column: 0, row: 0, inRange: true });
  });

  test('cell rolls over at 128-unit boundaries', () => {
    expect(pointToBlockmapCell(header, -512 + 128, -512)).toEqual({ column: 1, row: 0, inRange: true });
    expect(pointToBlockmapCell(header, -512, -512 + 256)).toEqual({ column: 0, row: 2, inRange: true });
  });

  test('out-of-range columns/rows are reported', () => {
    expect(pointToBlockmapCell(header, -1024, -512).inRange).toBe(false);
    expect(pointToBlockmapCell(header, -512 + 8 * 128, -512).inRange).toBe(false);
  });
});

describe('blockmapCellLinearIndex', () => {
  test('row-major linear index for in-range cell', () => {
    expect(blockmapCellLinearIndex(header, 3, 2)).toBe(2 * 8 + 3);
  });

  test('out-of-range index returns -1', () => {
    expect(blockmapCellLinearIndex(header, 8, 0)).toBe(-1);
    expect(blockmapCellLinearIndex(header, 0, 8)).toBe(-1);
    expect(blockmapCellLinearIndex(header, -1, 0)).toBe(-1);
  });
});
