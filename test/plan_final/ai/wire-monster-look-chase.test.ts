import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  FLOATSPEED,
  MELEERANGE,
  MELEE_BASE_CUTOFF,
  MELEE_RADIUS_ADJUST,
  MISSILE_BASE_CUTOFF,
  MISSILE_CYBORG_DIST_CLAMP,
  MISSILE_DIST_CLAMP,
  MISSILE_NO_MELEE_CUTOFF,
  MISSILE_UNDEAD_DIST_MIN,
  MISSILE_VILE_DIST_MAX,
  NUMDIRS,
  VANILLA_MONSTER_LOOK_CHASE_INVARIANTS,
  X_SPEED,
  Y_SPEED,
  chase,
  checkMeleeRange,
  checkMissileRange,
  move,
  newChaseDir,
} from '../../../src/vanilla/wireMonsterLookChase.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireMonsterLookChase.ts');
const FRACUNIT = 0x1_0000;

describe('plan_final ai: wire-monster-look-chase', () => {
  test('src/vanilla/wireMonsterLookChase.ts exists, is a regular file, and cites plan_final step 10-003', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('10-003');
    expect(fileText).toContain('VANILLA_MONSTER_LOOK_CHASE_INVARIANTS');
  });

  test('the facade re-exports only from the three read-only ai look/chase/range modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ai/chase.ts', '../ai/meleeRange.ts', '../ai/missileRange.ts']);
  });

  test('VANILLA_MONSTER_LOOK_CHASE_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_MONSTER_LOOK_CHASE_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_MONSTER_LOOK_CHASE_INVARIANTS)).toBe(true);
    const ids = VANILLA_MONSTER_LOOK_CHASE_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['CHASE_DIR_TABLE_HAS_EIGHT_DIRS_PLUS_NODIR', 'FLOATING_MONSTERS_USE_FLOATSPEED', 'MELEE_RANGE_IS_64_FRACUNIT_LESS_RADIUS_ADJUST', 'MISSILE_RANGE_USES_PER_ARCHETYPE_CUTOFFS', 'MOVE_AND_CHASE_EMIT_ACTIVE_SOUND']);
    for (const invariant of VANILLA_MONSTER_LOOK_CHASE_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the chase-direction tables and range cutoffs match vanilla p_enemy.c', () => {
    expect(NUMDIRS).toBe(9);
    expect(X_SPEED.length).toBe(8);
    expect(Y_SPEED.length).toBe(8);
    expect(X_SPEED[0]).toBe(FRACUNIT);
    expect(X_SPEED[1]).toBe(47000);
    expect(Y_SPEED[2]).toBe(FRACUNIT);
    expect(FLOATSPEED).toBe(4 * FRACUNIT);
    expect(MELEERANGE).toBe(64 * FRACUNIT);
    expect(MELEE_RADIUS_ADJUST).toBe(20 * FRACUNIT);
    expect(MELEE_BASE_CUTOFF).toBe((64 - 20) * FRACUNIT);
    expect(MISSILE_BASE_CUTOFF).toBe(64 * FRACUNIT);
    expect(MISSILE_NO_MELEE_CUTOFF).toBe(128 * FRACUNIT);
    expect(MISSILE_DIST_CLAMP).toBe(200);
    expect(MISSILE_CYBORG_DIST_CLAMP).toBe(160);
    expect(MISSILE_VILE_DIST_MAX).toBe(14 * 64);
    expect(MISSILE_UNDEAD_DIST_MIN).toBe(196);
  });

  test('every wired look/chase/range primitive is re-exported as a callable function', () => {
    expect(typeof move).toBe('function');
    expect(typeof newChaseDir).toBe('function');
    expect(typeof chase).toBe('function');
    expect(typeof checkMeleeRange).toBe('function');
    expect(typeof checkMissileRange).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const chaseSource = await import('../../../src/ai/chase.ts');
    const meleeSource = await import('../../../src/ai/meleeRange.ts');
    const missileSource = await import('../../../src/ai/missileRange.ts');
    expect(chase).toBe(chaseSource.chase);
    expect(NUMDIRS).toBe(chaseSource.NUMDIRS);
    expect(checkMeleeRange).toBe(meleeSource.checkMeleeRange);
    expect(MELEERANGE).toBe(meleeSource.MELEERANGE);
    expect(checkMissileRange).toBe(missileSource.checkMissileRange);
  });
});
