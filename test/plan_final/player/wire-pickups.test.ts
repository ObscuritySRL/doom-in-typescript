import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  VANILLA_PICKUP_ENTRY_POINTS,
  clearPickupContext,
  computeFixedColormap,
  computePalette,
  getPickupContext,
  giveArmor,
  giveBody,
  giveCard,
  givePower,
  setPickupContext,
  tickPowerups,
  touchSpecialThing,
} from '../../../src/vanilla/wirePickups.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wirePickups.ts');

describe('plan_final player: wire-pickups', () => {
  test('src/vanilla/wirePickups.ts exists, is a regular file, and cites plan_final step 09-007', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-007');
    expect(fileText).toContain('VANILLA_PICKUP_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only pickups + powerups modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../player/pickups.ts'");
    expect(fileText).toContain("from '../player/powerups.ts'");
  });

  test('VANILLA_PICKUP_ENTRY_POINTS pins the eight canonical entry points and is frozen', () => {
    expect(VANILLA_PICKUP_ENTRY_POINTS).toEqual(['computeFixedColormap', 'computePalette', 'giveArmor', 'giveBody', 'giveCard', 'givePower', 'tickPowerups', 'touchSpecialThing']);
    expect(Object.isFrozen(VANILLA_PICKUP_ENTRY_POINTS)).toBe(true);
  });

  test('every wired pickup + powerup function is re-exported as a callable function', () => {
    expect(typeof giveBody).toBe('function');
    expect(typeof giveArmor).toBe('function');
    expect(typeof giveCard).toBe('function');
    expect(typeof givePower).toBe('function');
    expect(typeof touchSpecialThing).toBe('function');
    expect(typeof setPickupContext).toBe('function');
    expect(typeof getPickupContext).toBe('function');
    expect(typeof clearPickupContext).toBe('function');
    expect(typeof tickPowerups).toBe('function');
    expect(typeof computeFixedColormap).toBe('function');
    expect(typeof computePalette).toBe('function');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const pickupsSource = await import('../../../src/player/pickups.ts');
    const powerupsSource = await import('../../../src/player/powerups.ts');
    expect(touchSpecialThing).toBe(pickupsSource.touchSpecialThing);
    expect(giveBody).toBe(pickupsSource.giveBody);
    expect(tickPowerups).toBe(powerupsSource.tickPowerups);
    expect(computePalette).toBe(powerupsSource.computePalette);
  });
});
