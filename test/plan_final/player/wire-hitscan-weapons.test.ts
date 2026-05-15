import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BULLET_AIM_NUDGE,
  BULLET_AIM_RANGE,
  HITSCAN_ACTION_COUNT,
  MELEERANGE,
  MISSILERANGE,
  SFX_DSHTGN,
  SFX_PISTOL,
  SFX_PUNCH,
  SFX_SAWFUL,
  SFX_SAWHIT,
  SFX_SHOTGN,
  VANILLA_HITSCAN_WEAPON_INVARIANTS,
  aFireCGun,
  aFirePistol,
  aFireShotgun,
  aFireShotgun2,
  aPunch,
  aSaw,
  wireHitscanActions,
} from '../../../src/vanilla/wireHitscanWeapons.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireHitscanWeapons.ts');
const FRACUNIT = 0x1_0000;

describe('plan_final player: wire-hitscan-weapons', () => {
  test('src/vanilla/wireHitscanWeapons.ts exists, is a regular file, and cites plan_final step 09-005', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-005');
    expect(fileText).toContain('VANILLA_HITSCAN_WEAPON_INVARIANTS');
  });

  test('the facade re-exports only from the read-only hitscan module', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../player/hitscan.ts']);
  });

  test('VANILLA_HITSCAN_WEAPON_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_HITSCAN_WEAPON_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_HITSCAN_WEAPON_INVARIANTS)).toBe(true);
    const ids = VANILLA_HITSCAN_WEAPON_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['AUTOAIM_USES_BULLET_AIM_RANGE_AND_NUDGE', 'CHAINSAW_USES_SAW_ANGLE_SPREAD_AND_SNAP', 'FIST_AND_SAW_USE_MELEERANGE', 'HITSCAN_REGISTERS_EIGHT_WEAPON_ACTIONS', 'WEAPON_SFX_IDS_MATCH_VANILLA']);
    for (const invariant of VANILLA_HITSCAN_WEAPON_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the hitscan ranges and weapon sfx ids match vanilla', () => {
    expect(MELEERANGE).toBe(64 * FRACUNIT);
    expect(MISSILERANGE).toBe(32 * 64 * FRACUNIT);
    expect(BULLET_AIM_RANGE).toBe(16 * 64 * FRACUNIT);
    expect(BULLET_AIM_NUDGE).toBe(1 << 26);
    expect(HITSCAN_ACTION_COUNT).toBe(8);
    expect(SFX_PISTOL).toBe(1);
    expect(SFX_SHOTGN).toBe(2);
    expect(SFX_DSHTGN).toBe(4);
    expect(SFX_SAWFUL).toBe(13);
    expect(SFX_SAWHIT).toBe(14);
    expect(SFX_PUNCH).toBe(84);
  });

  test('all six hitscan weapon fire actions are re-exported as callable functions', () => {
    expect(typeof aPunch).toBe('function');
    expect(typeof aSaw).toBe('function');
    expect(typeof aFirePistol).toBe('function');
    expect(typeof aFireShotgun).toBe('function');
    expect(typeof aFireShotgun2).toBe('function');
    expect(typeof aFireCGun).toBe('function');
    expect(typeof wireHitscanActions).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only hitscan module', async () => {
    const hitscanSource = await import('../../../src/player/hitscan.ts');
    expect(aPunch).toBe(hitscanSource.aPunch);
    expect(aFireShotgun2).toBe(hitscanSource.aFireShotgun2);
    expect(MELEERANGE).toBe(hitscanSource.MELEERANGE);
    expect(HITSCAN_ACTION_COUNT).toBe(hitscanSource.HITSCAN_ACTION_COUNT);
  });
});
