import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ActiveCeilings,
  ActivePlats,
  CEILING_8_UNIT_OFFSET,
  CEILSPEED,
  CEILWAIT,
  DONUT_SPEED,
  FLOOR_24_UNIT_OFFSET,
  FLOOR_512_UNIT_OFFSET,
  FLOOR_8_UNIT_OFFSET,
  FLOORSPEED,
  MAXCEILINGS,
  MAXPLATS,
  PLATSPEED,
  PLATWAIT,
  PLATWAIT_TICS,
  SFX_PSTART,
  SFX_PSTOP,
  SFX_STNMOV,
  STAIR_16_UNIT_SIZE,
  STAIR_8_UNIT_SIZE,
  STAIR_BUILD8_SPEED,
  STAIR_TURBO16_SPEED,
  VANILLA_FLOOR_CEILING_PLAT_INVARIANTS,
  evBuildStairs,
  evDoCeiling,
  evDoDonut,
  evDoFloor,
  evDoPlat,
} from '../../../src/vanilla/wireFloorCeilingPlatformSpecials.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireFloorCeilingPlatformSpecials.ts');
const FRACUNIT = 0x1_0000;

describe('plan_final map: wire-floor-ceiling-platform-specials', () => {
  test('src/vanilla/wireFloorCeilingPlatformSpecials.ts exists, is a regular file, and cites plan_final step 08-006', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('08-006');
    expect(fileText).toContain('VANILLA_FLOOR_CEILING_PLAT_INVARIANTS');
  });

  test('the facade re-exports only from the four read-only moving-plane modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]!);
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../specials/ceilings.ts', '../specials/floors.ts', '../specials/platforms.ts', '../specials/stairsDonut.ts']);
  });

  test('VANILLA_FLOOR_CEILING_PLAT_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_FLOOR_CEILING_PLAT_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_FLOOR_CEILING_PLAT_INVARIANTS)).toBe(true);
    const ids = VANILLA_FLOOR_CEILING_PLAT_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'ACTIVE_SPECIALS_ARE_RESTORABLE_VIA_STASIS_HOOKS',
      'EV_DISPATCHERS_RETURN_NONZERO_ONLY_WHEN_A_MOVER_SPAWNED',
      'PLANE_SPEEDS_ARE_ONE_FRACUNIT_PER_TIC',
      'STAIR_AND_DONUT_SPEEDS_DERIVE_FROM_FLOORSPEED',
      'VANILLA_WAITS_AND_CAPS_HOLD',
    ]);
    for (const invariant of VANILLA_FLOOR_CEILING_PLAT_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the plane speeds are one FRACUNIT per tic', () => {
    expect(FLOORSPEED).toBe(FRACUNIT);
    expect(CEILSPEED).toBe(FRACUNIT);
    expect(PLATSPEED).toBe(FRACUNIT);
  });

  test('the vanilla waits and active-special caps hold', () => {
    expect(CEILWAIT).toBe(150);
    expect(PLATWAIT).toBe(3);
    expect(PLATWAIT_TICS).toBe(105);
    expect(MAXCEILINGS).toBe(30);
    expect(MAXPLATS).toBe(30);
  });

  test('the unit offsets and stair/donut speeds derive from FRACUNIT / FLOORSPEED', () => {
    expect(FLOOR_8_UNIT_OFFSET).toBe(8 * FRACUNIT);
    expect(FLOOR_24_UNIT_OFFSET).toBe(24 * FRACUNIT);
    expect(FLOOR_512_UNIT_OFFSET).toBe(512 * FRACUNIT);
    expect(CEILING_8_UNIT_OFFSET).toBe(8 * FRACUNIT);
    expect(STAIR_8_UNIT_SIZE).toBe(8 * FRACUNIT);
    expect(STAIR_16_UNIT_SIZE).toBe(16 * FRACUNIT);
    expect(STAIR_BUILD8_SPEED).toBe((FLOORSPEED / 4) | 0);
    expect(STAIR_TURBO16_SPEED).toBe((FLOORSPEED * 4) | 0);
    expect(DONUT_SPEED).toBe((FLOORSPEED / 2) | 0);
  });

  test('the moving-plane sfx ids match vanilla', () => {
    expect(SFX_PSTART).toBe(18);
    expect(SFX_PSTOP).toBe(19);
    expect(SFX_STNMOV).toBe(22);
  });

  test('the re-exported dispatchers and registries are the SAME references as the read-only source modules', async () => {
    const floorsSource = await import('../../../src/specials/floors.ts');
    const ceilingsSource = await import('../../../src/specials/ceilings.ts');
    const platformsSource = await import('../../../src/specials/platforms.ts');
    const stairsSource = await import('../../../src/specials/stairsDonut.ts');
    expect(evDoFloor).toBe(floorsSource.evDoFloor);
    expect(evDoCeiling).toBe(ceilingsSource.evDoCeiling);
    expect(ActiveCeilings).toBe(ceilingsSource.ActiveCeilings);
    expect(evDoPlat).toBe(platformsSource.evDoPlat);
    expect(ActivePlats).toBe(platformsSource.ActivePlats);
    expect(evBuildStairs).toBe(stairsSource.evBuildStairs);
    expect(evDoDonut).toBe(stairsSource.evDoDonut);
    expect(FLOORSPEED).toBe(floorsSource.FLOORSPEED);
  });
});
