import { describe, expect, test } from 'bun:test';

import { VANILLA_DROPOFF_LIMIT, evaluateTryMove } from '../../../src/map/implement-try-move-semantics.ts';

const baseCheck = {
  thingRadius: 16,
  proposedX: 0,
  proposedY: 0,
  thingHeight: 56,
  highestFloorEncountered: 0,
  lowestCeilingEncountered: 128,
  lowestDropoffEncountered: 0,
  anyBlockingThing: false,
};

describe('evaluateTryMove', () => {
  test('vanilla dropoff limit is 24', () => {
    expect(VANILLA_DROPOFF_LIMIT).toBe(24);
  });

  test('commits when canFit and no dropoff issue', () => {
    const result = evaluateTryMove({
      check: baseCheck,
      thingIsMonster: false,
      thingHasDropoffFlag: false,
      currentFloorZ: 0,
    });
    expect(result.committed).toBe(true);
    expect(result.blockedByDropoff).toBe(false);
  });

  test('blocks when check.canFit is false', () => {
    const result = evaluateTryMove({
      check: { ...baseCheck, anyBlockingThing: true },
      thingIsMonster: false,
      thingHasDropoffFlag: false,
      currentFloorZ: 0,
    });
    expect(result.committed).toBe(false);
  });

  test('blocks monster (no dropoff flag) when dropoff > 24', () => {
    const result = evaluateTryMove({
      check: { ...baseCheck, lowestDropoffEncountered: -100 },
      thingIsMonster: true,
      thingHasDropoffFlag: false,
      currentFloorZ: 0,
    });
    expect(result.committed).toBe(false);
    expect(result.blockedByDropoff).toBe(true);
  });

  test('monster with MF_DROPOFF bypasses dropoff check', () => {
    const result = evaluateTryMove({
      check: { ...baseCheck, lowestDropoffEncountered: -100 },
      thingIsMonster: true,
      thingHasDropoffFlag: true,
      currentFloorZ: 0,
    });
    expect(result.committed).toBe(true);
  });

  test('non-monster (player/projectile) ignores dropoff check', () => {
    const result = evaluateTryMove({
      check: { ...baseCheck, lowestDropoffEncountered: -100 },
      thingIsMonster: false,
      thingHasDropoffFlag: false,
      currentFloorZ: 0,
    });
    expect(result.committed).toBe(true);
  });
});
