import { describe, expect, test } from 'bun:test';

import { VANILLA_CRUSHER_DAMAGE_PER_HIT, VANILLA_CRUSHER_DAMAGE_TIC_INTERVAL, evaluateSectorChange } from '../../../src/map/implement-sector-floor-ceiling-change-checks.ts';

describe('vanilla sector change contract', () => {
  test('crusher damage is 10 per hit, every 4th tic', () => {
    expect(VANILLA_CRUSHER_DAMAGE_PER_HIT).toBe(10);
    expect(VANILLA_CRUSHER_DAMAGE_TIC_INTERVAL).toBe(4);
  });

  test('thing fits when available height >= thing height; no damage', () => {
    const result = evaluateSectorChange({ thingHeight: 56, thingFloorZ: 0, thingCeilingZ: 100, thingIsAlive: true, crushIsEnabled: true, currentTic: 0 });
    expect(result.fits).toBe(true);
    expect(result.damageApplied).toBe(0);
  });

  test('crusher damages living thing every 4th tic when not fitting', () => {
    const result = evaluateSectorChange({ thingHeight: 56, thingFloorZ: 0, thingCeilingZ: 32, thingIsAlive: true, crushIsEnabled: true, currentTic: 4 });
    expect(result.fits).toBe(false);
    expect(result.damageApplied).toBe(10);
  });

  test('crusher with damage disabled applies no damage even when crushing', () => {
    const result = evaluateSectorChange({ thingHeight: 56, thingFloorZ: 0, thingCeilingZ: 32, thingIsAlive: true, crushIsEnabled: false, currentTic: 4 });
    expect(result.fits).toBe(false);
    expect(result.damageApplied).toBe(0);
  });

  test('non-living things take no crusher damage', () => {
    const result = evaluateSectorChange({ thingHeight: 56, thingFloorZ: 0, thingCeilingZ: 32, thingIsAlive: false, crushIsEnabled: true, currentTic: 4 });
    expect(result.damageApplied).toBe(0);
  });

  test('non-multiple-of-4 tic does not apply damage', () => {
    const result = evaluateSectorChange({ thingHeight: 56, thingFloorZ: 0, thingCeilingZ: 32, thingIsAlive: true, crushIsEnabled: true, currentTic: 3 });
    expect(result.damageApplied).toBe(0);
  });
});
