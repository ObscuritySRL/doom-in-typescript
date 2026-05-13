import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { WORLD_MOVEMENT_GATE } from '../../../src/world/gate-world-movement-against-oracle.ts';

describe('gate: vanilla DOOM 1.9 world movement constants are pinned', () => {
  test('GRAVITY equals FRACUNIT (1 map unit/tic^2)', () => {
    expect(WORLD_MOVEMENT_GATE.gravityFixed).toBe(FRACUNIT);
  });

  test('FLOATSPEED is 4 * FRACUNIT', () => {
    expect(WORLD_MOVEMENT_GATE.floatSpeedFixed).toBe(4 * FRACUNIT);
  });

  test('VIEWHEIGHT is 41 * FRACUNIT', () => {
    expect(WORLD_MOVEMENT_GATE.viewHeightFixed).toBe(41 * FRACUNIT);
  });

  test('MAXMOVE is 30 * FRACUNIT', () => {
    expect(WORLD_MOVEMENT_GATE.maxMoveFixed).toBe(30 * FRACUNIT);
  });

  test('STOPSPEED is 0x1000 (per Chocolate Doom p_mobj.c)', () => {
    expect(WORLD_MOVEMENT_GATE.stopSpeedFixed).toBe(0x1000);
  });

  test('FRICTION is 0xe800 (per Chocolate Doom p_mobj.c)', () => {
    expect(WORLD_MOVEMENT_GATE.frictionFixed).toBe(0xe800);
  });

  test('MAXSTEPHEIGHT is 24 * FRACUNIT', () => {
    expect(WORLD_MOVEMENT_GATE.maxStepHeightFixed).toBe(24 * FRACUNIT);
  });

  test('gate object is frozen and cannot drift at runtime', () => {
    expect(Object.isFrozen(WORLD_MOVEMENT_GATE)).toBe(true);
  });
});
