import { describe, expect, test } from 'bun:test';

import {
  VANILLA_PATH_TRAVERSE_MAX_BLOCKS,
  VANILLA_PT_ADDLINES,
  VANILLA_PT_ADDTHINGS,
  VANILLA_PT_EARLYOUT,
  isPathTraverseOverLimit,
  pathTraverseAddsLines,
  pathTraverseAddsThings,
  pathTraverseEarlyOut,
} from '../../../src/map/implement-path-traverse-limits.ts';

describe('vanilla P_PathTraverse limits', () => {
  test('block cap is 64; flag bits PT_ADDLINES=1, PT_ADDTHINGS=2, PT_EARLYOUT=4', () => {
    expect(VANILLA_PATH_TRAVERSE_MAX_BLOCKS).toBe(64);
    expect(VANILLA_PT_ADDLINES).toBe(1);
    expect(VANILLA_PT_ADDTHINGS).toBe(2);
    expect(VANILLA_PT_EARLYOUT).toBe(4);
  });

  test('64 blocks is within limit, 65+ is over', () => {
    expect(isPathTraverseOverLimit({ blockCountWalked: 64, flags: 0 })).toBe(false);
    expect(isPathTraverseOverLimit({ blockCountWalked: 65, flags: 0 })).toBe(true);
  });

  test('flag predicates check the right bits', () => {
    expect(pathTraverseAddsLines(VANILLA_PT_ADDLINES)).toBe(true);
    expect(pathTraverseAddsThings(VANILLA_PT_ADDTHINGS)).toBe(true);
    expect(pathTraverseEarlyOut(VANILLA_PT_EARLYOUT)).toBe(true);
    expect(pathTraverseAddsLines(VANILLA_PT_ADDTHINGS)).toBe(false);
  });
});
