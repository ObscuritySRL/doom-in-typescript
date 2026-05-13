import { describe, expect, test } from 'bun:test';

import { evaluateCheckPosition } from '../../../src/map/implement-check-position-semantics.ts';

describe('evaluateCheckPosition', () => {
  test('fits when vertical space is enough and no blocker', () => {
    const result = evaluateCheckPosition({
      thingRadius: 16,
      proposedX: 0,
      proposedY: 0,
      thingHeight: 56,
      highestFloorEncountered: 0,
      lowestCeilingEncountered: 128,
      lowestDropoffEncountered: 0,
      anyBlockingThing: false,
    });
    expect(result.canFit).toBe(true);
    expect(result.verticalSpace).toBe(128);
  });

  test('does not fit when vertical space < height', () => {
    const result = evaluateCheckPosition({
      thingRadius: 16,
      proposedX: 0,
      proposedY: 0,
      thingHeight: 56,
      highestFloorEncountered: 0,
      lowestCeilingEncountered: 32,
      lowestDropoffEncountered: 0,
      anyBlockingThing: false,
    });
    expect(result.canFit).toBe(false);
  });

  test('any blocking thing forces canFit=false', () => {
    const result = evaluateCheckPosition({
      thingRadius: 16,
      proposedX: 0,
      proposedY: 0,
      thingHeight: 56,
      highestFloorEncountered: 0,
      lowestCeilingEncountered: 128,
      lowestDropoffEncountered: 0,
      anyBlockingThing: true,
    });
    expect(result.canFit).toBe(false);
  });

  test('floor/ceiling/dropoff are recorded from the encountered extrema', () => {
    const result = evaluateCheckPosition({
      thingRadius: 16,
      proposedX: 0,
      proposedY: 0,
      thingHeight: 56,
      highestFloorEncountered: 32,
      lowestCeilingEncountered: 100,
      lowestDropoffEncountered: -16,
      anyBlockingThing: false,
    });
    expect(result.tmFloorZ).toBe(32);
    expect(result.tmCeilingZ).toBe(100);
    expect(result.tmDropoffZ).toBe(-16);
  });
});
