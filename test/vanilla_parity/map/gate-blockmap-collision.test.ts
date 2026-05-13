import { describe, expect, test } from 'bun:test';

import { BLOCKMAP_COLLISION_GATE } from '../../../src/world/gate-blockmap-collision.ts';
import { FRACBITS } from '../../../src/core/fixed.ts';

describe('gate: blockmap collision primitives are pinned for vanilla parity', () => {
  test('MAPBLOCKSIZE is 128 map units', () => {
    expect(BLOCKMAP_COLLISION_GATE.mapBlockSizeFixed).toBe(128);
  });

  test('MAPBTOFRAC = 7 (matches vanilla MAPBLOCKSHIFT - FRACBITS)', () => {
    expect(BLOCKMAP_COLLISION_GATE.mapBlockToFrac).toBe(7);
  });

  test('MAPBLOCKSHIFT = FRACBITS + 7 = 23', () => {
    expect(BLOCKMAP_COLLISION_GATE.mapBlockShift).toBe(FRACBITS + 7);
    expect(BLOCKMAP_COLLISION_GATE.mapBlockShift).toBe(23);
  });

  test('MAXRADIUS = 32 map units in fixed-point', () => {
    expect(BLOCKMAP_COLLISION_GATE.maxRadiusMapUnits).toBe(32 << FRACBITS);
  });
});
